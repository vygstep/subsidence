from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from subsidence.data.deviation_transform import recalculate_picks_tvd
from subsidence.data.schema import (
    FormationTopModel,
    TopSet,
    TopSetHorizon,
    WellActiveTopSet,
    WellModel,
)
from subsidence.data.zone_service import (
    aggregate_zone_lithology_from_curve,
    ensure_zone_well_data,
    merge_zones_on_horizon_delete,
    rebuild_zones_for_top_set,
    recalculate_zone_thickness,
)

router = APIRouter(tags=['top-sets'])


class TopSetCreate(BaseModel):
    name: str
    description: str | None = None


class TopSetPatch(BaseModel):
    name: str | None = None
    description: str | None = None


class HorizonCreate(BaseModel):
    name: str
    kind: str = 'strat'
    age_ma: float | None = None
    color: str = '#90a4ae'
    note: str | None = None


class HorizonPatch(BaseModel):
    name: str | None = None
    kind: str | None = None
    age_ma: float | None = None
    color: str | None = None
    note: str | None = None


class HorizonReorderRequest(BaseModel):
    horizon_ids: list[int]


class ActiveTopSetRequest(BaseModel):
    top_set_id: int


class HorizonResponse(BaseModel):
    id: int
    name: str
    kind: str
    age_ma: float | None
    color: str
    sort_order: int
    note: str | None


class TopSetSummary(BaseModel):
    id: int
    name: str
    description: str | None
    horizon_count: int


class TopSetDetail(BaseModel):
    id: int
    name: str
    description: str | None
    horizons: list[HorizonResponse]


class ActiveTopSetResponse(BaseModel):
    well_id: str
    top_set_id: int


class RecalculateTvdResponse(BaseModel):
    updated_count: int


def _manager(request: Request):
    return request.app.state.project_manager


def _require_open_project(request: Request):
    manager = _manager(request)
    if not manager.is_open:
        raise HTTPException(status_code=400, detail='No project is currently open')
    return manager


def _load_top_set(session, top_set_id: int) -> TopSet | None:
    return session.scalar(
        select(TopSet)
        .where(TopSet.id == top_set_id)
        .options(selectinload(TopSet.horizons))
    )


def _top_set_detail(ts: TopSet) -> TopSetDetail:
    return TopSetDetail(
        id=ts.id,
        name=ts.name,
        description=ts.description,
        horizons=[_horizon_to_response(h) for h in ts.horizons],
    )


def _horizon_to_response(h: TopSetHorizon) -> HorizonResponse:
    return HorizonResponse(
        id=h.id,
        name=h.name,
        kind=h.kind,
        age_ma=h.age_ma,
        color=h.color,
        sort_order=h.sort_order,
        note=h.note,
    )


def _linked_well_ids(session, top_set_id: int) -> list[str]:
    return [
        row.well_id
        for row in session.scalars(
            select(WellActiveTopSet).where(WellActiveTopSet.top_set_id == top_set_id)
        ).all()
    ]


def _require_top_set(session, top_set_id: int) -> TopSet:
    ts = _load_top_set(session, top_set_id)
    if ts is None:
        raise HTTPException(status_code=404, detail=f'TopSet not found: {top_set_id}')
    return ts


def _require_well(session, well_id: str) -> WellModel:
    well = session.get(WellModel, well_id)
    if well is None:
        raise HTTPException(status_code=404, detail=f'Well not found: {well_id}')
    return well


def _link_picks_to_horizons(session, well_id: str, top_set_id: int) -> int:
    """For each horizon in the TopSet, find picks with matching name and set horizon_id."""
    horizons = session.scalars(
        select(TopSetHorizon).where(TopSetHorizon.top_set_id == top_set_id)
    ).all()
    horizon_by_name = {h.name.lower(): h for h in horizons}
    if not horizon_by_name:
        return 0

    picks = session.scalars(
        select(FormationTopModel).where(FormationTopModel.well_id == well_id)
    ).all()
    linked = 0
    for pick in picks:
        h = horizon_by_name.get(pick.name.lower())
        if h is not None and pick.horizon_id != h.id:
            pick.horizon_id = h.id
            linked += 1
    session.flush()
    return linked


