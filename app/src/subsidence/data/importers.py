from __future__ import annotations

import csv
import hashlib
import json
import math
from pathlib import Path
from uuid import uuid4

import lasio
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from sqlalchemy import select
from sqlalchemy.orm import Session

from .dict_resolver import load_curve_alias_rules, resolve_curve_alias
from .schema import CurveMetadata, DeviationSurveyModel, FormationTopModel, WellModel
from .unit_conversion import canonicalize_gamma_unit, convert_curve_units, convert_depth_to_meters, normalize_unit_name

_DEPTH_MNEMONICS = {'DEPT', 'DEPTH', 'MD', 'TVD', 'TVDSS'}
_DEFAULT_TOP_COLOR = '#4b5563'
DEFAULT_WELL_NAME = 'well-1'
DEFAULT_WELL_X = 0.0
DEFAULT_WELL_Y = 0.0
DEFAULT_WELL_KB = 10.0
DEFAULT_WELL_CRS = 'unset'


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


def _normalize_well_name(name: str | None) -> str:
    value = (name or '').strip()
    return value or DEFAULT_WELL_NAME


def _normalized_crs(crs: str | None) -> str:
    value = (crs or '').strip()
    return value or DEFAULT_WELL_CRS


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


def _well_metadata_from_las(las: lasio.LASFile, original_relative_path: str, *, final_depth: float | None) -> dict[str, object]:
    return {
        'uwi': _header_text(las, 'UWI'),
        'name': _header_text(las, 'WELL') or _header_text(las, 'ORIGINALWELLNAME') or DEFAULT_WELL_NAME,
        'kb': _header_float(las, 'EREF', DEFAULT_WELL_KB) or DEFAULT_WELL_KB,
        'td': _header_float(las, 'TD', final_depth) or final_depth,
        'y': _header_float(las, 'SLAT') or _header_float(las, 'LATI'),
        'x': _header_float(las, 'SLON') or _header_float(las, 'LONG'),
        'crs': _header_text(las, 'HZCS') or DEFAULT_WELL_CRS,
        'source_las_path': original_relative_path,
        'extra': {
            'company': _header_text(las, 'COMP'),
            'field': _header_text(las, 'FLD'),
            'location': _header_text(las, 'LOC'),
            'api': _header_text(las, 'API'),
            'country': _header_text(las, 'COUNTRY') or _header_text(las, 'CTRY'),
            'original_well_name': _header_text(las, 'ORIGINALWELLNAME'),
        },
    }


def _read_csv_rows(path: Path | str) -> tuple[list[str], list[dict[str, str]]]:
    csv_path = Path(path)
    with csv_path.open('r', encoding='utf-8-sig', newline='') as handle:
        sample = handle.read(4096)
        handle.seek(0)
        delimiter = ','
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=',;')
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
    return Path(__file__).resolve().parents[4] / 'sample_data'


def _default_ics_paths() -> tuple[Path, Path]:
    sample_dir = _repo_sample_data_dir()
    return sample_dir / 'ics_chart2023_units.csv', sample_dir / 'ics_chart2023_ranks.csv'


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


def _resolve_well(session: Session, well_id: str) -> WellModel:
    well = session.get(WellModel, well_id)
    if well is None:
        raise ValueError(f'Well not found: {well_id}')
    return well


def _resolve_or_create_well_for_tops(session: Session, rows: list[dict[str, str]], well_id: str | None) -> WellModel:
    if well_id:
        return _resolve_well(session, well_id)

    first_name = _extract_text(rows[0], 'well_name') if rows else None
    td = max((_extract_float(row, 'depth_md', 'depth') or 0.0) for row in rows) if rows else None
    return create_empty_well(session, name=first_name or DEFAULT_WELL_NAME, td=td, kb=DEFAULT_WELL_KB)


