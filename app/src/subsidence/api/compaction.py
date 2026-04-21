from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select

from subsidence.data.schema import LithologyDictEntry

router = APIRouter(tags=['compaction'])


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


def _require_open_project(request: Request):
    manager = request.app.state.project_manager
    if not manager.is_open:
        raise HTTPException(status_code=400, detail='No project is currently open')
    return manager


def _to_item(row: LithologyDictEntry) -> LithologyParamItem:
    return LithologyParamItem(
        lithology_code=row.lithology_code,
        display_name=row.display_name,
        color_hex=row.color_hex,
        density=row.density,
        porosity_surface=row.porosity_surface,
        compaction_coeff=row.compaction_coeff,
    )


@router.get('/lithology-params', response_model=list[LithologyParamItem])
def get_lithology_params(request: Request) -> list[LithologyParamItem]:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        rows = session.scalars(
            select(LithologyDictEntry).order_by(LithologyDictEntry.sort_order.asc())
        ).all()
        return [_to_item(r) for r in rows]


@router.patch('/lithology-params/{lithology_code}', response_model=LithologyParamItem)
def patch_lithology_params(
    lithology_code: str,
    payload: LithologyParamPatch,
    request: Request,
) -> LithologyParamItem:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        row = session.scalar(
            select(LithologyDictEntry).where(LithologyDictEntry.lithology_code == lithology_code)
        )
        if row is None:
            raise HTTPException(status_code=404, detail=f'Unknown lithology code: {lithology_code!r}')

        if payload.density is not None:
            row.density = payload.density
        if payload.porosity_surface is not None:
            row.porosity_surface = payload.porosity_surface
        if payload.compaction_coeff is not None:
            row.compaction_coeff = payload.compaction_coeff

        session.flush()
        item = _to_item(row)

    return item
