from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select

from subsidence.data.schema import CompactionModel, CompactionModelParam, CurveDictEntry, LithologyDictEntry

router = APIRouter(tags=['compaction'])


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class CompactionModelResponse(BaseModel):
    id: int
    name: str
    is_builtin: bool
    is_active: bool


class CompactionModelCreate(BaseModel):
    name: str
    clone_from_id: int | None = None


class CompactionModelPatch(BaseModel):
    name: str | None = None
    is_active: bool | None = None


class LithologyParamItem(BaseModel):
    lithology_code: str
    display_name: str
    color_hex: str
    density: float
    porosity_surface: float
    compaction_coeff: float


class LithologyParamPatch(BaseModel):
    density: float | None = None
    porosity_surface: float | None = None
    compaction_coeff: float | None = None


class CurveDictionaryItem(BaseModel):
    id: int
    scope: str
    pattern: str
    is_regex: bool
    priority: int
    family_code: str | None
    canonical_mnemonic: str | None
    canonical_unit: str | None
    is_active: bool


class LithologyDictionaryItem(BaseModel):
    id: int
    lithology_code: str
    display_name: str
    color_hex: str
    pattern_id: str | None
    description: str | None
    sort_order: int
    density: float
    porosity_surface: float
    compaction_coeff: float


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _require_open_project(request: Request):
    manager = request.app.state.project_manager
    if not manager.is_open:
        raise HTTPException(status_code=400, detail='No project is currently open')
    return manager


def _to_model_response(row: CompactionModel) -> CompactionModelResponse:
    return CompactionModelResponse(
        id=row.id,
        name=row.name,
        is_builtin=row.is_builtin,
        is_active=row.is_active,
    )


def _param_to_item(param: CompactionModelParam, litho: LithologyDictEntry) -> LithologyParamItem:
    return LithologyParamItem(
        lithology_code=param.lithology_code,
        display_name=litho.display_name,
        color_hex=litho.color_hex,
        density=param.density,
        porosity_surface=param.porosity_surface,
        compaction_coeff=param.compaction_coeff,
    )


def _curve_dict_to_item(row: CurveDictEntry) -> CurveDictionaryItem:
    return CurveDictionaryItem(
        id=row.id,
        scope=row.scope,
        pattern=row.pattern,
        is_regex=row.is_regex,
        priority=row.priority,
        family_code=row.family_code,
        canonical_mnemonic=row.canonical_mnemonic,
        canonical_unit=row.canonical_unit,
        is_active=row.is_active,
    )


def _lithology_dict_to_item(row: LithologyDictEntry) -> LithologyDictionaryItem:
    return LithologyDictionaryItem(
        id=row.id,
        lithology_code=row.lithology_code,
        display_name=row.display_name,
        color_hex=row.color_hex,
        pattern_id=row.pattern_id,
        description=row.description,
        sort_order=row.sort_order,
        density=row.density,
        porosity_surface=row.porosity_surface,
        compaction_coeff=row.compaction_coeff,
    )


# ---------------------------------------------------------------------------
# Compaction model CRUD
# ---------------------------------------------------------------------------

@router.get('/curve-dictionary', response_model=list[CurveDictionaryItem])
def list_curve_dictionary(request: Request) -> list[CurveDictionaryItem]:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        rows = session.scalars(
            select(CurveDictEntry).order_by(
                CurveDictEntry.scope.asc(),
                CurveDictEntry.priority.desc(),
                CurveDictEntry.pattern.asc(),
            )
        ).all()
        return [_curve_dict_to_item(row) for row in rows]


@router.get('/lithology-dictionary', response_model=list[LithologyDictionaryItem])
def list_lithology_dictionary(request: Request) -> list[LithologyDictionaryItem]:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        rows = session.scalars(
            select(LithologyDictEntry).order_by(LithologyDictEntry.sort_order.asc(), LithologyDictEntry.id.asc())
        ).all()
        return [_lithology_dict_to_item(row) for row in rows]


# ---------------------------------------------------------------------------
# Compaction model CRUD
# ---------------------------------------------------------------------------

@router.get('/compaction-models', response_model=list[CompactionModelResponse])
def list_compaction_models(request: Request) -> list[CompactionModelResponse]:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        rows = session.scalars(
            select(CompactionModel).order_by(CompactionModel.id.asc())
        ).all()
        return [_to_model_response(r) for r in rows]


