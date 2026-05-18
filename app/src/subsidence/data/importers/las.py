from __future__ import annotations

from pathlib import Path

import lasio
from sqlalchemy.orm import Session

from ..dict_resolver import load_curve_alias_rules, resolve_curve_alias_with_unit
from ..deviation_transform import tvd_to_md
from ..unit_registry import convert_curve_values_to_target, convert_depth_values_to_meters
from .common import (
    DEFAULT_WELL_CRS,
    DEFAULT_WELL_KB,
    DEFAULT_WELL_NAME,
    DEFAULT_WELL_X,
    DEFAULT_WELL_Y,
    _DEPTH_MNEMONICS,
    _coerce_float,
    _find_existing_well_by_identity,
    _is_valid_sample,
    _resolve_well,
    _sha256,
    _write_curve_payloads,
    apply_imported_well_metadata,
    create_empty_well,
    extend_well_td_for_import,
    run_curve_qc,
)
from .log_resampling import build_md_grid, convert_source_depths_to_md, resample_curve_to_md_grid

_LAS_CORE_WELL_HEADERS = {
    'WELL',
    'UWI',
    'EREF',
    'KB',
    'TD',
    'SLAT',
    'LATI',
    'SLON',
    'LONG',
    'HZCS',
    'NULL',
}

_LAS_EXTRA_ALIASES = {
    'COMP': 'company',
    'FLD': 'field',
    'LOC': 'location',
    'API': 'api',
    'COUNTRY': 'country',
    'CTRY': 'country',
    'ORIGINALWELLNAME': 'original_well_name',
}


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


def _las_well_header_extra(las: lasio.LASFile) -> dict[str, object]:
    extra: dict[str, object] = {}
    for item in las.well:
        mnemonic = str(getattr(item, 'mnemonic', '') or '').strip()
        if not mnemonic:
            continue
        value = str(getattr(item, 'value', '') or '').strip()
        if not value:
            continue
        normalized = mnemonic.upper()
        if normalized in _LAS_CORE_WELL_HEADERS:
            continue
        key = _LAS_EXTRA_ALIASES.get(normalized, mnemonic.strip().lower())
        extra[key] = value
    return extra


def _well_metadata_from_las(las: lasio.LASFile, original_relative_path: str, *, final_depth: float | None) -> dict[str, object]:
    extra = _las_well_header_extra(las)
    extra = {
        **extra,
        'company': _header_text(las, 'COMP') or extra.get('company'),
        'field': _header_text(las, 'FLD') or extra.get('field'),
        'location': _header_text(las, 'LOC') or extra.get('location'),
        'api': _header_text(las, 'API') or extra.get('api'),
        'country': _header_text(las, 'COUNTRY') or _header_text(las, 'CTRY') or extra.get('country'),
        'original_well_name': _header_text(las, 'ORIGINALWELLNAME') or extra.get('original_well_name'),
    }
    extra = {key: value for key, value in extra.items() if value not in (None, '')}
    return {
        'uwi': _header_text(las, 'UWI'),
        'name': _header_text(las, 'WELL') or _header_text(las, 'ORIGINALWELLNAME') or DEFAULT_WELL_NAME,
        'kb': _header_float(las, 'EREF') or _header_float(las, 'KB') or DEFAULT_WELL_KB,
        'td': _header_float(las, 'TD', final_depth) or final_depth,
        'y': _header_float(las, 'SLAT') or _header_float(las, 'LATI'),
        'x': _header_float(las, 'SLON') or _header_float(las, 'LONG'),
        'crs': _header_text(las, 'HZCS') or DEFAULT_WELL_CRS,
        'source_las_path': original_relative_path,
        'extra': extra,
    }


