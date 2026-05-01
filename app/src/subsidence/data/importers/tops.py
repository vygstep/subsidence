from __future__ import annotations

from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..schema import FormationTopModel, TopSetHorizon
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


def _top_name_key(name: str | None) -> str:
    return (name or '').strip().lower()


def _load_or_create_horizon(
    session: Session,
    top_set_id: int,
    *,
    name: str,
    kind: str,
    age_ma: float | None,
    color: str,
    sort_order: int,
    horizon_by_name: dict[str, TopSetHorizon],
) -> TopSetHorizon:
    key = _top_name_key(name)
    horizon = horizon_by_name.get(key)
    if horizon is not None:
        horizon.kind = kind
        horizon.age_ma = age_ma
        horizon.color = color
        return horizon

    horizon = TopSetHorizon(
        top_set_id=top_set_id,
        name=name.strip(),
        kind=kind,
        age_ma=age_ma,
        color=color,
        sort_order=sort_order,
        note=None,
    )
    session.add(horizon)
    session.flush()
    horizon_by_name[key] = horizon
    return horizon


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
    top_set_id: int | None = None,
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
    horizon_by_name: dict[str, TopSetHorizon] = {}
    next_horizon_sort = 0
    picks_by_horizon_id: dict[int, FormationTopModel] = {}
    unlinked_picks_by_name: dict[str, FormationTopModel] = {}
    if top_set_id is not None:
        existing_horizons = session.scalars(
            select(TopSetHorizon).where(TopSetHorizon.top_set_id == top_set_id)
        ).all()
        horizon_by_name = {_top_name_key(horizon.name): horizon for horizon in existing_horizons}
        next_horizon_sort = max((horizon.sort_order for horizon in existing_horizons), default=-1) + 1
        existing_picks = session.scalars(
            select(FormationTopModel).where(FormationTopModel.well_id == well.id)
        ).all()
        picks_by_horizon_id = {
            pick.horizon_id: pick
            for pick in existing_picks
            if pick.horizon_id is not None
        }
        unlinked_picks_by_name = {
            _top_name_key(pick.name): pick
            for pick in existing_picks
            if pick.horizon_id is None and _top_name_key(pick.name)
        }

    imported: list[FormationTopModel] = []
    for row_index, row in enumerate(rows):
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
        kind = 'unconformity' if is_unconformity else 'strat'
        horizon = None
        if top_set_id is not None:
            horizon = _load_or_create_horizon(
                session,
                top_set_id,
                name=top_name,
                kind=kind,
                age_ma=age_ma,
                color=color,
                sort_order=next_horizon_sort + row_index,
                horizon_by_name=horizon_by_name,
            )
            top = picks_by_horizon_id.get(horizon.id) or unlinked_picks_by_name.get(_top_name_key(top_name))
        else:
            top = None

        if top is None:
            top = FormationTopModel(
                well_id=well.id,
                name=top_name,
                kind=kind,
                depth_md=depth_md,
                depth_tvd=None,
                age_top_ma=age_ma,
                age_base_ma=None,
                confidence=None,
                color=color,
                is_locked=False,
            )
            session.add(top)

        top.horizon_id = horizon.id if horizon is not None else top.horizon_id
        top.name = top_name
        top.kind = kind
        top.depth_md = depth_md
        top.depth_tvd = None
        top.age_top_ma = age_ma
        top.age_base_ma = None
        top.confidence = None
        top.color = color
        top.hiatus_duration_ma = hiatus_ma if is_unconformity else 0.0
        top.eroded_thickness_m = eroded_m if is_unconformity else 0.0
        top.note = note
        top.qc_status = str(qc['qc_status'])
        top.qc_summary = str(qc['qc_summary']) if qc.get('qc_summary') else None
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
