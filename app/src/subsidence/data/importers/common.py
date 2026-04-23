from __future__ import annotations

import csv
import hashlib
import json
import math
from pathlib import Path
from uuid import uuid4

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..schema import CurveMetadata, WellModel

_DEPTH_MNEMONICS = {'DEPT', 'DEPTH', 'MD', 'TVD', 'TVDSS'}
_DEFAULT_TOP_COLOR = '#4b5563'
DEFAULT_WELL_NAME = 'well-1'
DEFAULT_WELL_X = 0.0
DEFAULT_WELL_Y = 0.0
DEFAULT_WELL_KB = 10.0
DEFAULT_WELL_CRS = 'unset'
_CSV_EXCLUDED_COLUMNS = {'well_name'}


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


def _normalize_text(value: str | None) -> str:
    return (value or '').strip().casefold()


def _extract_text(row: dict[str, str], *candidates: str) -> str | None:
    for key in candidates:
        value = (row.get(key) or '').strip()
        if value:
            return value
    return None


def _extract_float(row: dict[str, str], *candidates: str) -> float | None:
    for key in candidates:
        value = _extract_text(row, key)
        if value is not None:
            return _coerce_float(value)
    return None


def _normalize_well_name(name: str | None) -> str:
    value = (name or '').strip()
    return value or DEFAULT_WELL_NAME


def _normalized_crs(crs: str | None) -> str:
    value = (crs or '').strip()
    return value or DEFAULT_WELL_CRS


def _merge_extra_json(existing_json: str | None, patch: dict[str, object] | None) -> str | None:
    if not patch:
        return existing_json
    existing: dict[str, object] = {}
    if existing_json:
        try:
            loaded = json.loads(existing_json)
            if isinstance(loaded, dict):
                existing = loaded
        except json.JSONDecodeError:
            existing = {}
    existing.update({key: value for key, value in patch.items() if value not in (None, '')})
    return json.dumps(existing, ensure_ascii=True) if existing else None


def create_empty_well(
    session: Session,
    *,
    name: str | None = None,
    x: float | None = None,
    y: float | None = None,
    kb: float | None = None,
    td: float | None = None,
    crs: str | None = None,
    uwi: str | None = None,
    source_las_path: str | None = None,
    extra: dict[str, object] | None = None,
) -> WellModel:
    well = WellModel(
        id=str(uuid4()),
        uwi=(uwi or '').strip() or None,
        name=_normalize_well_name(name),
        kb_elev=kb if kb is not None else DEFAULT_WELL_KB,
        gl_elev=0.0,
        td_md=td,
        lat=y if y is not None else DEFAULT_WELL_Y,
        lon=x if x is not None else DEFAULT_WELL_X,
        crs=_normalized_crs(crs),
        source_las_path=source_las_path,
        extra=json.dumps(extra, ensure_ascii=True) if extra else None,
    )
    session.add(well)
    session.flush()
    return well


def apply_imported_well_metadata(
    well: WellModel,
    *,
    name: str | None = None,
    uwi: str | None = None,
    x: float | None = None,
    y: float | None = None,
    kb: float | None = None,
    td: float | None = None,
    crs: str | None = None,
    source_las_path: str | None = None,
    extra: dict[str, object] | None = None,
) -> WellModel:
    imported_name = (name or '').strip()
    if imported_name and (not well.name or well.name == DEFAULT_WELL_NAME):
        well.name = imported_name

    imported_uwi = (uwi or '').strip()
    if imported_uwi and not well.uwi:
        well.uwi = imported_uwi

    if x is not None and (well.lon is None or well.lon == DEFAULT_WELL_X):
        well.lon = x
    if y is not None and (well.lat is None or well.lat == DEFAULT_WELL_Y):
        well.lat = y
    if kb is not None and (well.kb_elev in (0.0, DEFAULT_WELL_KB)):
        well.kb_elev = kb
    if td is not None and (well.td_md is None or td > well.td_md):
        well.td_md = td

    imported_crs = (crs or '').strip()
    if imported_crs and well.crs in ('', DEFAULT_WELL_CRS):
        well.crs = imported_crs

    if source_las_path:
        well.source_las_path = source_las_path

    well.extra = _merge_extra_json(well.extra, extra)
    return well