def _create_ghost_picks(session, well_id: str, top_set_id: int) -> int:
    """Create unset picks (depth_md=None) for horizons with no matching pick in the well."""
    horizons = session.scalars(
        select(TopSetHorizon).where(TopSetHorizon.top_set_id == top_set_id)
    ).all()
    existing_by_name = {
        p.name.lower()
        for p in session.scalars(
            select(FormationTopModel).where(FormationTopModel.well_id == well_id)
        ).all()
    }
    created = 0
    for h in horizons:
        if h.name.lower() not in existing_by_name:
            pick = FormationTopModel(
                well_id=well_id,
                horizon_id=h.id,
                name=h.name,
                kind=h.kind,
                depth_md=None,
                depth_tvd=None,
                depth_tvdss=None,
                color=h.color,
                age_top_ma=h.age_ma,
                is_locked=False,
            )
            session.add(pick)
            created += 1
    session.flush()
    return created


# ---------------------------------------------------------------------------
# TopSet CRUD
# ---------------------------------------------------------------------------

@router.get('/top-sets', response_model=list[TopSetSummary])
def list_top_sets(request: Request) -> list[TopSetSummary]:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        rows = session.scalars(
            select(TopSet)
            .options(selectinload(TopSet.horizons))
            .order_by(TopSet.id.asc())
        ).all()
        return [
            TopSetSummary(
                id=ts.id,
                name=ts.name,
                description=ts.description,
                horizon_count=len(ts.horizons),
            )
            for ts in rows
        ]


@router.post('/top-sets', response_model=TopSetDetail, status_code=201)
def create_top_set(body: TopSetCreate, request: Request) -> TopSetDetail:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        name = body.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail='Name cannot be empty')
        ts = TopSet(name=name, description=body.description)
        session.add(ts)
        session.commit()
        loaded = _load_top_set(session, ts.id)
        if loaded is None:
            raise HTTPException(status_code=500, detail='Failed to create TopSet')
        return _top_set_detail(loaded)


@router.get('/top-sets/{top_set_id}', response_model=TopSetDetail)
def get_top_set(top_set_id: int, request: Request) -> TopSetDetail:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        ts = _require_top_set(session, top_set_id)
        return _top_set_detail(ts)


@router.patch('/top-sets/{top_set_id}', response_model=TopSetDetail)
def patch_top_set(top_set_id: int, body: TopSetPatch, request: Request) -> TopSetDetail:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        ts = _require_top_set(session, top_set_id)
        if body.name is not None:
            next_name = body.name.strip()
            if not next_name:
                raise HTTPException(status_code=400, detail='Name cannot be empty')
            ts.name = next_name
        if body.description is not None:
            ts.description = body.description
        session.commit()
        loaded = _load_top_set(session, ts.id)
        return _top_set_detail(loaded)


@router.delete('/top-sets/{top_set_id}', status_code=204)
def delete_top_set(top_set_id: int, request: Request) -> None:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        ts = session.get(TopSet, top_set_id)
        if ts is None:
            raise HTTPException(status_code=404, detail=f'TopSet not found: {top_set_id}')
        active_count = session.scalar(
            select(func.count()).select_from(WellActiveTopSet).where(WellActiveTopSet.top_set_id == top_set_id)
        )
        if active_count:
            raise HTTPException(status_code=409, detail='TopSet is active for one or more wells; deactivate it first')
        session.delete(ts)
        session.commit()


# ---------------------------------------------------------------------------
# Horizon CRUD
# ---------------------------------------------------------------------------

