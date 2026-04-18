from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from subsidence.data import CreateFormation, ProjectManager, RemoveFormation, UpdateFormation, UpdateFormationDepth
from subsidence.data.undo import _model_to_dict
from subsidence.data.schema import FormationTopModel, WellModel

router = APIRouter(tags=['formations'])


class FormationTopCreate(BaseModel):
    name: str
    depth_md: float
    color: str = '#808080'
    lithology: str | None = None
    age_ma: float | None = None
    is_locked: bool = False


class FormationTopPatch(BaseModel):
    name: str | None = None
    depth_md: float | None = None
    color: str | None = None
    lithology: str | None = None
    age_ma: float | None = None
    is_locked: bool | None = None


class FormationTopResponse(BaseModel):
    id: str
    name: str
    depth_md: float
    color: str
    lithology: str | None
    age_ma: float | None
    is_locked: bool


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


def _load_formation(session, formation_id: int) -> FormationTopModel | None:
    return session.scalar(
        select(FormationTopModel)
        .where(FormationTopModel.id == formation_id)
        .options(selectinload(FormationTopModel.strat_unit))
    )


def _to_response(row: FormationTopModel) -> FormationTopResponse:
    return FormationTopResponse(
        id=str(row.id),
        name=row.name,
        depth_md=row.depth_md,
        color=row.color,
        lithology=row.strat_unit.lithology if row.strat_unit is not None else None,
        age_ma=row.age_top_ma,
        is_locked=row.is_locked,
    )


@router.get('/wells/{well_id}/formations', response_model=list[FormationTopResponse])
def list_formations(well_id: str, request: Request) -> list[FormationTopResponse]:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        _require_well(session, well_id)
        rows = session.scalars(
            select(FormationTopModel)
            .where(FormationTopModel.well_id == well_id)
            .order_by(FormationTopModel.depth_md.asc(), FormationTopModel.id.asc())
            .options(selectinload(FormationTopModel.strat_unit))
        ).all()
        return [_to_response(row) for row in rows]


@router.post('/wells/{well_id}/formations', response_model=FormationTopResponse, status_code=201)
def create_formation(well_id: str, body: FormationTopCreate, request: Request) -> FormationTopResponse:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        _require_well(session, well_id)
        row = FormationTopModel(
            well_id=well_id,
            name=body.name,
            depth_md=body.depth_md,
            age_top_ma=body.age_ma,
            color=body.color,
            is_locked=body.is_locked,
        )
        session.add(row)
        session.flush()
        session.refresh(row)
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

        old_values: dict[str, object] = {}
        new_values: dict[str, object] = {}

        patch_map = {
            'name': ('name', body.name),
            'depth_md': ('depth_md', body.depth_md),
            'color': ('color', body.color),
            'age_top_ma': ('age_top_ma', body.age_ma),
            'is_locked': ('is_locked', body.is_locked),
        }

        for model_field, (response_field, value) in patch_map.items():
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
        manager.execute_command(UpdateFormationDepth(formation_id, float(old_values['depth_md']), float(new_values['depth_md'])))
    else:
        manager.execute_command(UpdateFormation(formation_id, old_values, new_values))

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