def _resolve_or_create_well_for_deviation(
    session: Session,
    rows: list[dict[str, str]],
    depth_column: str,
    well_id: str | None,
) -> WellModel:
    if well_id:
        return _resolve_well(session, well_id)

    first_name = _extract_text(rows[0], 'well_name', 'well', 'well_name_header') if rows else None
    td = _coerce_float(rows[-1].get(depth_column)) if rows else None
    return create_empty_well(session, name=first_name or DEFAULT_WELL_NAME, td=td, kb=DEFAULT_WELL_KB)


def _ensure_row_targets_well(row: dict[str, str], well: WellModel, csv_path: Path) -> None:
    row_well_name = _normalize_text(row.get('well_name'))
    accepted = {_normalize_text(well.name), _normalize_text(well.uwi)}
    accepted.discard('')
    if row_well_name and row_well_name not in accepted:
        raise ValueError(f'{csv_path}: row well_name {row.get("well_name")!r} does not match target well {well.name!r}')


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


_DEVIATION_MODE_COLUMNS = {
    'INCL_AZIM': ('incl_deg', 'azim_deg'),
    'X_Y': ('x', 'y'),
    'DX_DY': ('dx', 'dy'),
}


def _detect_deviation_reference(fieldnames: list[str]) -> tuple[str, str]:
    normalized = {name.strip().casefold(): name for name in fieldnames}
    if 'md' in normalized:
        return 'MD', normalized['md']
    if 'tvdss' in normalized:
        return 'TVDSS', normalized['tvdss']
    if 'tvd' in normalized:
        return 'TVD', normalized['tvd']
    raise ValueError('Deviation CSV must contain one depth column: md, tvd, or tvdss')


def _detect_deviation_mode(fieldnames: list[str]) -> tuple[str, tuple[str, str]]:
    normalized = {name.strip().casefold() for name in fieldnames}
    if {'incl_deg', 'azim_deg'} <= normalized:
        return 'INCL_AZIM', ('incl_deg', 'azim_deg')
    if {'x', 'y'} <= normalized:
        return 'X_Y', ('x', 'y')
    if {'dx', 'dy'} <= normalized:
        return 'DX_DY', ('dx', 'dy')
    raise ValueError('Deviation CSV must contain incl_deg/azim_deg, x/y, or dx/dy columns')


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


def import_las_file(
    session: Session,
    project_path: Path | str,
    las_path: Path | str,
    *,
    well_id: str | None = None,
) -> WellModel:
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
    final_depth = max(depth_values) if depth_values else None
    null_value = _coerce_float(getattr(las.well.get('NULL'), 'value', None))
    rules = load_curve_alias_rules(session)
    metadata = _well_metadata_from_las(las, original_relative_path, final_depth=final_depth)
    if well_id:
        well = _resolve_well(session, well_id)
        apply_imported_well_metadata(
            well,
            name=metadata['name'],
            uwi=metadata['uwi'],
            x=metadata['x'],
            y=metadata['y'],
            kb=metadata['kb'],
            td=metadata['td'],
            crs=metadata['crs'],
            source_las_path=metadata['source_las_path'],
            extra=metadata['extra'],
        )
    else:
        well = create_empty_well(
            session,
            name=str(metadata['name']),
            uwi=metadata['uwi'] if isinstance(metadata['uwi'], str) else None,
            x=metadata['x'] if isinstance(metadata['x'], (int, float)) else None,
            y=metadata['y'] if isinstance(metadata['y'], (int, float)) else None,
            kb=metadata['kb'] if isinstance(metadata['kb'], (int, float)) else None,
            td=metadata['td'] if isinstance(metadata['td'], (int, float)) else None,
            crs=str(metadata['crs']),
            source_las_path=str(metadata['source_las_path']),
            extra=metadata['extra'] if isinstance(metadata['extra'], dict) else None,
        )

    curve_series: dict[str, pd.Series] = {}
    parquet_relative_path = f'curves/{well.id}.parquet'

    for curve in las.curves:
        mnemonic = curve.mnemonic.strip()
        if mnemonic.upper() in _DEPTH_MNEMONICS:
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
                null_value=null_value if null_value is not None else -999.25,
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