@router.post('/top-sets/{top_set_id}/horizons', response_model=HorizonResponse, status_code=201)
def add_horizon(top_set_id: int, body: HorizonCreate, request: Request) -> HorizonResponse:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        if session.get(TopSet, top_set_id) is None:
            raise HTTPException(status_code=404, detail=f'TopSet not found: {top_set_id}')
        existing = session.scalars(
            select(TopSetHorizon).where(TopSetHorizon.top_set_id == top_set_id)
        ).all()
        sort_order = max((h.sort_order for h in existing), default=-1) + 1
        horizon = TopSetHorizon(
            top_set_id=top_set_id,
            name=body.name.strip(),
            kind=body.kind,
            age_ma=body.age_ma,
            color=body.color,
            sort_order=sort_order,
            note=body.note,
        )
        session.add(horizon)
        try:
            session.flush()
        except Exception:
            raise HTTPException(status_code=409, detail='Horizon name already exists in this TopSet')
        rebuild_zones_for_top_set(session, top_set_id)
        well_ids = _linked_well_ids(session, top_set_id)
        for wid in well_ids:
            ensure_zone_well_data(session, top_set_id, wid)
            recalculate_zone_thickness(session, top_set_id, wid)
            aggregate_zone_lithology_from_curve(session, manager.project_path, wid)
        session.commit()
        session.refresh(horizon)
        return _horizon_to_response(horizon)


@router.patch('/top-sets/{top_set_id}/horizons/{horizon_id}', response_model=HorizonResponse)
def patch_horizon(top_set_id: int, horizon_id: int, body: HorizonPatch, request: Request) -> HorizonResponse:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        horizon = session.get(TopSetHorizon, horizon_id)
        if horizon is None or horizon.top_set_id != top_set_id:
            raise HTTPException(status_code=404, detail=f'Horizon not found: {horizon_id}')
        if body.name is not None:
            horizon.name = body.name.strip()
        if body.kind is not None:
            horizon.kind = body.kind
        if body.age_ma is not None:
            horizon.age_ma = body.age_ma
        if body.color is not None:
            horizon.color = body.color
        if body.note is not None:
            horizon.note = body.note
        session.commit()
        session.refresh(horizon)
        return _horizon_to_response(horizon)


@router.delete('/top-sets/{top_set_id}/horizons/{horizon_id}', status_code=204)
def delete_horizon(top_set_id: int, horizon_id: int, request: Request) -> None:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        horizon = session.get(TopSetHorizon, horizon_id)
        if horizon is None or horizon.top_set_id != top_set_id:
            raise HTTPException(status_code=404, detail=f'Horizon not found: {horizon_id}')
        well_ids = _linked_well_ids(session, top_set_id)
        merge_zones_on_horizon_delete(session, top_set_id, horizon_id)
        session.delete(horizon)
        session.flush()
        for wid in well_ids:
            recalculate_zone_thickness(session, top_set_id, wid)
            aggregate_zone_lithology_from_curve(session, manager.project_path, wid)
        session.commit()


@router.post('/top-sets/{top_set_id}/horizons/reorder', response_model=TopSetDetail)
def reorder_horizons(top_set_id: int, body: HorizonReorderRequest, request: Request) -> TopSetDetail:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        if session.get(TopSet, top_set_id) is None:
            raise HTTPException(status_code=404, detail=f'TopSet not found: {top_set_id}')
        existing_ids = {
            h.id
            for h in session.scalars(
                select(TopSetHorizon).where(TopSetHorizon.top_set_id == top_set_id)
            ).all()
        }
        if set(body.horizon_ids) != existing_ids:
            raise HTTPException(status_code=400, detail='horizon_ids must be exactly the set of horizon IDs for this TopSet')
        for i, hid in enumerate(body.horizon_ids):
            h = session.get(TopSetHorizon, hid)
            if h is not None:
                h.sort_order = i
        session.flush()
        rebuild_zones_for_top_set(session, top_set_id)
        session.commit()
        loaded = _load_top_set(session, top_set_id)
        return _top_set_detail(loaded)


# ---------------------------------------------------------------------------
# Active TopSet for a well
# ---------------------------------------------------------------------------

