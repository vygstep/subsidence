from __future__ import annotations

from pathlib import Path

from sqlalchemy.orm import Session

from ..schema import FormationTopModel
from ..strat_link import auto_link_to_active_chart
from .common import (
    DEFAULT_WELL_KB,
    DEFAULT_WELL_NAME,
    _DEFAULT_TOP_COLOR,
    _apply_column_map,
    _ensure_row_targets_well,
    _extract_float,
    _extract_text,
    _find_existing_well_by_identity,
    _load_ics_units,
    _read_csv_rows,
    _resolve_ics_color,
    _resolve_well,
    apply_imported_well_metadata,
    create_empty_well,
    run_top_qc,
)


def _resolve_or_create_well_for_tops(
    session: Session,
    rows: list[dict[str, str]],
    well_id: str | None,
    *,
    create_new_well: bool = False,
) -> object:
    if well_id:
        return _resolve_well(session, well_id)

    first_name = _extract_text(rows[0], 'well_name') if rows else None
    if not create_new_well:
        existing = _find_existing_well_by_identity(session, name=first_name)
        if existing is not None:
            return existing
    td = max((_extract_float(row, 'depth_md', 'depth') or 0.0) for row in rows) if rows else None
    return create_empty_well(session, name=first_name or DEFAULT_WELL_NAME, td=td, kb=DEFAULT_WELL_KB)


def import_tops_csv(
    session: Session,
    well_id: str | None,
    csv_path: Path | str,
    depth_ref: str = 'MD',
    *,
    column_map: dict[str, str] | None = None,
    strat_units_path: Path | str | None = None,
    strat_ranks_path: Path | str | None = None,
    create_new_well: bool = False,
) -> tuple[list[FormationTopModel], list[str]]:
    depth_ref_upper = depth_ref.upper()
    if depth_ref_upper not in ('MD', 'TVD', 'TVDSS'):
        raise ValueError(
            f'depth_ref={depth_ref!r} is not supported; valid values: MD, TVD, TVDSS'
        )
    path = Path(csv_path)
    fieldnames, rows = _read_csv_rows(path)
    if column_map:
        fieldnames, rows = _apply_column_map(fieldnames, rows, column_map)
    required = {'top_name', 'depth_md'}
    missing = required.difference(set(fieldnames))
    if missing:
        raise ValueError(f'{path}: missing required columns: {sorted(missing)}')
    well = _resolve_or_create_well_for_tops(session, rows, well_id, create_new_well=create_new_well)
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

        boundary_type = (_extract_text(row, 'boundary_type', 'kind', 'type') or 'conformable').strip().lower()
        is_unconformity = boundary_type == 'unconformity'
        age_ma = _extract_float(row, 'age_ma', 'strat_age_ma', 'age')
        hiatus_ma = _extract_float(row, 'hiatus_duration_ma', 'hiatus_ma', 'hiatus') or 0.0
        eroded_m = _extract_float(row, 'eroded_thickness_m', 'eroded_m', 'eroded') or 0.0
        explicit_color = _extract_text(row, 'color')
        color = explicit_color or _resolve_ics_color(age_ma, ics_units) or _DEFAULT_TOP_COLOR
        note = _extract_text(row, 'note')

        qc = run_top_qc(top_name, depth_md, well.td_md)

        top = FormationTopModel(
            well_id=well.id,
            name=top_name,
            kind='unconformity' if is_unconformity else 'strat',
            depth_md=depth_md,
            depth_tvd=None,
            age_top_ma=age_ma,
            age_base_ma=None,
            confidence=None,
            color=color,
            is_locked=False,
            hiatus_duration_ma=hiatus_ma if is_unconformity else 0.0,
            eroded_thickness_m=eroded_m if is_unconformity else 0.0,
            note=note,
            qc_status=str(qc['qc_status']),
            qc_summary=str(qc['qc_summary']) if qc.get('qc_summary') else None,
        )
        session.add(top)
        auto_link_to_active_chart(session, top)
        imported.append(top)

    session.flush()

    # Collect QC warning messages
    import json as _json
    qc_warnings: list[str] = []
    for top in imported:
        if top.qc_summary:
            summary = _json.loads(top.qc_summary)
            qc_warnings.extend(summary.get('messages', []))

    return imported, qc_warnings
