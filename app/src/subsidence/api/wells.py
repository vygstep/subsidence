from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from subsidence.data import load_curves_from_parquet
from subsidence.data.schema import CurveMetadata, DeviationSurveyModel, FormationTopModel, WellModel

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
    kind: str
    strat_color: str | None = None
    is_locked: bool
    lithology: str | None = None
    strat_unit_id: int | None = None
    strat_unit_name: str | None = None


class DeviationSummaryResponse(BaseModel):
    reference: str
    mode: str
    fields: list[str]


class WellResponse(BaseModel):
    well_id: str
    well_name: str
    kb_elev: float
    gl_elev: float
    td_md: float
    x: float
    y: float
    crs: str
    depth_reference: str
    source_las_path: str | None = None
    deviation: DeviationSummaryResponse | None = None
    curves: list[CurveResponse]
    formations: list[FormationResponse]



def _manager(request: Request):
    return request.app.state.project_manager



def _require_open_project(request: Request):
    manager = _manager(request)
    if not manager.is_open:
        raise HTTPException(status_code=400, detail='No project is currently open')
    return manager


def _deviation_fields(mode: str) -> list[str]:
    if mode == 'INCL_AZIM':
        return ['MD', 'Inclination', 'Azimuth']
    if mode == 'X_Y':
        return ['X', 'Y']
    if mode == 'DX_DY':
        return ['dX', 'dY']
    return []


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
        well = session.get(WellModel, well_id)
        if well is None:
            raise HTTPException(status_code=404, detail=f'Well not found: {well_id}')

        curve_rows = list(session.scalars(select(CurveMetadata).where(CurveMetadata.well_id == well.id).order_by(CurveMetadata.id.asc())))
        curves: list[CurveResponse] = []
        td_md = well.td_md or 0.0
        if curve_rows:
            curve_map = load_curves_from_parquet(manager.project_path, curve_rows[0].data_uri)
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
                        null_value=row.null_value,
                    )
                )

        formation_rows = list(session.scalars(
            select(FormationTopModel)
            .where(FormationTopModel.well_id == well.id)
            .order_by(FormationTopModel.depth_md.asc())
            .options(selectinload(FormationTopModel.strat_unit))
        ))
        deviation = session.scalar(select(DeviationSurveyModel).where(DeviationSurveyModel.well_id == well.id))
        formations = [
            FormationResponse(
                id=str(row.id),
                name=row.name,
                depth_md=row.depth_md,
                age_ma=row.age_top_ma,
                color=row.color,
                kind=row.kind,
                strat_color=row.strat_unit.color_hex if row.strat_unit is not None else None,
                is_locked=row.is_locked,
                lithology=row.strat_unit.lithology if row.strat_unit is not None else None,
                strat_unit_id=row.strat_unit_id,
                strat_unit_name=row.strat_unit.name if row.strat_unit is not None else None,
            )
            for row in formation_rows
        ]

        return WellResponse(
            well_id=well.id,
            well_name=well.name,
            kb_elev=well.kb_elev,
            gl_elev=well.gl_elev,
            td_md=td_md,
            x=well.lon if well.lon is not None else 0.0,
            y=well.lat if well.lat is not None else 0.0,
            crs=well.crs,
            depth_reference='MD',
            source_las_path=well.source_las_path,
            deviation=DeviationSummaryResponse(
                reference=deviation.reference,
                mode=deviation.mode,
                fields=_deviation_fields(deviation.mode),
            ) if deviation is not None else None,
            curves=curves,
            formations=formations,
        )