@router.put('/wells/{well_id}/active-top-set', response_model=ActiveTopSetResponse)
def set_active_top_set(well_id: str, body: ActiveTopSetRequest, request: Request) -> ActiveTopSetResponse:
    """Assign a TopSet as active for a well.

    Links existing picks to horizons by name, then creates ghost picks
    (depth_md=None) for horizons that have no matching pick in this well.
    """
    manager = _require_open_project(request)
    with manager.get_session() as session:
        _require_well(session, well_id)
        if session.get(TopSet, body.top_set_id) is None:
            raise HTTPException(status_code=404, detail=f'TopSet not found: {body.top_set_id}')

        link = session.scalar(
            select(WellActiveTopSet).where(WellActiveTopSet.well_id == well_id)
        )
        if link is None:
            link = WellActiveTopSet(well_id=well_id, top_set_id=body.top_set_id)
            session.add(link)
        else:
            link.top_set_id = body.top_set_id

        session.flush()
        _link_picks_to_horizons(session, well_id, body.top_set_id)
        _create_ghost_picks(session, well_id, body.top_set_id)
        ensure_zone_well_data(session, body.top_set_id, well_id)
        recalculate_zone_thickness(session, body.top_set_id, well_id)
        aggregate_zone_lithology_from_curve(session, manager.project_path, well_id)
        session.commit()

    return ActiveTopSetResponse(well_id=well_id, top_set_id=body.top_set_id)


@router.delete('/wells/{well_id}/active-top-set', status_code=204)
def clear_active_top_set(well_id: str, request: Request) -> None:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        _require_well(session, well_id)
        link = session.scalar(
            select(WellActiveTopSet).where(WellActiveTopSet.well_id == well_id)
        )
        if link is not None:
            session.delete(link)
            session.commit()


# ---------------------------------------------------------------------------
# Extract horizons from a well's picks
# ---------------------------------------------------------------------------

@router.post('/top-sets/{top_set_id}/extract-from-well/{well_id}', response_model=TopSetDetail)
def extract_from_well(top_set_id: int, well_id: str, request: Request) -> TopSetDetail:
    """Create horizons in a TopSet from a well's unique formation names.

    Picks are ordered by depth_md; the first occurrence of each name sets sort_order.
    Existing horizons with matching names are updated. Picks are linked via horizon_id.
    """
    manager = _require_open_project(request)
    with manager.get_session() as session:
        _require_top_set(session, top_set_id)
        _require_well(session, well_id)

        picks = session.scalars(
            select(FormationTopModel)
            .where(FormationTopModel.well_id == well_id)
            .order_by(
                FormationTopModel.depth_md.asc().nulls_last(),
                FormationTopModel.id.asc(),
            )
        ).all()

        existing_horizons = session.scalars(
            select(TopSetHorizon).where(TopSetHorizon.top_set_id == top_set_id)
        ).all()
        horizon_by_name = {h.name.lower(): h for h in existing_horizons}
        base_sort = max((h.sort_order for h in existing_horizons), default=-1) + 1

        seen_names: set[str] = set()
        sort_offset = 0
        for pick in picks:
            key = pick.name.lower()
            if key in seen_names:
                continue
            seen_names.add(key)

            if key in horizon_by_name:
                h = horizon_by_name[key]
            else:
                h = TopSetHorizon(
                    top_set_id=top_set_id,
                    name=pick.name,
                    kind=pick.kind or 'strat',
                    age_ma=pick.age_top_ma,
                    color=pick.color,
                    sort_order=base_sort + sort_offset,
                    note=None,
                )
                session.add(h)
                session.flush()
                horizon_by_name[key] = h
                sort_offset += 1

        # Link all picks with matching horizon names
        for pick in picks:
            h = horizon_by_name.get(pick.name.lower())
            if h is not None:
                pick.horizon_id = h.id

        session.commit()
        loaded = _load_top_set(session, top_set_id)
        return _top_set_detail(loaded)


# ---------------------------------------------------------------------------
# Recalculate TVD for a well
# ---------------------------------------------------------------------------

@router.post('/wells/{well_id}/recalculate-tvd', response_model=RecalculateTvdResponse)
def recalculate_tvd(well_id: str, request: Request) -> RecalculateTvdResponse:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        well = _require_well(session, well_id)
        count = recalculate_picks_tvd(session, manager.project_path, well)
        session.commit()
    return RecalculateTvdResponse(updated_count=count)
