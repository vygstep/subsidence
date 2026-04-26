from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from subsidence.data import (
    CreateFormation,
    ProjectManager,
    RemoveFormation,
    UpdateFormation,
    UpdateFormationDepth,
    UpdateFormationStratLink,
)
from subsidence.data.deviation_transform import compute_tvd_tvdss, tvd_to_md
from subsidence.data.undo import _model_to_dict
from subsidence.data.schema import FormationStratLink, FormationTopModel, StratChart, StratUnit, WellModel
from subsidence.data.strat_link import auto_link_to_active_chart, find_strat_unit_by_name

router = APIRouter(tags=['formations'])


class FormationTopCreate(BaseModel):
    name: str
    depth_md: float
    color: str = '#808080'
    kind: str = 'strat'
    lithology: str | None = None
    age_ma: float | None = None
    is_locked: bool = False
    water_depth_m: float = 0.0
    eroded_thickness_m: float = 0.0


class FormationTopPatch(BaseModel):
    name: str | None = None
    depth_md: float | None = None
    depth_tvd: float | None = None
    depth_tvdss: float | None = None
    color: str | None = None
    kind: str | None = None
    lithology: str | None = None
    age_ma: float | None = None
    is_locked: bool | None = None
    water_depth_m: float | None = None
    eroded_thickness_m: float | None = None


class FormationStratLinkResponse(BaseModel):
    chart_id: int
    chart_name: str
    strat_unit_id: int
    strat_unit_name: str
    color_hex: str | None


class FormationTopResponse(BaseModel):
    id: str
    name: str
    depth_md: float | None
    depth_tvd: float | None
    depth_tvdss: float | None
    horizon_id: int | None
    color: str
    kind: str
    lithology: str | None
    age_ma: float | None
    is_locked: bool
    water_depth_m: float
    eroded_thickness_m: float
    strat_links: list[FormationStratLinkResponse]
    active_strat_color: str | None
    active_strat_unit_name: str | None


class StratUnitLookupResponse(BaseModel):
    id: int
    name: str
    rank: str | None
    color_hex: str | None


class StratLinkRequest(BaseModel):
    chart_id: int
    strat_unit_id: int | None


def _manager(request: Request) -> ProjectManager:
    return request.app.state.project_manager


def _require_open_project(request: Request) -> ProjectManager:
    manager = _manager(request)
    if not manager.is_open:
        raise HTTPException(status_code=400, detail='No project is currently open')
    return manager


def _require_well(session, well_id: str) -> WellModel:
    well = session.get(WellModel, well_id)
    if well is None:
        raise HTTPException(status_code=404, detail=f'Well not found: {well_id}')
    return well


def _load_options():
    return [
        selectinload(FormationTopModel.strat_links).options(
            selectinload(FormationStratLink.strat_unit),
            selectinload(FormationStratLink.chart),
        )
    ]


def _load_formation(session, formation_id: int) -> FormationTopModel | None:
    return session.scalar(
        select(FormationTopModel)
        .where(FormationTopModel.id == formation_id)
        .options(*_load_options())
    )


def _to_response(row: FormationTopModel) -> FormationTopResponse:
    links = [
        FormationStratLinkResponse(
            chart_id=link.chart_id,
            chart_name=link.chart.name,
            strat_unit_id=link.strat_unit_id,
            strat_unit_name=link.strat_unit.name,
            color_hex=link.strat_unit.color_hex,
        )
        for link in row.strat_links
    ]
    active_link = next((link for link in row.strat_links if link.chart.is_active), None)
    return FormationTopResponse(
        id=str(row.id),
        name=row.name,
        depth_md=row.depth_md,
        depth_tvd=row.depth_tvd,
        depth_tvdss=row.depth_tvdss,
        horizon_id=row.horizon_id,
        color=row.color,
        kind=row.kind,
        lithology=row.lithology,
        age_ma=row.age_top_ma,
        is_locked=row.is_locked,
        water_depth_m=row.water_depth_m,
        eroded_thickness_m=row.eroded_thickness_m,
        strat_links=links,
        active_strat_color=active_link.strat_unit.color_hex if active_link else None,
        active_strat_unit_name=active_link.strat_unit.name if active_link else None,
    )