def _is_valid_sample(depth: float, value: float, null_value: float | None) -> bool:
    if not math.isfinite(depth) or not math.isfinite(value):
        return False
    if null_value is not None and value == null_value:
        return False
    return True


def _resolve_well(session: Session, well_id: str) -> WellModel:
    well = session.get(WellModel, well_id)
    if well is None:
        raise ValueError(f'Well not found: {well_id}')
    return well


def _find_existing_well_by_identity(
    session: Session,
    *,
    name: str | None = None,
    uwi: str | None = None,
) -> WellModel | None:
    normalized_name = _normalize_text(name)
    normalized_uwi = _normalize_text(uwi)
    if not normalized_name and not normalized_uwi:
        return None

    wells = session.scalars(select(WellModel).order_by(WellModel.name.asc(), WellModel.id.asc())).all()
    for well in wells:
        if normalized_uwi and _normalize_text(well.uwi) == normalized_uwi:
            return well
        if normalized_name and _normalize_text(well.name) == normalized_name:
            return well
    return None


def _read_csv_rows(path: Path | str) -> tuple[list[str], list[dict[str, str]]]:
    csv_path = Path(path)
    with csv_path.open('r', encoding='utf-8-sig', newline='') as handle:
        sample = handle.read(4096)
        handle.seek(0)
        delimiter = ','
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=',;\t')
            delimiter = dialect.delimiter
        except csv.Error:
            pass
        reader = csv.DictReader(handle, delimiter=delimiter)
        fieldnames = [str(name or '').strip() for name in (reader.fieldnames or [])]
        rows: list[dict[str, str]] = []
        for row in reader:
            rows.append({str(key or '').strip(): value for key, value in dict(row).items()})
        return fieldnames, rows


def _repo_sample_data_dir() -> Path:
    return Path(__file__).resolve().parents[5] / 'sample_data'


def _default_ics_paths() -> tuple[Path, Path]:
    sample_dir = _repo_sample_data_dir()
    return sample_dir / 'ics_chart2023_units.csv', sample_dir / 'ics_chart2023_ranks.csv'


def _load_ics_units(units_path: Path | None = None, ranks_path: Path | None = None) -> list[dict[str, object]]:
    resolved_units, resolved_ranks = units_path, ranks_path
    if resolved_units is None or resolved_ranks is None:
        default_units, default_ranks = _default_ics_paths()
        resolved_units = resolved_units or default_units
        resolved_ranks = resolved_ranks or default_ranks

    if not resolved_units.exists() or not resolved_ranks.exists():
        return []

    _, rank_rows = _read_csv_rows(resolved_ranks)
    rank_order = {int(row['rank_id']): index for index, row in enumerate(rank_rows)}

    _, unit_rows = _read_csv_rows(resolved_units)
    units: list[dict[str, object]] = []
    for row in unit_rows:
        start_age = _extract_float(row, 'start_age_ma')
        end_age = _extract_float(row, 'end_age_ma')
        rank_id = int(row['rank_id']) if (row.get('rank_id') or '').strip() else 0
        color_hex = _extract_text(row, 'html_rgb_hash')
        if start_age is None or end_age is None or color_hex is None:
            continue
        units.append(
            {
                'name': _extract_text(row, 'unit_name') or '',
                'rank_id': rank_id,
                'rank_order': rank_order.get(rank_id, 999),
                'start_age_ma': start_age,
                'end_age_ma': end_age,
                'interval_width': end_age - start_age,
                'standard_sort': int(row['standard_sort']) if (row.get('standard_sort') or '').strip() else 0,
                'color_hex': color_hex,
            }
        )
    return units


def _resolve_ics_color(age_ma: float | None, units: list[dict[str, object]]) -> str | None:
    if age_ma is None:
        return None
    matches = [
        unit for unit in units
        if float(unit['start_age_ma']) <= age_ma <= float(unit['end_age_ma'])
    ]
    if not matches:
        return None
    matches.sort(
        key=lambda unit: (
            -int(unit['rank_id']),
            float(unit['interval_width']),
            int(unit['rank_order']),
            int(unit['standard_sort']),
        )
    )
    return str(matches[0]['color_hex'])