@router.post('/compaction-models', response_model=CompactionModelResponse, status_code=201)
def create_compaction_model(payload: CompactionModelCreate, request: Request) -> CompactionModelResponse:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        existing = session.scalar(
            select(CompactionModel).where(CompactionModel.name == payload.name)
        )
        if existing is not None:
            raise HTTPException(status_code=409, detail=f'Model name already exists: {payload.name!r}')

        model = CompactionModel(name=payload.name, is_builtin=False, is_active=False)
        session.add(model)
        session.flush()

        if payload.clone_from_id is not None:
            source_model = session.get(CompactionModel, payload.clone_from_id)
            if source_model is None:
                raise HTTPException(status_code=404, detail=f'Compaction model not found: {payload.clone_from_id}')
            source_params = session.scalars(
                select(CompactionModelParam)
                .where(CompactionModelParam.model_id == payload.clone_from_id)
            ).all()
        else:
            # clone from the built-in model by default
            builtin = session.scalar(
                select(CompactionModel).where(CompactionModel.is_builtin.is_(True))
            )
            source_params = session.scalars(
                select(CompactionModelParam)
                .where(CompactionModelParam.model_id == builtin.id)
            ).all() if builtin else []

        for sp in source_params:
            session.add(CompactionModelParam(
                model_id=model.id,
                lithology_code=sp.lithology_code,
                density=sp.density,
                porosity_surface=sp.porosity_surface,
                compaction_coeff=sp.compaction_coeff,
            ))

        session.commit()
        session.refresh(model)
        return _to_model_response(model)


@router.patch('/compaction-models/{model_id}', response_model=CompactionModelResponse)
def patch_compaction_model(
    model_id: int,
    payload: CompactionModelPatch,
    request: Request,
) -> CompactionModelResponse:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        model = session.get(CompactionModel, model_id)
        if model is None:
            raise HTTPException(status_code=404, detail=f'Compaction model not found: {model_id}')

        if payload.name is not None:
            if model.is_builtin:
                raise HTTPException(status_code=403, detail='Built-in model cannot be renamed')
            model.name = payload.name

        if payload.is_active is True:
            # deactivate all others, activate this one
            all_models = session.scalars(select(CompactionModel)).all()
            for m in all_models:
                m.is_active = (m.id == model_id)
        elif payload.is_active is False and model.is_active:
            raise HTTPException(status_code=400, detail='Cannot deactivate without activating another model')

        session.commit()
        session.refresh(model)
        return _to_model_response(model)


@router.delete('/compaction-models/{model_id}', status_code=204)
def delete_compaction_model(model_id: int, request: Request) -> None:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        model = session.get(CompactionModel, model_id)
        if model is None:
            raise HTTPException(status_code=404, detail=f'Compaction model not found: {model_id}')
        if model.is_builtin:
            raise HTTPException(status_code=403, detail='Built-in model cannot be deleted')
        if model.is_active:
            raise HTTPException(status_code=400, detail='Cannot delete the active model; activate another first')
        session.delete(model)
        session.commit()


# ---------------------------------------------------------------------------
# Per-model param CRUD
# ---------------------------------------------------------------------------

@router.get('/compaction-models/{model_id}/params', response_model=list[LithologyParamItem])
def get_model_params(model_id: int, request: Request) -> list[LithologyParamItem]:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        if session.get(CompactionModel, model_id) is None:
            raise HTTPException(status_code=404, detail=f'Compaction model not found: {model_id}')

        litho_map = {
            r.lithology_code: r
            for r in session.scalars(select(LithologyDictEntry)).all()
        }
        params = session.scalars(
            select(CompactionModelParam)
            .where(CompactionModelParam.model_id == model_id)
            .order_by(CompactionModelParam.lithology_code.asc())
        ).all()
        return [
            _param_to_item(p, litho_map[p.lithology_code])
            for p in params
            if p.lithology_code in litho_map
        ]


@router.patch(
    '/compaction-models/{model_id}/params/{lithology_code}',
    response_model=LithologyParamItem,
)
def patch_model_param(
    model_id: int,
    lithology_code: str,
    payload: LithologyParamPatch,
    request: Request,
) -> LithologyParamItem:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        model = session.get(CompactionModel, model_id)
        if model is None:
            raise HTTPException(status_code=404, detail=f'Compaction model not found: {model_id}')
        if model.is_builtin:
            raise HTTPException(status_code=403, detail='Built-in model parameters cannot be edited')

        param = session.scalar(
            select(CompactionModelParam).where(
                CompactionModelParam.model_id == model_id,
                CompactionModelParam.lithology_code == lithology_code,
            )
        )
        if param is None:
            raise HTTPException(status_code=404, detail=f'Param not found: {lithology_code!r}')

        if payload.density is not None:
            param.density = payload.density
        if payload.porosity_surface is not None:
            param.porosity_surface = payload.porosity_surface
        if payload.compaction_coeff is not None:
            param.compaction_coeff = payload.compaction_coeff

        session.flush()
        litho = session.scalar(
            select(LithologyDictEntry).where(LithologyDictEntry.lithology_code == lithology_code)
        )
        if litho is None:
            raise HTTPException(status_code=404, detail=f'Unknown lithology: {lithology_code!r}')
        item = _param_to_item(param, litho)
        session.commit()
        return item
