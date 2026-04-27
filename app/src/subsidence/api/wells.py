from __future__ import annotations

import math

import pandas as pd
import numpy as np
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from subsidence.data import UpdateWell, load_curves_from_parquet
from subsidence.data.lttb import lttb
from subsidence.data.schema import CurveMetadata, DeviationSurveyModel, FormationStratLink, FormationTopModel, FormationZone, WellActiveSeaLevelCurve, WellActiveTopSet, WellModel, ZoneWellData
from subsidence.data.zone_service import recalculate_zone_thickness

router = APIRouter(tags=['wells'])


class WellListItem(BaseModel):
    well_id: str
    well_name: str
    td_md: float


class CurveInventoryItem(BaseModel):
    mnemonic: str
    unit: str
    trusted_depth_reference: str = 'MD'
    curve_type: str = 'continuous'
    discrete_code_map: str | None = None


class CurvePatchRequest(BaseModel):
    curve_type: str | None = None
    discrete_code_map: str | None = None
    family_code: str | None = None


class FormationInventoryItem(BaseModel):
    id: str
    name: str
    depth_md: float | None
    depth_tvd: float | None = None
    depth_tvdss: float | None = None
    horizon_id: int | None = None
    active_strat_color: str | None = None
    kind: str = 'strat'


class CurveResponse(BaseModel):
    mnemonic: str
    unit: str
    depths: list[float]
    values: list[float]
    null_value: float
    curve_type: str = 'continuous'
    discrete_code_map: str | None = None


class FormationResponse(BaseModel):
    id: str
    name: str
    depth_md: float | None
    depth_tvd: float | None = None
    depth_tvdss: float | None = None
    horizon_id: int | None = None
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
    coordinate_semantics: str = 'project_xy'
    crs: str
    depth_reference: str
    source_las_path: str | None = None
    deviation: DeviationSummaryResponse | None = None
    curves: list[CurveResponse]
    formations: list[FormationResponse]


class ZoneHorizonRef(BaseModel):
    id: int
    name: str
    age_ma: float | None


class ZoneInventoryItem(BaseModel):
    zone_id: int
    top_set_id: int
    upper_horizon: ZoneHorizonRef
    lower_horizon: ZoneHorizonRef
    sort_order: int
    thickness_md: float | None
    thickness_tvd: float | None
    age_span_ma: float | None
    hiatus_ma: float | None
    lithology_fractions: str | None
    lithology_source: str
    water_depth_m: float = 0.0


class ZonePatch(BaseModel):
    lithology_fractions: str | None = None
    lithology_source: str | None = None


class WellInventoryResponse(BaseModel):
    well_id: str
    well_name: str
    kb_elev: float
    gl_elev: float
    td_md: float
    x: float
    y: float
    coordinate_semantics: str = 'project_xy'
    crs: str
    source_las_path: str | None = None
    active_top_set_id: int | None = None
    active_top_set_name: str | None = None
    active_sea_level_curve_id: int | None = None
    deviation: DeviationSummaryResponse | None = None
    curves: list[CurveInventoryItem]
    formations: list[FormationInventoryItem]
    zones: list[ZoneInventoryItem] = []


class WellPatchRequest(BaseModel):
    well_name: str | None = None
    kb_elev: float | None = None
    gl_elev: float | None = None
    td_md: float | None = None
    x: float | None = None
    y: float | None = None
    crs: str | None = None


def _require_finite_number(value: float, field_name: str) -> float:
    if not math.isfinite(value):
        raise HTTPException(status_code=400, detail=f'{field_name} must be a finite number')
    return value


def _require_non_negative_number(value: float, field_name: str) -> float:
    if _require_finite_number(value, field_name) < 0:
        raise HTTPException(status_code=400, detail=f'{field_name} must be >= 0')
    return value



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


def _zone_to_item(zone: FormationZone, zwd: ZoneWellData, water_depth_m: float = 0.0) -> ZoneInventoryItem:
    upper = zone.upper_horizon
    lower = zone.lower_horizon
    age_span = (
        lower.age_ma - upper.age_ma
        if upper.age_ma is not None and lower.age_ma is not None
        else None
    )
    hiatus = age_span if upper.kind == 'unconformity' else None
    return ZoneInventoryItem(
        zone_id=zone.id,
        top_set_id=zone.top_set_id,
        upper_horizon=ZoneHorizonRef(id=upper.id, name=upper.name, age_ma=upper.age_ma),
        lower_horizon=ZoneHorizonRef(id=lower.id, name=lower.name, age_ma=lower.age_ma),
        sort_order=zone.sort_order,
        thickness_md=zwd.thickness_md,
        thickness_tvd=zwd.thickness_tvd,
        age_span_ma=age_span,
        hiatus_ma=hiatus,
        lithology_fractions=zwd.lithology_fractions,
        lithology_source=zwd.lithology_source,
        water_depth_m=water_depth_m,
    )


