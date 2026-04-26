from __future__ import annotations

from pathlib import Path

import lasio
from sqlalchemy.orm import Session

from ..dict_resolver import load_curve_alias_rules, resolve_curve_alias_with_unit
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
    compute_sampling_kind,
    create_empty_well,
    run_curve_qc,
)


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


def import_las_file(
    session: Session,
    project_path: Path | str,
    las_path: Path | str,
    *,
    well_id: str | None = None,
    create_new_well: bool = False,
    trusted_depth_reference: str = 'MD',
) -> tuple[object, list[str]]:
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
    null_value = _coerce_float(getattr(las.well.get('NULL'), 'value', None))
    rules = load_curve_alias_rules(session)
    metadata = _well_metadata_from_las(las, original_relative_path, final_depth=final_depth)
    if well_id:
        well = _resolve_well(session, well_id)
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
    curve_payloads: list[dict[str, object]] = []

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
        match = resolve_curve_alias_with_unit(session, mnemonic, source_unit, rules)
        family_code = match.family_code
        standard_mnemonic = match.canonical_mnemonic
        target_unit = match.canonical_unit or source_unit

        values = clean_values
        if source_unit and target_unit:
            try:
                values, target_unit = convert_curve_values_to_target(
                    session,
                    values,
                    source_unit,
                    target_unit,
                    family_code,
                )
            except ValueError:
                target_unit = source_unit

        sampling_kind, nominal_step_m = compute_sampling_kind(clean_depths)
        survey_max_md = None  # no survey context in LAS importer; checked post-import
        qc = run_curve_qc(clean_depths, values, mnemonic, well.td_md, survey_max_md)

        curve_payloads.append({
            'mnemonic': mnemonic,
            'standard_mnemonic': standard_mnemonic,
            'family_code': family_code,
            'unit': target_unit,
            'original_unit': source_unit,
            'depths': clean_depths,
            'values': values,
            'source_hash': source_hash,
            'null_value': null_value if null_value is not None else -999.25,
            'trusted_depth_reference': trusted_depth_reference,
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
    for p in curve_payloads:
        if p.get('qc_summary'):
            import json as _json
            summary = _json.loads(str(p['qc_summary']))
            qc_warnings.extend(summary.get('messages', []))

    return well, qc_warnings