def import_tops_csv(
    session: Session,
    well_id: str | None,
    csv_path: Path | str,
    depth_ref: str = 'MD',
    *,
    strat_units_path: Path | str | None = None,
    strat_ranks_path: Path | str | None = None,
) -> list[FormationTopModel]:
    if depth_ref.upper() not in ('MD',):
        raise NotImplementedError(
            f'depth_ref={depth_ref!r} is not yet supported; only MD is implemented'
        )
    path = Path(csv_path)
    fieldnames, rows = _read_csv_rows(path)
    required = {'top_name', 'depth_md'}
    missing = required.difference(set(fieldnames))
    if missing:
        raise ValueError(f'{path}: missing required columns: {sorted(missing)}')
    well = _resolve_or_create_well_for_tops(session, rows, well_id)
    max_depth = max((_extract_float(row, 'depth_md', 'depth') or 0.0) for row in rows) if rows else None
    if max_depth is not None:
        apply_imported_well_metadata(well, td=max_depth)

    ics_units = _load_ics_units(Path(strat_units_path) if strat_units_path else None, Path(strat_ranks_path) if strat_ranks_path else None)
    imported: list[FormationTopModel] = []
    for row in rows:
        _ensure_row_targets_well(row, well, path)
        top_name = _extract_text(row, 'top_name')
        depth_md = _extract_float(row, 'depth_md', 'depth')
        if top_name is None or depth_md is None:
            raise ValueError(f'{path}: top_name and depth_md are required')

        boundary_type = (_extract_text(row, 'boundary_type') or 'conformable').strip().lower()
        is_unconformity = boundary_type == 'unconformity'
        strat_age = _extract_float(row, 'strat_age_ma')
        explicit_color = _extract_text(row, 'color')
        color = explicit_color or _resolve_ics_color(strat_age, ics_units) or _DEFAULT_TOP_COLOR
        note = _merge_note(_extract_text(row, 'note'), _extract_text(row, 'unconformity_ref'))

        top = FormationTopModel(
            well_id=well.id,
            name=top_name,
            kind='unconformity' if is_unconformity else 'strat',
            depth_md=depth_md,
            depth_tvd=None,
            age_top_ma=None if is_unconformity else strat_age,
            age_base_ma=None,
            confidence=None,
            color=color,
            is_locked=False,
            note=note,
        )
        session.add(top)
        imported.append(top)

    session.flush()
    return imported


def import_unconformities_csv(
    session: Session,
    well_id: str,
    csv_path: Path | str,
    *,
    strat_units_path: Path | str | None = None,
    strat_ranks_path: Path | str | None = None,
) -> list[FormationTopModel]:
    well = _resolve_well(session, well_id)
    path = Path(csv_path)
    fieldnames, rows = _read_csv_rows(path)
    required = {'well_name', 'unc_name', 'depth_md', 'end_age_ma', 'start_age_ma'}
    missing = required.difference(set(fieldnames))
    if missing:
        raise ValueError(f'{path}: missing required columns: {sorted(missing)}')

    existing = session.scalars(
        select(FormationTopModel).where(
            FormationTopModel.well_id == well.id,
            FormationTopModel.kind == 'unconformity',
        )
    ).all()
    by_name = {_normalize_text(row.name): row for row in existing}
    ics_units = _load_ics_units(Path(strat_units_path) if strat_units_path else None, Path(strat_ranks_path) if strat_ranks_path else None)

    imported_or_updated: list[FormationTopModel] = []
    for row in rows:
        _ensure_row_targets_well(row, well, path)
        unc_name = _extract_text(row, 'unc_name')
        depth_md = _extract_float(row, 'depth_md', 'md')
        younger_age = _extract_float(row, 'end_age_ma')
        older_age = _extract_float(row, 'start_age_ma', 'base_age_ma')
        if unc_name is None or depth_md is None or younger_age is None or older_age is None:
            raise ValueError(f'{path}: unconformity rows require unc_name, depth_md, end_age_ma, start_age_ma')
        if older_age < younger_age:
            raise ValueError(f'{path}: start_age_ma must be >= end_age_ma for unconformity {unc_name!r}')

        explicit_color = _extract_text(row, 'color')
        color = explicit_color or _resolve_ics_color(younger_age, ics_units) or _DEFAULT_TOP_COLOR
        note = _merge_note(_extract_text(row, 'note'), unc_name)
        target = by_name.get(_normalize_text(unc_name))
        if target is None:
            target = FormationTopModel(
                well_id=well.id,
                name=unc_name,
                kind='unconformity',
                depth_md=depth_md,
                depth_tvd=None,
                age_top_ma=younger_age,
                age_base_ma=older_age,
                confidence=None,
                color=color,
                is_locked=False,
                note=note,
            )
            session.add(target)
            by_name[_normalize_text(unc_name)] = target
        else:
            target.depth_md = depth_md
            target.age_top_ma = younger_age
            target.age_base_ma = older_age
            target.color = color
            target.note = note
        imported_or_updated.append(target)

    session.flush()
    return imported_or_updated