def _formation_load_options():
    return [
        selectinload(FormationTopModel.strat_links).options(
            selectinload(FormationStratLink.strat_unit),
            selectinload(FormationStratLink.chart),
        )
    ]


def _load_curve_maps(project_path, curve_rows: list[CurveMetadata]) -> dict[str, dict[str, tuple[np.ndarray, np.ndarray]]]:
    curve_maps: dict[str, dict[str, tuple[np.ndarray, np.ndarray]]] = {}
    for data_uri in dict.fromkeys(row.data_uri for row in curve_rows):
        curve_maps[data_uri] = load_curves_from_parquet(project_path, data_uri)
    return curve_maps


@router.get('/wells', response_model=list[WellListItem])
def list_wells(request: Request) -> list[WellListItem]:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        rows = session.scalars(select(WellModel).order_by(WellModel.name.asc(), WellModel.id.asc())).all()
        return [WellListItem(well_id=row.id, well_name=row.name, td_md=row.td_md or 0.0) for row in rows]


@router.get('/wells/inventory', response_model=list[WellInventoryResponse])
def list_well_inventories(request: Request) -> list[WellInventoryResponse]:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        wells = session.scalars(select(WellModel).order_by(WellModel.name.asc(), WellModel.id.asc())).all()
        well_ids = [well.id for well in wells]
        curve_rows_by_well: dict[str, list[CurveMetadata]] = {well_id: [] for well_id in well_ids}
        formation_rows_by_well: dict[str, list[FormationTopModel]] = {well_id: [] for well_id in well_ids}
        deviation_by_well: dict[str, DeviationSurveyModel] = {}
        active_top_set_by_well: dict[str, WellActiveTopSet] = {}
        zones_by_well: dict[str, list[ZoneInventoryItem]] = {well_id: [] for well_id in well_ids}
        sea_level_curve_by_well: dict[str, int] = {}

        if well_ids:
            curve_rows = session.scalars(
                select(CurveMetadata)
                .where(CurveMetadata.well_id.in_(well_ids))
                .order_by(CurveMetadata.well_id.asc(), CurveMetadata.id.asc())
            ).all()
            for row in curve_rows:
                curve_rows_by_well.setdefault(row.well_id, []).append(row)

            formation_rows = session.scalars(
                select(FormationTopModel)
                .where(FormationTopModel.well_id.in_(well_ids))
                .order_by(FormationTopModel.well_id.asc(), FormationTopModel.depth_md.asc().nulls_last(), FormationTopModel.id.asc())
                .options(*_formation_load_options())
            ).all()
            for row in formation_rows:
                formation_rows_by_well.setdefault(row.well_id, []).append(row)

            deviations = session.scalars(
                select(DeviationSurveyModel).where(DeviationSurveyModel.well_id.in_(well_ids))
            ).all()
            deviation_by_well = {row.well_id: row for row in deviations}

            active_top_sets = session.scalars(
                select(WellActiveTopSet)
                .where(WellActiveTopSet.well_id.in_(well_ids))
                .options(selectinload(WellActiveTopSet.top_set))
            ).all()
            active_top_set_by_well = {row.well_id: row for row in active_top_sets}

            sea_level_links = session.scalars(
                select(WellActiveSeaLevelCurve).where(WellActiveSeaLevelCurve.well_id.in_(well_ids))
            ).all()
            sea_level_curve_by_well = {link.well_id: link.curve_id for link in sea_level_links}

            active_top_set_ids = [row.top_set_id for row in active_top_sets]
            if active_top_set_ids:
                zone_rows = session.scalars(
                    select(FormationZone)
                    .where(FormationZone.top_set_id.in_(active_top_set_ids))
                    .options(
                        selectinload(FormationZone.upper_horizon),
                        selectinload(FormationZone.lower_horizon),
                    )
                    .order_by(FormationZone.sort_order.asc())
                ).all()
                zone_by_id = {z.id: z for z in zone_rows}
                zone_well_data_rows = session.scalars(
                    select(ZoneWellData).where(
                        ZoneWellData.zone_id.in_(list(zone_by_id.keys())),
                        ZoneWellData.well_id.in_(well_ids),
                    )
                ).all()
                # Fetch picks keyed by (well_id, horizon_id) for water_depth_m lookup
                horizon_ids = {z.upper_horizon_id for z in zone_rows}
                pick_rows = session.scalars(
                    select(FormationTopModel).where(
                        FormationTopModel.well_id.in_(well_ids),
                        FormationTopModel.horizon_id.in_(horizon_ids),
                    )
                ).all()
                pick_by_well_horizon: dict[tuple[str, int], FormationTopModel] = {
                    (p.well_id, p.horizon_id): p for p in pick_rows if p.horizon_id is not None
                }
                top_set_id_by_well = {row.well_id: row.top_set_id for row in active_top_sets}
                for zwd in zone_well_data_rows:
                    zone = zone_by_id.get(zwd.zone_id)
                    if zone is None:
                        continue
                    well_id = zwd.well_id
                    # Only include if this zone belongs to the well's active top set
                    if top_set_id_by_well.get(well_id) != zone.top_set_id:
                        continue
                    upper_pick = pick_by_well_horizon.get((well_id, zone.upper_horizon_id))
                    wd = upper_pick.water_depth_m if upper_pick is not None else 0.0
                    zones_by_well.setdefault(well_id, []).append(_zone_to_item(zone, zwd, wd))

        payload: list[WellInventoryResponse] = []
        for well in wells:
            curve_rows = curve_rows_by_well.get(well.id, [])
            formation_rows = formation_rows_by_well.get(well.id, [])
            deviation = deviation_by_well.get(well.id)
            active_top_set = active_top_set_by_well.get(well.id)
            payload.append(
                WellInventoryResponse(
                    well_id=well.id,
                    well_name=well.name,
                    kb_elev=well.kb_elev,
                    gl_elev=well.gl_elev,
                    td_md=well.td_md or 0.0,
                    x=well.lon if well.lon is not None else 0.0,
                    y=well.lat if well.lat is not None else 0.0,
                    coordinate_semantics='project_xy',
                    crs=well.crs,
                    source_las_path=well.source_las_path,
                    active_top_set_id=active_top_set.top_set_id if active_top_set else None,
                    active_top_set_name=active_top_set.top_set.name if active_top_set else None,
                    active_sea_level_curve_id=sea_level_curve_by_well.get(well.id),
                    deviation=DeviationSummaryResponse(
                        reference=deviation.reference,
                        mode=deviation.mode,
                        fields=_deviation_fields(deviation.mode),
                    ) if deviation is not None else None,
                    curves=[
                        CurveInventoryItem(
                            mnemonic=row.mnemonic,
                            unit=row.unit,
                            trusted_depth_reference=row.trusted_depth_reference,
                            curve_type=row.curve_type,
                            discrete_code_map=row.discrete_code_map,
                        )
                        for row in curve_rows
                    ],
                    formations=[
                        FormationInventoryItem(
                            id=str(row.id),
                            name=row.name,
                            depth_md=row.depth_md,
                            depth_tvd=row.depth_tvd,
                            depth_tvdss=row.depth_tvdss,
                            horizon_id=row.horizon_id,
                            active_strat_color=(
                                _active_link(row).strat_unit.color_hex if _active_link(row) else None
                            ),
                            kind=row.kind,
                        )
                        for row in formation_rows
                    ],
                    zones=zones_by_well.get(well.id, []),
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
            curve_maps = _load_curve_maps(manager.project_path, curve_rows)
            for row in curve_rows:
                values = curve_maps.get(row.data_uri, {}).get(row.mnemonic)
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
                        curve_type=row.curve_type,
                        discrete_code_map=row.discrete_code_map,
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
                depth_tvd=row.depth_tvd,
                depth_tvdss=row.depth_tvdss,
                horizon_id=row.horizon_id,
                age_ma=row.age_top_ma,
                color=row.color,
                kind=row.kind,
                strat_color=(_active_link(row).strat_unit.color_hex if _active_link(row) else None),
                is_locked=row.is_locked,
                lithology=row.lithology if row.lithology is not None else (
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
            coordinate_semantics='project_xy',
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


@router.get('/wells/{well_id}/curves', response_model=list[CurveResponse])
def get_curves_lod(
    well_id: str,
    request: Request,
    depth_min: float = Query(...),
    depth_max: float = Query(...),
    resolution: int = Query(..., ge=10),
) -> list[CurveResponse]:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        well = session.get(WellModel, well_id)
        if well is None:
            raise HTTPException(status_code=404, detail=f'Well not found: {well_id}')

        curve_rows = list(
            session.scalars(
                select(CurveMetadata)
                .where(CurveMetadata.well_id == well.id)
                .order_by(CurveMetadata.id.asc())
            )
        )
        if not curve_rows:
            return []

        # 5% buffer so curves don't clip at edge of viewport
        span = depth_max - depth_min
        buf = span * 0.05
        lo, hi = depth_min - buf, depth_max + buf

        curve_maps = _load_curve_maps(manager.project_path, curve_rows)
        results: list[CurveResponse] = []
        for row in curve_rows:
            entry = curve_maps.get(row.data_uri, {}).get(row.mnemonic)
            if entry is None:
                continue
            depths, values = entry
            # Clip to buffered window
            mask = (depths >= lo) & (depths <= hi)
            d_clip = depths[mask]
            v_clip = values[mask]
            if len(d_clip) == 0:
                continue
            # LTTB downsample
            idx = lttb(d_clip.astype(np.float64), v_clip.astype(np.float64), resolution)
            results.append(
                CurveResponse(
                    mnemonic=row.mnemonic,
                    unit=row.unit,
                    depths=d_clip[idx].tolist(),
                    values=v_clip[idx].tolist(),
                    null_value=row.null_value,
                    curve_type=row.curve_type,
                    discrete_code_map=row.discrete_code_map,
                )
            )
        return results


@router.get('/wells/{well_id}/curves/full', response_model=list[CurveResponse])
def get_curves_full(
    well_id: str,
    request: Request,
    depth_basis: str = Query(default='MD'),
) -> list[CurveResponse]:
    """Return all curve samples for a well, optionally with depth conversion.

    When depth_basis is 'TVD' or 'TVDSS' and the curve trusted_depth_reference is 'MD'
    and the well has an INCL_AZIM deviation survey, depth arrays are converted on-the-fly.
    Curves with a non-MD trusted_depth_reference are always returned in their native basis.
    """
    from subsidence.data.deviation_transform import _interpolate, _load_survey_arrays

    db_depth_basis = depth_basis.upper()
    manager = _require_open_project(request)
    with manager.get_session() as session:
        well = session.get(WellModel, well_id)
        if well is None:
            raise HTTPException(status_code=404, detail=f'Well not found: {well_id}')

        curve_rows = list(
            session.scalars(
                select(CurveMetadata)
                .where(CurveMetadata.well_id == well.id)
                .order_by(CurveMetadata.id.asc())
            )
        )
        if not curve_rows:
            return []

        # Pre-load survey arrays once for TVD/TVDSS conversion
        survey_arrays: tuple[object, object] | None = None
        if db_depth_basis in ('TVD', 'TVDSS') and well.deviation_survey is not None:
            survey_arrays = _load_survey_arrays(manager.project_path, well.deviation_survey)
        kb_elev = well.kb_elev or 0.0

        curve_maps = _load_curve_maps(manager.project_path, curve_rows)
        results: list[CurveResponse] = []
        for row in curve_rows:
            entry = curve_maps.get(row.data_uri, {}).get(row.mnemonic)
            if entry is None:
                continue
            depths_arr, values_arr = entry

            # Depth conversion: only for MD-native curves when conversion is requested
            if db_depth_basis != 'MD' and row.trusted_depth_reference == 'MD' and survey_arrays is not None:
                md_arr, tvd_arr = survey_arrays
                converted_depths = [
                    float(_interpolate(float(d), md_arr, tvd_arr)) - (kb_elev if db_depth_basis == 'TVDSS' else 0.0)
                    for d in depths_arr
                ]
                results.append(
                    CurveResponse(
                        mnemonic=row.mnemonic,
                        unit=row.unit,
                        depths=converted_depths,
                        values=values_arr.tolist(),
                        null_value=row.null_value,
                        curve_type=row.curve_type,
                        discrete_code_map=row.discrete_code_map,
                    )
                )
            else:
                # Return native depths (covers: MD mode, non-MD curves, no survey)
                results.append(
                    CurveResponse(
                        mnemonic=row.mnemonic,
                        unit=row.unit,
                        depths=depths_arr.tolist(),
                        values=values_arr.tolist(),
                        null_value=row.null_value,
                        curve_type=row.curve_type,
                        discrete_code_map=row.discrete_code_map,
                    )
                )
        return results


@router.patch('/wells/{well_id}/curves/{mnemonic}', response_model=CurveInventoryItem)
def patch_curve_metadata(
    well_id: str,
    mnemonic: str,
    body: CurvePatchRequest,
    request: Request,
) -> CurveInventoryItem:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        well = session.get(WellModel, well_id)
        if well is None:
            raise HTTPException(status_code=404, detail=f'Well not found: {well_id}')
        row = session.scalar(
            select(CurveMetadata)
            .where(CurveMetadata.well_id == well_id, CurveMetadata.mnemonic == mnemonic)
        )
        if row is None:
            raise HTTPException(status_code=404, detail=f'Curve not found: {mnemonic}')
        if body.curve_type is not None:
            if body.curve_type not in ('continuous', 'discrete'):
                raise HTTPException(status_code=422, detail="curve_type must be 'continuous' or 'discrete'")
            row.curve_type = body.curve_type
        if body.discrete_code_map is not None:
            row.discrete_code_map = body.discrete_code_map
        if body.family_code is not None:
            row.family_code = body.family_code
        session.commit()
        return CurveInventoryItem(
            mnemonic=row.mnemonic,
            unit=row.unit,
            trusted_depth_reference=row.trusted_depth_reference,
            curve_type=row.curve_type,
            discrete_code_map=row.discrete_code_map,
        )


@router.post('/wells/{well_id}/zones/recalculate-lithology')
def recalculate_zone_lithology(well_id: str, request: Request) -> dict[str, int]:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        well = session.get(WellModel, well_id)
        if well is None:
            raise HTTPException(status_code=404, detail=f'Well not found: {well_id}')
        from subsidence.data.zone_service import aggregate_zone_lithology_from_curve
        updated = aggregate_zone_lithology_from_curve(session, manager.project_path, well_id)
        session.commit()
    return {'zones_updated': updated}


@router.get('/wells/{well_id}/zones', response_model=list[ZoneInventoryItem])
def list_well_zones(well_id: str, request: Request) -> list[ZoneInventoryItem]:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        well = session.get(WellModel, well_id)
        if well is None:
            raise HTTPException(status_code=404, detail=f'Well not found: {well_id}')

        from sqlalchemy import select as _select
        from subsidence.data.schema import WellActiveTopSet as _WATS
        link = session.scalar(_select(_WATS).where(_WATS.well_id == well_id))
        if link is None:
            return []

        zone_rows = session.scalars(
            select(FormationZone)
            .where(FormationZone.top_set_id == link.top_set_id)
            .options(
                selectinload(FormationZone.upper_horizon),
                selectinload(FormationZone.lower_horizon),
            )
            .order_by(FormationZone.sort_order.asc())
        ).all()
        if not zone_rows:
            return []

        zone_ids = [z.id for z in zone_rows]
        zwd_by_zone = {
            row.zone_id: row
            for row in session.scalars(
                select(ZoneWellData).where(
                    ZoneWellData.zone_id.in_(zone_ids),
                    ZoneWellData.well_id == well_id,
                )
            ).all()
        }

        result: list[ZoneInventoryItem] = []
        for zone in zone_rows:
            zwd = zwd_by_zone.get(zone.id)
            if zwd is None:
                continue
            result.append(_zone_to_item(zone, zwd))
        return result


@router.patch('/wells/{well_id}/zones/{zone_id}', response_model=ZoneInventoryItem)
def patch_well_zone(well_id: str, zone_id: int, body: ZonePatch, request: Request) -> ZoneInventoryItem:
    import json as _json
    manager = _require_open_project(request)
    with manager.get_session() as session:
        well = session.get(WellModel, well_id)
        if well is None:
            raise HTTPException(status_code=404, detail=f'Well not found: {well_id}')

        zone = session.scalar(
            select(FormationZone)
            .where(FormationZone.id == zone_id)
            .options(
                selectinload(FormationZone.upper_horizon),
                selectinload(FormationZone.lower_horizon),
            )
        )
        if zone is None:
            raise HTTPException(status_code=404, detail=f'Zone not found: {zone_id}')

        zwd = session.scalar(
            select(ZoneWellData).where(
                ZoneWellData.zone_id == zone_id,
                ZoneWellData.well_id == well_id,
            )
        )
        if zwd is None:
            raise HTTPException(status_code=404, detail=f'Zone data not found for well {well_id}')

        if body.lithology_fractions is not None:
            try:
                fracs = _json.loads(body.lithology_fractions)
            except _json.JSONDecodeError:
                raise HTTPException(status_code=400, detail='lithology_fractions must be valid JSON')
            if not isinstance(fracs, dict):
                raise HTTPException(status_code=400, detail='lithology_fractions must be a JSON object')
            total = sum(fracs.values())
            if total > 1.0 + 1e-9:
                raise HTTPException(status_code=400, detail=f'Lithology fractions sum to {total:.3f}; must be ≤ 1.0')
            zwd.lithology_fractions = body.lithology_fractions

        if body.lithology_source is not None:
            if body.lithology_source not in ('manual', 'auto'):
                raise HTTPException(status_code=400, detail="lithology_source must be 'manual' or 'auto'")
            zwd.lithology_source = body.lithology_source

        session.commit()
        session.refresh(zwd)
        return _zone_to_item(zone, zwd)


@router.patch('/wells/{well_id}', response_model=WellResponse)
def patch_well(well_id: str, payload: WellPatchRequest, request: Request) -> WellResponse:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        well = session.get(WellModel, well_id)
        if well is None:
            raise HTTPException(status_code=404, detail=f'Well not found: {well_id}')

        old_values: dict[str, object] = {}
        new_values: dict[str, object] = {}

        if payload.well_name is not None:
            next_name = payload.well_name.strip()
            if not next_name:
                raise HTTPException(status_code=400, detail='Well name cannot be empty')
            if well.name != next_name:
                old_values['name'] = well.name
                new_values['name'] = next_name
        if payload.kb_elev is not None:
            next_kb = _require_non_negative_number(payload.kb_elev, 'KB')
            if well.kb_elev != next_kb:
                old_values['kb_elev'] = well.kb_elev
                new_values['kb_elev'] = next_kb
        if payload.gl_elev is not None:
            next_gl = _require_finite_number(payload.gl_elev, 'GL')
            if well.gl_elev != next_gl:
                old_values['gl_elev'] = well.gl_elev
                new_values['gl_elev'] = next_gl
        if payload.td_md is not None:
            next_td = _require_non_negative_number(payload.td_md, 'TD')
            if well.td_md != next_td:
                old_values['td_md'] = well.td_md
                new_values['td_md'] = next_td
        if payload.x is not None:
            next_x = _require_finite_number(payload.x, 'Project X')
            if well.lon != next_x:
                old_values['lon'] = well.lon
                new_values['lon'] = next_x
        if payload.y is not None:
            next_y = _require_finite_number(payload.y, 'Project Y')
            if well.lat != next_y:
                old_values['lat'] = well.lat
                new_values['lat'] = next_y
        if payload.crs is not None:
            next_crs = payload.crs.strip()
            if not next_crs:
                raise HTTPException(status_code=400, detail='CRS cannot be empty')
            if well.crs != next_crs:
                old_values['crs'] = well.crs
                new_values['crs'] = next_crs

    if new_values:
        manager.execute_command(UpdateWell(well_id, old_values, new_values))

    return get_well(well_id, request)


class DeviationSurveyResponse(BaseModel):
    md: list[float]
    inclination_deg: list[float]
    azimuth_deg: list[float]


@router.get('/wells/{well_id}/deviation', response_model=DeviationSurveyResponse)
def get_deviation(well_id: str, request: Request) -> DeviationSurveyResponse:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        well = session.get(WellModel, well_id)
        if well is None:
            raise HTTPException(status_code=404, detail=f'Well not found: {well_id}')
        survey = session.scalar(select(DeviationSurveyModel).where(DeviationSurveyModel.well_id == well.id))
        if survey is None or survey.mode != 'INCL_AZIM':
            raise HTTPException(status_code=404, detail='No INCL_AZIM deviation survey for this well')
        data_uri = survey.data_uri

    parquet_path = manager.project_path / data_uri
    frame: pd.DataFrame = pd.read_parquet(parquet_path)
    # Depth column is named 'md', 'tvd', or 'tvdss' depending on what was imported
    depth_col = next((c for c in frame.columns if c.lower() in ('md', 'tvd', 'tvdss')), None)
    if depth_col is None or 'incl_deg' not in frame.columns or 'azim_deg' not in frame.columns:
        raise HTTPException(status_code=422, detail='Deviation parquet missing required columns')

    return DeviationSurveyResponse(
        md=frame[depth_col].tolist(),
        inclination_deg=frame['incl_deg'].tolist(),
        azimuth_deg=frame['azim_deg'].tolist(),
    )
