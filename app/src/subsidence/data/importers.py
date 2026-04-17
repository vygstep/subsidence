from __future__ import annotations

import hashlib
import json
from pathlib import Path
from uuid import uuid4

import lasio
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from sqlalchemy.orm import Session

from .dict_resolver import load_curve_alias_rules, resolve_curve_alias
from .schema import CurveMetadata, WellModel
from .unit_conversion import canonicalize_gamma_unit, convert_curve_units, convert_depth_to_meters, normalize_unit_name

_DEPTH_CANDIDATES = {'DEPT', 'DEPTH', 'MD', 'TVD', 'TVDSS'}


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def _coerce_float(value: object, default: float | None = None) -> float | None:
    if value in (None, ''):
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _header_text(las: lasio.LASFile, name: str) -> str | None:
    item = las.well.get(name)
    if item is None:
        return None
    value = str(getattr(item, 'value', '') or '').strip()
    return value or None


def _header_float(las: lasio.LASFile, name: str, default: float | None = None) -> float | None:
    item = las.well.get(name)
    if item is None:
        return default
    return _coerce_float(getattr(item, 'value', None), default)


def _is_valid_sample(depth: float, value: float, null_value: float | None) -> bool:
    if pd.isna(depth) or pd.isna(value):
        return False
    if null_value is not None and value == null_value:
        return False
    return True


def _create_well_from_las(session: Session, las: lasio.LASFile, original_relative_path: str) -> WellModel:
    name = _header_text(las, 'WELL') or _header_text(las, 'ORIGINALWELLNAME') or Path(original_relative_path).stem
    kb_elev = _header_float(las, 'EREF', 0.0) or 0.0
    td_md = _header_float(las, 'TD')
    lat = _header_float(las, 'SLAT') or _header_float(las, 'LATI')
    lon = _header_float(las, 'SLON') or _header_float(las, 'LONG')
    crs = _header_text(las, 'HZCS') or 'unset'

    extra = {
        'company': _header_text(las, 'COMP'),
        'field': _header_text(las, 'FLD'),
        'location': _header_text(las, 'LOC'),
        'api': _header_text(las, 'API'),
        'country': _header_text(las, 'COUNTRY') or _header_text(las, 'CTRY'),
        'original_well_name': _header_text(las, 'ORIGINALWELLNAME'),
    }
    extra = {key: value for key, value in extra.items() if value not in (None, '')}

    well = WellModel(
        id=str(uuid4()),
        uwi=_header_text(las, 'UWI'),
        name=name,
        kb_elev=kb_elev,
        gl_elev=0.0,
        td_md=td_md,
        lat=lat,
        lon=lon,
        crs=crs,
        source_las_path=original_relative_path,
        extra=json.dumps(extra, ensure_ascii=True) if extra else None,
    )
    session.add(well)
    session.flush()
    return well


def import_las_file(session: Session, project_path: Path | str, las_path: Path | str) -> WellModel:
    bundle_path = Path(project_path)
    source_path = Path(las_path)
    originals_dir = bundle_path / 'originals'
    curves_dir = bundle_path / 'curves'
    originals_dir.mkdir(parents=True, exist_ok=True)
    curves_dir.mkdir(parents=True, exist_ok=True)

    original_relative_path = f'originals/{source_path.name}'
    copied_las_path = bundle_path / original_relative_path
    copied_las_path.write_bytes(source_path.read_bytes())
    source_hash = _sha256(source_path)

    las = lasio.read(str(source_path))
    depth_unit = (las.curves[0].unit or 'm').strip()
    depth_values = convert_depth_to_meters([float(value) for value in las.index], depth_unit)
    null_value = _coerce_float(getattr(las.well.get('NULL'), 'value', None))
    rules = load_curve_alias_rules(session)
    well = _create_well_from_las(session, las, original_relative_path)

    curve_series: dict[str, pd.Series] = {}
    parquet_relative_path = f'curves/{well.id}.parquet'

    for curve in las.curves:
        mnemonic = curve.mnemonic.strip()
        if mnemonic.upper() in _DEPTH_CANDIDATES:
            continue

        raw_values = [float(value) for value in las[curve.mnemonic]]
        clean_pairs: dict[float, float] = {}
        for depth, value in zip(depth_values, raw_values):
            if _is_valid_sample(depth, value, null_value):
                clean_pairs[depth] = value

        if len(clean_pairs) < 2:
            continue

        clean_depths = sorted(clean_pairs)
        clean_values = [clean_pairs[depth] for depth in clean_depths]
        source_unit = (curve.unit or '').strip()
        match = resolve_curve_alias(mnemonic, rules)
        family_code = match.family_code
        standard_mnemonic = match.canonical_mnemonic
        target_unit = match.canonical_unit or source_unit

        if family_code == 'gamma_ray':
            target_unit = canonicalize_gamma_unit(target_unit)

        values = clean_values
        if source_unit and target_unit and normalize_unit_name(source_unit) != normalize_unit_name(target_unit):
            try:
                values = convert_curve_units(values, source_unit, target_unit, family_code)
            except ValueError:
                target_unit = source_unit

        curve_series[mnemonic] = pd.Series(values, index=pd.Index(clean_depths, name='DEPT'), dtype='float32')
        session.add(
            CurveMetadata(
                well_id=well.id,
                mnemonic=mnemonic,
                standard_mnemonic=standard_mnemonic,
                family_code=family_code,
                unit=target_unit,
                original_unit=source_unit,
                curve_type='continuous',
                depth_min=min(clean_depths),
                depth_max=max(clean_depths),
                n_samples=len(clean_depths),
                data_uri=parquet_relative_path,
                source_hash=source_hash,
            )
        )

    if not curve_series:
        raise ValueError(f'No importable curves were found in LAS file: {source_path}')

    frame = pd.concat(curve_series, axis=1).sort_index().reset_index()
    frame['DEPT'] = frame['DEPT'].astype('float32')
    parquet_path = bundle_path / parquet_relative_path
    table = pa.Table.from_pandas(frame, preserve_index=False)
    pq.write_table(table, parquet_path, compression='snappy')
    session.flush()
    return well
