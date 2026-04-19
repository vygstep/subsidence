from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from subsidence.data import load_curves_from_parquet
from subsidence.data.schema import CurveMetadata, DeviationSurveyModel, FormationStratLink, FormationTopModel, WellModel

router = APIRouter(tags=['wells'])


class WellListItem(BaseModel):
    well_id: str
    well_name: str


class CurveInventoryItem(BaseModel):
    mnemonic: str
    unit: str


class FormationInventoryItem(BaseModel):
    id: str
    name: str
    depth_md: float
    active_strat_color: str | None = None


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


class WellInventoryResponse(BaseModel):
    well_id: str
    well_name: str
    kb_elev: float
    gl_elev: float
    td_md: float
    x: float
    y: float
    crs: str
    source_las_path: str | None = None
    deviation: DeviationSummaryResponse | None = None
    curves: list[CurveInventoryItem]
    formations: list[FormationInventoryItem]


class WellPatchRequest(BaseModel):
    well_name: str | None = None
    kb_elev: float | None = None
    gl_elev: float | None = None
    td_md: float | None = None
    x: float | None = None
    y: float | None = None
    crs: str | None = None



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


def _active_link(row: FormationTopModel) -> FormationStratLink | None:
    return next((link for link in row.strat_links if link.chart.is_active), None)


def _formation_load_options():
    return [
        selectinload(FormationTopModel.strat_links).options(
            selectinload(FormationStratLink.strat_unit),
            selectinload(FormationStratLink.chart),
        )
    ]


@router.get('/wells', response_model=list[WellListItem])
def list_wells(request: Request) -> list[WellListItem]:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        rows = session.scalars(select(WellModel).order_by(WellModel.name.asc(), WellModel.id.asc())).all()
        return [WellListItem(well_id=row.id, well_name=row.name) for row in rows]


@router.get('/wells/inventory', response_model=list[WellInventoryResponse])
def list_well_inventories(request: Request) -> list[WellInventoryResponse]:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        wells = session.scalars(select(WellModel).order_by(WellModel.name.asc(), WellModel.id.asc())).all()
        payload: list[WellInventoryResponse] = []
        for well in wells:
            curve_rows = list(
                session.scalars(
                    select(CurveMetadata)
                    .where(CurveMetadata.well_id == well.id)
                    .order_by(CurveMetadata.id.asc())
                )
            )
            formation_rows = list(
                session.scalars(
                    select(FormationTopModel)
                    .where(FormationTopModel.well_id == well.id)
                    .order_by(FormationTopModel.depth_md.asc(), FormationTopModel.id.asc())
                    .options(*_formation_load_options())
                )
            )
            deviation = session.scalar(
                select(DeviationSurveyModel).where(DeviationSurveyModel.well_id == well.id)
            )
            payload.append(
                WellInventoryResponse(
                    well_id=well.id,
                    well_name=well.name,
                    kb_elev=well.kb_elev,
                    gl_elev=well.gl_elev,
                    td_md=well.td_md or 0.0,
                    x=well.lon if well.lon is not None else 0.0,
                    y=well.lat if well.lat is not None else 0.0,
                    crs=well.crs,
                    source_las_path=well.source_las_path,
                    deviation=DeviationSummaryResponse(
                        reference=deviation.reference,
                        mode=deviation.mode,
                        fields=_deviation_fields(deviation.mode),
                    ) if deviation is not None else None,
                    curves=[
                        CurveInventoryItem(mnemonic=row.mnemonic, unit=row.unit)
                        for row in curve_rows
                    ],
                    formations=[
                        FormationInventoryItem(
                            id=str(row.id),
                            name=row.name,
                            depth_md=row.depth_md,
                            active_strat_color=(
                                _active_link(row).strat_unit.color_hex if _active_link(row) else None
                            ),
                        )
                        for row in formation_rows
                    ],
                )
            )
        return payload


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
            .options(*_formation_load_options())
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
                strat_color=(_active_link(row).strat_unit.color_hex if _active_link(row) else None),
                is_locked=row.is_locked,
                lithology=(
                    _active_link(row).strat_unit.lithology if _active_link(row) else None
                ),
                strat_unit_id=(
                    _active_link(row).strat_unit_id if _active_link(row) else None
                ),
                strat_unit_name=(
                    _active_link(row).strat_unit.name if _active_link(row) else None
                ),
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


@router.patch('/wells/{well_id}', response_model=WellResponse)
def patch_well(well_id: str, payload: WellPatchRequest, request: Request) -> WellResponse:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        well = session.get(WellModel, well_id)
        if well is None:
            raise HTTPException(status_code=404, detail=f'Well not found: {well_id}')

        if payload.well_name is not None:
            next_name = payload.well_name.strip()
            if not next_name:
                raise HTTPException(status_code=400, detail='Well name cannot be empty')
            well.name = next_name
        if payload.kb_elev is not None:
            well.kb_elev = payload.kb_elev
        if payload.gl_elev is not None:
            well.gl_elev = payload.gl_elev
        if payload.td_md is not None:
            well.td_md = payload.td_md
        if payload.x is not None:
            well.lon = payload.x
        if payload.y is not None:
            well.lat = payload.y
        if payload.crs is not None:
            well.crs = payload.crs

        session.commit()

    manager.mark_dirty()
    return get_well(well_id, request)
