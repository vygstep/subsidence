from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select

from subsidence.data import load_curves_from_parquet
from subsidence.data.schema import CurveMetadata, FormationTopModel, WellModel

router = APIRouter(tags=['wells'])


class WellListItem(BaseModel):
    well_id: str
    well_name: str


class CurveResponse(BaseModel):
    mnemonic: str
    unit: str
    depths: list[float]
    values: list[float]
    null_value: float


class FormationResponse(BaseModel):
    id: str
    name: str
    depth_md: float
    age_ma: float | None = None
    color: str
    is_locked: bool
    lithology: str | None = None


class WellResponse(BaseModel):
    well_id: str
    well_name: str
    kb_elev: float
    td_md: float
    x: float
    y: float
    crs: str
    depth_reference: str
    curves: list[CurveResponse]
    formations: list[FormationResponse]



def _manager(request: Request):
    return request.app.state.project_manager



def _require_open_project(request: Request):
    manager = _manager(request)
    if not manager.is_open:
        raise HTTPException(status_code=400, detail='No project is currently open')
    return manager


@router.get('/wells', response_model=list[WellListItem])
def list_wells(request: Request) -> list[WellListItem]:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        rows = session.scalars(select(WellModel).order_by(WellModel.name.asc(), WellModel.id.asc())).all()
        return [WellListItem(well_id=row.id, well_name=row.name) for row in rows]


@router.get('/wells/{well_id}', response_model=WellResponse)
def get_well(well_id: str, request: Request) -> WellResponse:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        if well_id == 'sample':
            well = session.scalar(select(WellModel).order_by(WellModel.name.asc(), WellModel.id.asc()))
        else:
            well = session.get(WellModel, well_id)
        if well is None:
            raise HTTPException(status_code=404, detail=f'Well not found: {well_id}')

        curve_rows = list(session.scalars(select(CurveMetadata).where(CurveMetadata.well_id == well.id).order_by(CurveMetadata.id.asc())))
        if not curve_rows:
            raise HTTPException(status_code=404, detail=f'No curves found for well: {well.id}')

        curve_map = load_curves_from_parquet(manager.project_path, curve_rows[0].data_uri)
        curves: list[CurveResponse] = []
        td_md = well.td_md or 0.0
        for row in curve_rows:
            values = curve_map.get(row.mnemonic)
            if values is None:
                continue
            depths, curve_values = values
            if depths.size > 0:
                td_md = max(td_md, float(depths[-1]))
            curves.append(
                CurveResponse(
                    mnemonic=row.mnemonic,
                    unit=row.unit,
                    depths=depths.tolist(),
                    values=curve_values.tolist(),
                    null_value=-999.25,
                )
            )

        formation_rows = list(session.scalars(select(FormationTopModel).where(FormationTopModel.well_id == well.id).order_by(FormationTopModel.depth_md.asc())))
        formations = [
            FormationResponse(
                id=str(row.id),
                name=row.name,
                depth_md=row.depth_md,
                age_ma=row.age_top_ma,
                color=row.color,
                is_locked=row.is_locked,
                lithology=row.strat_unit.lithology if row.strat_unit is not None else None,
            )
            for row in formation_rows
        ]

        return WellResponse(
            well_id=well.id,
            well_name=well.name,
            kb_elev=well.kb_elev,
            td_md=td_md,
            x=well.lon or 0.0,
            y=well.lat or 0.0,
            crs=well.crs,
            depth_reference='MD',
            curves=curves,
            formations=formations,
        )
