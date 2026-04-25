from __future__ import annotations

import math
import re
from pathlib import Path

from sqlalchemy.orm import Session

from ..dict_resolver import load_curve_alias_rules, resolve_curve_alias_with_unit
from ..unit_registry import convert_curve_values_to_target, convert_depth_values_to_meters
from .common import (
    DEFAULT_WELL_KB,
    DEFAULT_WELL_NAME,
    _CSV_EXCLUDED_COLUMNS,
    _DEPTH_MNEMONICS,
    _coerce_float,
    _extract_text,
    _find_existing_well_by_identity,
    _read_csv_rows,
    _resolve_well,
    _sha256,
    _validate_strictly_increasing_depth,
    _write_curve_payloads,
    apply_imported_well_metadata,
    create_empty_well,
)


def _header_curve_parts(column_name: str) -> tuple[str, str]:
    raw = column_name.strip()
    if not raw:
        return '', ''

    bracket_match = re.match(r'^(?P<mnemonic>.+?)\s*\[(?P<unit>[^\]]+)\]\s*$', raw)
    if bracket_match:
        return bracket_match.group('mnemonic').strip(), bracket_match.group('unit').strip()

    paren_match = re.match(r'^(?P<mnemonic>.+?)\s*\((?P<unit>[^)]+)\)\s*$', raw)
    if paren_match:
        return paren_match.group('mnemonic').strip(), paren_match.group('unit').strip()

    return raw, ''


def _detect_log_csv_depth_column(fieldnames: list[str], explicit_depth_column: str | None = None) -> str:
    if explicit_depth_column:
        candidate = explicit_depth_column.strip()
        if candidate in fieldnames:
            return candidate
        lowered = candidate.casefold()
        for field in fieldnames:
            mnemonic, _unit = _header_curve_parts(field)
            if field.casefold() == lowered or mnemonic.casefold() == lowered:
                return field
        raise ValueError(f'CSV log file is missing explicit depth column: {explicit_depth_column}')

    for mnemonic in _DEPTH_MNEMONICS:
        lowered = mnemonic.casefold()
        for field in fieldnames:
            parsed_mnemonic, _unit = _header_curve_parts(field)
            if field.casefold() == lowered or parsed_mnemonic.casefold() == lowered:
                return field
    raise ValueError('CSV log file must contain a depth column: DEPT, DEPTH, MD, TVD, or TVDSS')


def _resolve_or_create_well_for_logs(
    session: Session,
    rows: list[dict[str, str]],
    *,
    well_id: str | None,
    td: float | None,
    create_new_well: bool = False,
) -> object:
    if well_id:
        return _resolve_well(session, well_id)

    first_name = _extract_text(rows[0], 'well_name') if rows else None
    if not create_new_well:
        existing = _find_existing_well_by_identity(session, name=first_name)
        if existing is not None:
            return existing
    return create_empty_well(session, name=first_name or DEFAULT_WELL_NAME, td=td, kb=DEFAULT_WELL_KB)


def import_logs_csv(
    session: Session,
    project_path: Path | str,
    csv_path: Path | str,
    *,
    well_id: str | None = None,
    depth_column: str | None = None,
    create_new_well: bool = False,
) -> object:
    bundle_path = Path(project_path)
    source_path = Path(csv_path)
    source_hash = _sha256(source_path)
    fieldnames, rows = _read_csv_rows(source_path)
    if not rows:
        raise ValueError(f'{source_path}: log CSV is empty')

    resolved_depth_column = _detect_log_csv_depth_column(fieldnames, depth_column)
    raw_depths = _validate_strictly_increasing_depth(rows, resolved_depth_column, source_path)
    _depth_mnemonic, depth_unit = _header_curve_parts(resolved_depth_column)
    depths = convert_depth_values_to_meters(session, raw_depths, depth_unit or 'm')
    final_depth = depths[-1] if depths else None
    well = _resolve_or_create_well_for_logs(session, rows, well_id=well_id, td=final_depth, create_new_well=create_new_well)
    apply_imported_well_metadata(well, td=final_depth)

    rules = load_curve_alias_rules(session)
    curve_columns = [
        column for column in fieldnames
        if column != resolved_depth_column and column.casefold() not in _CSV_EXCLUDED_COLUMNS
    ]

    curve_payloads: list[dict[str, object]] = []
    for column in curve_columns:
        mnemonic, source_unit = _header_curve_parts(column)
        if not mnemonic or mnemonic.upper() in _DEPTH_MNEMONICS:
            continue

        clean_pairs: dict[float, float] = {}
        for row_index, (depth, row) in enumerate(zip(depths, rows, strict=False), start=2):
            raw_value = row.get(column)
            if raw_value in (None, ''):
                continue
            value = _coerce_float(raw_value)
            if value is None:
                raise ValueError(f'{source_path}: invalid curve value in column {column!r} at row {row_index}: {raw_value!r}')
            if math.isfinite(value):
                clean_pairs[depth] = value

        if len(clean_pairs) < 2:
            continue

        clean_depths = sorted(clean_pairs)
        clean_values = [clean_pairs[depth] for depth in clean_depths]
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

        curve_payloads.append({
            'mnemonic': mnemonic,
            'standard_mnemonic': standard_mnemonic,
            'family_code': family_code,
            'unit': target_unit,
            'original_unit': source_unit,
            'depths': clean_depths,
            'values': values,
            'source_hash': source_hash,
            'null_value': -999.25,
        })

    if not curve_payloads:
        raise ValueError(f'No importable curves were found in CSV file: {source_path}')

    _write_curve_payloads(session, bundle_path, well, curve_payloads)
    return well
