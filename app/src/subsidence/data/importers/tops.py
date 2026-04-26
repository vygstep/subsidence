from __future__ import annotations

from pathlib import Path

from sqlalchemy import select
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
    _extract_note_unconformity_ref,
    _extract_text,
    _find_existing_well_by_identity,
    _load_ics_units,
    _merge_note,
    _normalize_text,
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

        boundary_type = (_extract_text(row, 'boundary_type') or 'conformable').strip().lower()
        is_unconformity = boundary_type == 'unconformity'
        strat_age = _extract_float(row, 'strat_age_ma')
        explicit_color = _extract_text(row, 'color')
        color = explicit_color or _resolve_ics_color(strat_age, ics_units) or _DEFAULT_TOP_COLOR
        note = _merge_note(_extract_text(row, 'note'), _extract_text(row, 'unconformity_ref'))

        qc = run_top_qc(top_name, depth_md, well.td_md)

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


def import_unconformities_csv(
    session: Session,
    well_id: str,
    csv_path: Path | str,
    *,
    column_map: dict[str, str] | None = None,
    strat_units_path: Path | str | None = None,
    strat_ranks_path: Path | str | None = None,
) -> list[FormationTopModel]:
    well = _resolve_well(session, well_id)
    path = Path(csv_path)
    fieldnames, rows = _read_csv_rows(path)
    if column_map:
        fieldnames, rows = _apply_column_map(fieldnames, rows, column_map)
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
            auto_link_to_active_chart(session, target)
        else:
            target.depth_md = depth_md
            target.age_top_ma = younger_age
            target.age_base_ma = older_age
            target.color = color
            target.note = note
            auto_link_to_active_chart(session, target)
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