def import_las_file(
    session: Session,
    project_path: Path | str,
    las_path: Path | str,
    *,
    well_id: str | None = None,
    create_new_well: bool = False,
    trusted_depth_reference: str = 'MD',
    null_value_override: float | None = None,
    curve_types: dict[str, str] | None = None,
) -> tuple[object, list[str], float | None]:
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
    depth_values = convert_depth_values_to_meters(session, [float(value) for value in las.index], depth_unit)
    final_depth = max(depth_values) if depth_values else None
    header_null_value = _coerce_float(getattr(las.well.get('NULL'), 'value', None))
    null_value = null_value_override if null_value_override is not None else header_null_value
    rules = load_curve_alias_rules(session)
    metadata = _well_metadata_from_las(las, original_relative_path, final_depth=final_depth)
    td_before_import: float | None = None
    if well_id:
        well = _resolve_well(session, well_id)
        td_before_import = well.td_md
    elif not create_new_well:
        well = _find_existing_well_by_identity(
            session,
            name=str(metadata['name']),
            uwi=metadata['uwi'] if isinstance(metadata['uwi'], str) else None,
        )
        if well is None:
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
        else:
            td_before_import = well.td_md
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
    if well_id:
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
    converter = (lambda tvd: tvd_to_md(tvd, bundle_path, well)) if well.deviation_survey is not None else None
    depth_conversion = convert_source_depths_to_md(
        depth_values,
        depth_reference=trusted_depth_reference,
        kb_elev=well.kb_elev,
        tvd_to_md=converter,
    )
    depth_values_md = depth_conversion.depths_md
    final_depth_md = max(depth_values_md) if depth_values_md else final_depth
    td_warning = extend_well_td_for_import(well, final_depth_md, previous_td=td_before_import)
    grid = build_md_grid(float(well.td_md or final_depth_md or 0.0), float(well.log_md_grid_step_m or 0.2))
    curve_payloads: list[dict[str, object]] = []

    for curve in las.curves:
        mnemonic = curve.mnemonic.strip()
        if mnemonic.upper() in _DEPTH_MNEMONICS:
            continue

        raw_values = [float(value) for value in las[curve.mnemonic]]
        native_values: list[float | None] = [
            value if _is_valid_sample(depth, value, null_value) else None
            for depth, value in zip(depth_values_md, raw_values, strict=False)
        ]

        if sum(1 for value in native_values if value is not None) < 2:
            continue
        source_unit = (curve.unit or '').strip()
        match = resolve_curve_alias_with_unit(session, mnemonic, source_unit, rules)
        family_code = match.family_code
        standard_mnemonic = match.canonical_mnemonic
        target_unit = match.canonical_unit or source_unit

        values = [value for value in native_values]
        if source_unit and target_unit:
            try:
                valid_values_for_conversion = [value for value in values if value is not None]
                converted_values, target_unit = convert_curve_values_to_target(
                    session,
                    valid_values_for_conversion,
                    source_unit,
                    target_unit,
                    family_code,
                )
                converted_iter = iter(converted_values)
                values = [next(converted_iter) if value is not None else None for value in values]
            except ValueError:
                target_unit = source_unit

        curve_type = (curve_types or {}).get(mnemonic, 'continuous')
        if curve_type not in ('continuous', 'discrete'):
            curve_type = 'continuous'
        resampled = resample_curve_to_md_grid(
            grid,
            depth_values_md,
            values,
            curve_type=curve_type,
        )
        if resampled.valid_sample_count < 2:
            continue
        sampling_kind, nominal_step_m = 'CONSTANT', float(well.log_md_grid_step_m or 0.2)
        survey_max_md = None  # no survey context in LAS importer; checked post-import
        valid_depths = [depth for depth, value in zip(resampled.depths, resampled.values, strict=False) if value is not None]
        valid_values = [value for value in resampled.values if value is not None]
        qc = run_curve_qc(valid_depths, valid_values, mnemonic, well.td_md, survey_max_md)

        curve_payloads.append({
            'mnemonic': mnemonic,
            'standard_mnemonic': standard_mnemonic,
            'family_code': family_code,
            'unit': target_unit,
            'original_unit': source_unit,
            'depths': resampled.depths,
            'values': resampled.values,
            'source_hash': source_hash,
            'null_value': null_value if null_value is not None else -999.25,
            'curve_type': curve_type,
            'trusted_depth_reference': 'MD',
            'sampling_kind': sampling_kind,
            'nominal_step_m': nominal_step_m,
            'qc_status': qc['qc_status'],
            'qc_summary': qc['qc_summary'],
        })

    if not curve_payloads:
        raise ValueError(f'No importable curves were found in LAS file: {source_path}')

    _write_curve_payloads(session, bundle_path, well, curve_payloads)

    # Collect all unique warning messages from QC summaries
    qc_warnings: list[str] = []
    if depth_conversion.warning is not None:
        qc_warnings.append(depth_conversion.warning)
    if td_warning is not None:
        qc_warnings.append(td_warning)
    for p in curve_payloads:
        if p.get('qc_summary'):
            import json as _json
            summary = _json.loads(str(p['qc_summary']))
            qc_warnings.extend(summary.get('messages', []))

    return well, qc_warnings, final_depth_md