def _merge_note(note: str | None, unconformity_ref: str | None) -> str | None:
    base = (note or '').strip()
    if not unconformity_ref:
        return base or None
    ref_note = f'unconformity_ref={unconformity_ref}'
    if not base:
        return ref_note
    if ref_note in base:
        return base
    return f'{base} | {ref_note}'


def _extract_note_unconformity_ref(note: str | None) -> str | None:
    if not note:
        return None
    for chunk in note.split('|'):
        chunk = chunk.strip()
        if chunk.startswith('unconformity_ref='):
            value = chunk.split('=', 1)[1].strip()
            return value or None
    return None


def _ensure_row_targets_well(row: dict[str, str], well: WellModel, csv_path: Path) -> None:
    row_well_name = _normalize_text(row.get('well_name'))
    accepted = {_normalize_text(well.name), _normalize_text(well.uwi)}
    accepted.discard('')
    if row_well_name and row_well_name not in accepted:
        raise ValueError(f'{csv_path}: row well_name {row.get("well_name")!r} does not match target well {well.name!r}')


def _validate_strictly_increasing_depth(rows: list[dict[str, str]], depth_column: str, csv_path: Path) -> list[float]:
    depths: list[float] = []
    previous = None
    for row_index, row in enumerate(rows, start=2):
        raw_value = row.get(depth_column)
        depth = _coerce_float(raw_value)
        if depth is None:
            raise ValueError(f'{csv_path}: invalid depth value at row {row_index}: {raw_value!r}')
        if previous is not None and depth <= previous:
            raise ValueError(f'{csv_path}: depth values must be strictly increasing at row {row_index}')
        depths.append(depth)
        previous = depth
    return depths


def _write_curve_payloads(
    session: Session,
    bundle_path: Path,
    well: WellModel,
    curve_payloads: list[dict[str, object]],
) -> None:
    curves_dir = bundle_path / 'curves'
    curves_dir.mkdir(parents=True, exist_ok=True)

    parquet_relative_path = f'curves/{well.id}.parquet'
    parquet_path = bundle_path / parquet_relative_path

    existing_curve_rows = list(session.scalars(select(CurveMetadata).where(CurveMetadata.well_id == well.id).order_by(CurveMetadata.id.asc())))
    frame_by_depth = pd.DataFrame(columns=['DEPT']).set_index('DEPT')
    if existing_curve_rows and parquet_path.exists():
        existing_frame = pd.read_parquet(parquet_path)
        if 'DEPT' not in existing_frame.columns:
            raise ValueError(f'Curve parquet is missing DEPT column for well: {well.id}')
        frame_by_depth = existing_frame.set_index('DEPT')

    replacement_mnemonics = {str(payload['mnemonic']) for payload in curve_payloads}
    for row in existing_curve_rows:
        if row.mnemonic in replacement_mnemonics:
            session.delete(row)

    for payload in curve_payloads:
        mnemonic = str(payload['mnemonic'])
        clean_depths = payload['depths']
        clean_values = payload['values']
        frame_by_depth[mnemonic] = pd.Series(
            clean_values,
            index=pd.Index(clean_depths, name='DEPT'),
            dtype='float32',
        )

        session.add(
            CurveMetadata(
                well_id=well.id,
                mnemonic=mnemonic,
                standard_mnemonic=payload['standard_mnemonic'],
                family_code=payload['family_code'],
                unit=str(payload['unit']),
                original_unit=(str(payload['original_unit']) or None),
                curve_type='continuous',
                depth_min=min(clean_depths),
                depth_max=max(clean_depths),
                n_samples=len(clean_depths),
                data_uri=parquet_relative_path,
                source_hash=str(payload['source_hash']),
                null_value=float(payload['null_value']),
            )
        )

    merged_frame = frame_by_depth.sort_index().reset_index()
    merged_frame['DEPT'] = pd.to_numeric(merged_frame['DEPT'], errors='coerce').astype('float32')
    table = pa.Table.from_pandas(merged_frame, preserve_index=False)
    pq.write_table(table, parquet_path, compression='snappy')
    session.flush()
