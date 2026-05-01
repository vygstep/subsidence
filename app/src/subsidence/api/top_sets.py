from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from subsidence.data.deviation_transform import compute_tvd_tvdss, recalculate_picks_tvd
from subsidence.data.schema import (
    FormationTopModel,
    FormationZone,
    TopSet,
    TopSetHorizon,
    WellActiveTopSet,
    WellModel,
)
from subsidence.data.zone_service import (
    activate_top_set_for_well,
    aggregate_zone_lithology_from_curve,
    extract_horizons_from_well_picks,
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


class TopSetPickCreate(BaseModel):
    well_id: str
    depth_md: float | None = None
    insert_before_horizon_id: int | None = None
    insert_after_horizon_id: int | None = None
    split_zone_id: int | None = None


class TopSetPickCreateResponse(BaseModel):
    well_id: str
    formation_id: str
    horizon_id: int
    name: str
    depth_md: float | None


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


def _next_auto_top_name(session, top_set_id: int) -> str:
    existing = {
        name.lower()
        for name in session.scalars(
            select(TopSetHorizon.name).where(TopSetHorizon.top_set_id == top_set_id)
        )
    }
    index = len(existing) + 1
    while f'Top {index}'.lower() in existing:
        index += 1
    return f'Top {index}'


def _insert_horizon_at(
    session,
    top_set_id: int,
    sort_order: int,
    *,
    name: str | None = None,
) -> TopSetHorizon:
    for horizon in session.scalars(
        select(TopSetHorizon)
        .where(TopSetHorizon.top_set_id == top_set_id, TopSetHorizon.sort_order >= sort_order)
        .order_by(TopSetHorizon.sort_order.desc())
    ):
        horizon.sort_order += 1
    horizon = TopSetHorizon(
        top_set_id=top_set_id,
        name=name or _next_auto_top_name(session, top_set_id),
        kind='strat',
        color='#90a4ae',
        sort_order=sort_order,
    )
    session.add(horizon)
    session.flush()
    return horizon


def _require_well(session, well_id: str) -> WellModel:
    well = session.get(WellModel, well_id)
    if well is None:
        raise HTTPException(status_code=404, detail=f'Well not found: {well_id}')
    return well


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
        horizon_ids = list(session.scalars(select(TopSetHorizon.id).where(TopSetHorizon.top_set_id == top_set_id)))
        for link in session.scalars(select(WellActiveTopSet).where(WellActiveTopSet.top_set_id == top_set_id)):
            session.delete(link)
        if horizon_ids:
            for top in session.scalars(select(FormationTopModel).where(FormationTopModel.horizon_id.in_(horizon_ids))):
                session.delete(top)
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
            activate_top_set_for_well(session, manager.project_path, wid, top_set_id)
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
        linked_picks = session.scalars(
            select(FormationTopModel).where(FormationTopModel.horizon_id == horizon_id)
        ).all()
        for pick in linked_picks:
            session.delete(pick)
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


@router.post('/top-sets/{top_set_id}/picks', response_model=TopSetPickCreateResponse, status_code=201)
def create_top_set_pick(top_set_id: int, body: TopSetPickCreate, request: Request) -> TopSetPickCreateResponse:
    manager = _require_open_project(request)
    targets = [
        body.insert_before_horizon_id is not None,
        body.insert_after_horizon_id is not None,
        body.split_zone_id is not None,
    ]
    if sum(targets) > 1:
        raise HTTPException(status_code=400, detail='Choose only one insert target')

    with manager.get_session() as session:
        _require_top_set(session, top_set_id)
        well = _require_well(session, body.well_id)
        active_link = session.scalar(
            select(WellActiveTopSet).where(
                WellActiveTopSet.well_id == body.well_id,
                WellActiveTopSet.top_set_id == top_set_id,
            )
        )
        if active_link is None:
            raise HTTPException(status_code=400, detail='Choose an active TopSet for this well first')

        if body.split_zone_id is not None:
            zone = session.get(FormationZone, body.split_zone_id)
            if zone is None or zone.top_set_id != top_set_id:
                raise HTTPException(status_code=404, detail=f'Zone not found: {body.split_zone_id}')
            upper = session.get(TopSetHorizon, zone.upper_horizon_id)
            sort_order = (upper.sort_order if upper is not None else zone.sort_order) + 1
        elif body.insert_before_horizon_id is not None:
            target = session.get(TopSetHorizon, body.insert_before_horizon_id)
            if target is None or target.top_set_id != top_set_id:
                raise HTTPException(status_code=404, detail=f'Horizon not found: {body.insert_before_horizon_id}')
            sort_order = target.sort_order
        elif body.insert_after_horizon_id is not None:
            target = session.get(TopSetHorizon, body.insert_after_horizon_id)
            if target is None or target.top_set_id != top_set_id:
                raise HTTPException(status_code=404, detail=f'Horizon not found: {body.insert_after_horizon_id}')
            sort_order = target.sort_order + 1
        else:
            max_sort_order = session.scalar(
                select(TopSetHorizon.sort_order)
                .where(TopSetHorizon.top_set_id == top_set_id)
                .order_by(TopSetHorizon.sort_order.desc())
            )
            sort_order = (max_sort_order if max_sort_order is not None else -1) + 1

        horizon = _insert_horizon_at(session, top_set_id, sort_order)
        rebuild_zones_for_top_set(session, top_set_id)
        well_ids = _linked_well_ids(session, top_set_id)
        for wid in well_ids:
            activate_top_set_for_well(session, manager.project_path, wid, top_set_id)

        pick = session.scalar(
            select(FormationTopModel).where(
                FormationTopModel.well_id == body.well_id,
                FormationTopModel.horizon_id == horizon.id,
            )
        )
        if pick is None:
            pick = FormationTopModel(
                well_id=body.well_id,
                horizon_id=horizon.id,
                name=horizon.name,
                kind=horizon.kind,
                depth_md=None,
                color=horizon.color,
                age_top_ma=horizon.age_ma,
                is_locked=False,
            )
            session.add(pick)
            session.flush()
        if body.depth_md is not None:
            tvd, tvdss = compute_tvd_tvdss(manager.project_path, well, body.depth_md)
            pick.depth_md = body.depth_md
            pick.depth_tvd = tvd
            pick.depth_tvdss = tvdss

        recalculate_zone_thickness(session, top_set_id, body.well_id)
        aggregate_zone_lithology_from_curve(session, manager.project_path, body.well_id)
        session.commit()
        return TopSetPickCreateResponse(
            well_id=body.well_id,
            formation_id=str(pick.id),
            horizon_id=horizon.id,
            name=pick.name,
            depth_md=pick.depth_md,
        )


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

        activate_top_set_for_well(session, manager.project_path, well_id, body.top_set_id)
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

        extract_horizons_from_well_picks(session, top_set_id, well_id)
        rebuild_zones_for_top_set(session, top_set_id)
        activate_top_set_for_well(session, manager.project_path, well_id, top_set_id)
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