@router.get('/strat-units', response_model=list[StratUnitLookupResponse])
def list_strat_units(request: Request, q: str = '', limit: int = 20, chart_id: int | None = None) -> list[StratUnitLookupResponse]:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        stmt = select(StratUnit).order_by(StratUnit.name.asc()).limit(max(1, min(limit, 100)))
        query = q.strip()
        if query:
            stmt = stmt.where(StratUnit.name.ilike(f'%{query}%'))
        if chart_id is not None:
            stmt = stmt.where(StratUnit.chart_id == chart_id)

        rows = session.scalars(stmt).all()
        return [
            StratUnitLookupResponse(
                id=row.id,
                name=row.name,
                rank=row.rank,
                color_hex=row.color_hex,
            )
            for row in rows
        ]


@router.get('/wells/{well_id}/formations', response_model=list[FormationTopResponse])
def list_formations(well_id: str, request: Request) -> list[FormationTopResponse]:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        _require_well(session, well_id)
        rows = session.scalars(
            select(FormationTopModel)
            .where(FormationTopModel.well_id == well_id)
            .order_by(FormationTopModel.depth_md.asc(), FormationTopModel.id.asc())
            .options(*_load_options())
        ).all()
        return [_to_response(row) for row in rows]


@router.post('/wells/{well_id}/formations', response_model=FormationTopResponse, status_code=201)
def create_formation(well_id: str, body: FormationTopCreate, request: Request) -> FormationTopResponse:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        _require_well(session, well_id)
        well = session.get(WellModel, well_id)
        tvd, tvdss = compute_tvd_tvdss(manager.project_path, well, body.depth_md) if well is not None else (None, None)
        row = FormationTopModel(
            well_id=well_id,
            name=body.name,
            depth_md=body.depth_md,
            depth_tvd=tvd,
            depth_tvdss=tvdss,
            age_top_ma=body.age_ma,
            color=body.color,
            kind=body.kind,
            lithology=body.lithology,
            is_locked=body.is_locked,
            water_depth_m=body.water_depth_m,
            eroded_thickness_m=body.eroded_thickness_m,
        )
        session.add(row)
        session.flush()
        auto_link_to_active_chart(session, row)
        session.flush()
        manager.undo_stack.push(CreateFormation(_model_to_dict(row)), session)
        session.commit()
        created = _load_formation(session, row.id)
        if created is None:
            raise HTTPException(status_code=500, detail='Failed to create formation')
        return _to_response(created)