def link_tops_to_unconformities(
    session: Session,
    well_id: str,
    *,
    depth_tolerance_m: float = 0.1,
) -> list[FormationTopModel]:
    tops = session.scalars(
        select(FormationTopModel).where(FormationTopModel.well_id == well_id).order_by(FormationTopModel.depth_md)
    ).all()
    unconformities = [top for top in tops if top.kind == 'unconformity']
    updated: list[FormationTopModel] = []

    for top in tops:
        if top.kind != 'strat':
            continue
        if _extract_note_unconformity_ref(top.note):
            continue

        nearest = None
        nearest_delta = None
        for unconformity in unconformities:
            delta = abs(top.depth_md - unconformity.depth_md)
            if delta <= depth_tolerance_m and (nearest_delta is None or delta < nearest_delta):
                nearest = unconformity
                nearest_delta = delta

        if nearest is not None:
            top.note = _merge_note(top.note, nearest.name)
            updated.append(top)

    session.flush()
    return updated

def import_deviation_csv(session: Session, project_path: Path | str, well_id: str | None, csv_path: Path | str) -> DeviationSurveyModel:
    bundle_path = Path(project_path)
    path = Path(csv_path)
    deviation_dir = bundle_path / 'deviation'
    deviation_dir.mkdir(parents=True, exist_ok=True)

    fieldnames, rows = _read_csv_rows(path)
    if not rows:
        raise ValueError(f'{path}: deviation CSV is empty')

    reference, depth_column = _detect_deviation_reference(fieldnames)
    mode, value_columns = _detect_deviation_mode(fieldnames)
    depths = _validate_strictly_increasing_depth(rows, depth_column, path)
    well = _resolve_or_create_well_for_deviation(session, rows, depth_column, well_id)
    if depths:
        apply_imported_well_metadata(well, td=depths[-1])

    frame_data: dict[str, list[float]] = {depth_column: depths}
    for column in value_columns:
        values: list[float] = []
        for row_index, row in enumerate(rows, start=2):
            raw_value = row.get(column)
            value = _coerce_float(raw_value)
            if value is None:
                raise ValueError(f'{path}: invalid {column} value at row {row_index}: {raw_value!r}')
            values.append(value)
        frame_data[column] = values

    frame = pd.DataFrame(frame_data)
    for column in frame.columns:
        frame[column] = frame[column].astype('float32')

    relative_path = f'deviation/{well.id}__deviation.parquet'
    parquet_path = bundle_path / relative_path
    table = pa.Table.from_pandas(frame, preserve_index=False)
    pq.write_table(table, parquet_path, compression='snappy')
    source_hash = _sha256(path)

    survey = session.scalar(select(DeviationSurveyModel).where(DeviationSurveyModel.well_id == well.id))
    if survey is None:
        survey = DeviationSurveyModel(
            well_id=well.id,
            reference=reference,
            mode=mode,
            data_uri=relative_path,
            source_hash=source_hash,
        )
        session.add(survey)
    else:
        survey.reference = reference
        survey.mode = mode
        survey.data_uri = relative_path
        survey.source_hash = source_hash

    session.flush()
    return survey