@router.patch('/wells/{well_id}/formations/{formation_id}', response_model=FormationTopResponse)
def update_formation(well_id: str, formation_id: int, body: FormationTopPatch, request: Request) -> FormationTopResponse:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        _require_well(session, well_id)
        row = _load_formation(session, formation_id)
        if row is None or row.well_id != well_id:
            raise HTTPException(status_code=404, detail=f'Formation not found: {formation_id}')

        # Resolve depth_md from TVD or TVDSS inputs when depth_md not explicitly set
        resolved_depth_md = body.depth_md
        if resolved_depth_md is None and (body.depth_tvd is not None or body.depth_tvdss is not None):
            well = session.get(WellModel, well_id)
            if well is None:
                raise HTTPException(status_code=404, detail=f'Well not found: {well_id}')
            if body.depth_tvdss is not None:
                tvd_for_calc = body.depth_tvdss + well.kb_elev
            else:
                tvd_for_calc = body.depth_tvd
            md_result = tvd_to_md(tvd_for_calc, manager.project_path, well)
            if md_result is None:
                raise HTTPException(status_code=400, detail='No deviation survey available for TVD/TVDSS-to-MD back-calculation')
            resolved_depth_md = md_result

        old_values: dict[str, object] = {}
        new_values: dict[str, object] = {}

        patch_map = {
            'name': ('name', body.name),
            'depth_md': ('depth_md', resolved_depth_md),
            'color': ('color', body.color),
            'kind': ('kind', body.kind),
            'lithology': ('lithology', body.lithology),
            'age_top_ma': ('age_top_ma', body.age_ma),
            'is_locked': ('is_locked', body.is_locked),
            'water_depth_m': ('water_depth_m', body.water_depth_m),
            'eroded_thickness_m': ('eroded_thickness_m', body.eroded_thickness_m),
        }

        for model_field, (_, value) in patch_map.items():
            if value is None:
                continue
            current_value = getattr(row, model_field)
            if current_value == value:
                continue
            old_values[model_field] = current_value
            new_values[model_field] = value

    if not new_values:
        with manager.get_session() as session:
            existing = _load_formation(session, formation_id)
            if existing is None:
                raise HTTPException(status_code=404, detail=f'Formation not found: {formation_id}')
            return _to_response(existing)

    if set(new_values) == {'depth_md'}:
        manager.execute_command(UpdateFormationDepth(formation_id, float(old_values['depth_md']), float(new_values['depth_md']), project_path=manager.project_path))
    else:
        manager.execute_command(UpdateFormation(formation_id, old_values, new_values))

    with manager.get_session() as session:
        updated = _load_formation(session, formation_id)
        if updated is None:
            raise HTTPException(status_code=404, detail=f'Formation not found: {formation_id}')
        return _to_response(updated)


@router.put('/wells/{well_id}/formations/{formation_id}/strat-link', response_model=FormationTopResponse)
def upsert_formation_strat_link(well_id: str, formation_id: int, body: StratLinkRequest, request: Request) -> FormationTopResponse:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        _require_well(session, well_id)
        formation = _load_formation(session, formation_id)
        if formation is None or formation.well_id != well_id:
            raise HTTPException(status_code=404, detail=f'Formation not found: {formation_id}')

        chart = session.get(StratChart, body.chart_id)
        if chart is None:
            raise HTTPException(status_code=404, detail=f'Strat chart not found: {body.chart_id}')
        if body.strat_unit_id is not None:
            strat_unit = session.get(StratUnit, body.strat_unit_id)
            if strat_unit is None:
                raise HTTPException(status_code=404, detail=f'Strat unit not found: {body.strat_unit_id}')
            if strat_unit.chart_id != body.chart_id:
                raise HTTPException(status_code=400, detail='Strat unit does not belong to the selected chart')

        existing_link = session.scalar(
            select(FormationStratLink).where(
                FormationStratLink.formation_id == formation_id,
                FormationStratLink.chart_id == body.chart_id,
            )
        )
        old_strat_unit_id = existing_link.strat_unit_id if existing_link is not None else None

    if old_strat_unit_id != body.strat_unit_id:
        manager.execute_command(
            UpdateFormationStratLink(
                formation_id=formation_id,
                chart_id=body.chart_id,
                old_strat_unit_id=old_strat_unit_id,
                new_strat_unit_id=body.strat_unit_id,
            )
        )

    with manager.get_session() as session:
        updated = _load_formation(session, formation_id)
        if updated is None:
            raise HTTPException(status_code=404, detail=f'Formation not found: {formation_id}')
        return _to_response(updated)


@router.delete('/wells/{well_id}/formations/{formation_id}', status_code=204)
def delete_formation(well_id: str, formation_id: int, request: Request) -> None:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        _require_well(session, well_id)
        row = _load_formation(session, formation_id)
        if row is None or row.well_id != well_id:
            raise HTTPException(status_code=404, detail=f'Formation not found: {formation_id}')
        snapshot = _model_to_dict(row)

    manager.execute_command(RemoveFormation(snapshot))
    manager.save_project()
