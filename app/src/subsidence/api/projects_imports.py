from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select

from subsidence.data import (
    ImportWell,
    import_deviation_csv,
    import_las_file,
    import_logs_csv,
    import_tops_csv,
    import_unconformities_csv,
    link_tops_to_unconformities,
)
from subsidence.data.deviation_transform import recalculate_picks_tvd
from subsidence.data.schema import CurveMetadata, FormationTopModel, FormationZone, TopSet, TopSetHorizon, WellModel
from subsidence.data.zone_service import (
    activate_top_set_for_well,
    extract_horizons_from_well_picks,
    rebuild_zones_for_top_set,
)
from subsidence.observability import operation_log

from .projects import (
    ImportDeviationRequest,
    ImportDeviationResponse,
    ImportLasRequest,
    ImportLasResponse,
    ImportLogsCsvRequest,
    ImportTopsRequest,
    ImportTopsResponse,
    ImportUnconformitiesRequest,
    ImportUnconformitiesResponse,
    _manager_project_path,
    _require_open_project,
)

router = APIRouter(tags=['projects'])


def _top_name_key(name: str | None) -> str:
    return (name or '').strip().lower()


def _resolve_import_top_set(
    session,
    payload: ImportTopsRequest,
    target_well_id: str,
) -> int | None:
    if payload.create_zone_set and payload.zone_set_id is not None:
        raise HTTPException(status_code=400, detail='Choose either create_zone_set or zone_set_id, not both')
    if not payload.create_zone_set and payload.zone_set_id is None:
        return None

    if payload.zone_set_id is not None:
        if session.get(TopSet, payload.zone_set_id) is None:
            raise HTTPException(status_code=404, detail=f'TopSet not found: {payload.zone_set_id}')
        return payload.zone_set_id

    well = session.get(WellModel, target_well_id)
    name = (payload.zone_set_name or '').strip()
    if not name:
        name = f'{well.name if well else target_well_id} tops'

    top_set = TopSet(name=name, description='Created during tops import')
    session.add(top_set)
    session.flush()
    extract_horizons_from_well_picks(session, top_set.id, target_well_id)
    rebuild_zones_for_top_set(session, top_set.id)
    return top_set.id


def _zone_set_qc_warnings(
    session,
    top_set_id: int,
    imported: list[FormationTopModel],
    target_well_id: str,
) -> list[str]:
    imported_names = {
        _top_name_key(pick.name)
        for pick in imported
        if pick.well_id == target_well_id and _top_name_key(pick.name)
    }
    if not imported_names:
        return []

    horizon_names = {
        _top_name_key(horizon.name)
        for horizon in session.scalars(
            select(TopSetHorizon).where(TopSetHorizon.top_set_id == top_set_id)
        ).all()
    }
    unmatched = sorted(imported_names.difference(horizon_names))
    if not unmatched:
        return []

    return [
        f'{len(unmatched)} imported top(s) were not found in the selected ZoneSet horizons: {", ".join(unmatched[:8])}'
    ]


@router.post('/import-las', response_model=ImportLasResponse)
def import_las(payload: ImportLasRequest, request: Request) -> ImportLasResponse:
    manager = _require_open_project(request)
    with operation_log('import.las', project_path=_manager_project_path(manager), input_path=payload.las_path, well_id=payload.well_id, create_new_well=payload.create_new_well):
        try:
            with manager.get_session() as session:
                well, qc_warnings = import_las_file(
                    session,
                    manager.project_path,
                    Path(payload.las_path),
                    well_id=payload.well_id,
                    create_new_well=payload.create_new_well,
                    trusted_depth_reference=payload.trusted_depth_reference,
                )
                session.flush()
                command = ImportWell.capture(session, manager.project_path, well.id)
                well_id = well.id
                well_name = well.name
                curve_count = len(list(session.scalars(select(CurveMetadata).where(CurveMetadata.well_id == well_id))))
                session.commit()
            manager.execute_command(command)
            manager.save_project()
            with manager.get_session() as session:
                from subsidence.data.zone_service import aggregate_zone_lithology_from_curve
                aggregate_zone_lithology_from_curve(session, manager.project_path, well_id)
                session.commit()
        except (ValueError, FileNotFoundError) as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        return ImportLasResponse(well_id=well_id, well_name=well_name, curve_count=curve_count, qc_warnings=qc_warnings)


@router.post('/import-logs-csv', response_model=ImportLasResponse)
def import_logs_csv_route(payload: ImportLogsCsvRequest, request: Request) -> ImportLasResponse:
    manager = _require_open_project(request)
    with operation_log('import.logs_csv', project_path=_manager_project_path(manager), input_path=payload.csv_path, well_id=payload.well_id, depth_column=payload.depth_column, create_new_well=payload.create_new_well):
        try:
            with manager.get_session() as session:
                well, qc_warnings = import_logs_csv(
                    session,
                    manager.project_path,
                    Path(payload.csv_path),
                    well_id=payload.well_id,
                    depth_column=payload.depth_column,
                    create_new_well=payload.create_new_well,
                    trusted_depth_reference=payload.trusted_depth_reference,
                )
                session.flush()
                command = ImportWell.capture(session, manager.project_path, well.id)
                well_id = well.id
                well_name = well.name
                curve_count = len(list(session.scalars(select(CurveMetadata).where(CurveMetadata.well_id == well_id))))
                session.commit()
            manager.execute_command(command)
            manager.save_project()
            with manager.get_session() as session:
                from subsidence.data.zone_service import aggregate_zone_lithology_from_curve
                aggregate_zone_lithology_from_curve(session, manager.project_path, well_id)
                session.commit()
        except (ValueError, FileNotFoundError) as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        return ImportLasResponse(well_id=well_id, well_name=well_name, curve_count=curve_count, qc_warnings=qc_warnings)


@router.post('/import-tops', response_model=ImportTopsResponse)
def import_tops(payload: ImportTopsRequest, request: Request) -> ImportTopsResponse:
    manager = _require_open_project(request)
    with operation_log('import.tops', project_path=_manager_project_path(manager), input_path=payload.csv_path, well_id=payload.well_id, depth_ref=payload.depth_ref, create_new_well=payload.create_new_well):
        try:
            with manager.get_session() as session:
                imported, qc_warnings = import_tops_csv(
                    session,
                    payload.well_id,
                    Path(payload.csv_path),
                    payload.depth_ref,
                    column_map=payload.column_map or None,
                    create_new_well=payload.create_new_well,
                )
                target_well_id = imported[0].well_id if imported else payload.well_id
                if target_well_id is None:
                    raise HTTPException(status_code=500, detail='Import created no well')
                linked = link_tops_to_unconformities(session, target_well_id)
                well = session.get(WellModel, target_well_id)
                if well:
                    recalculate_picks_tvd(session, manager.project_path, well)
                formation_count = len(list(session.scalars(select(FormationTopModel).where(FormationTopModel.well_id == target_well_id))))
                zone_set_id = _resolve_import_top_set(session, payload, target_well_id)
                horizon_count = 0
                zone_count = 0
                if zone_set_id is not None:
                    qc_warnings.extend(_zone_set_qc_warnings(session, zone_set_id, imported, target_well_id))
                    activate_top_set_for_well(session, manager.project_path, target_well_id, zone_set_id)
                    horizon_count = len(list(session.scalars(select(TopSetHorizon).where(TopSetHorizon.top_set_id == zone_set_id))))
                    zone_count = len(list(session.scalars(select(FormationZone).where(FormationZone.top_set_id == zone_set_id))))
                session.commit()
            manager.save_project()
        except (ValueError, FileNotFoundError) as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        return ImportTopsResponse(
            well_id=target_well_id,
            formation_count=formation_count,
            linked_count=len(linked),
            zone_set_id=zone_set_id,
            horizon_count=horizon_count,
            zone_count=zone_count,
            qc_warnings=qc_warnings,
        )


@router.post('/import-unconformities', response_model=ImportUnconformitiesResponse)
def import_unconformities(payload: ImportUnconformitiesRequest, request: Request) -> ImportUnconformitiesResponse:
    manager = _require_open_project(request)
    with operation_log('import.unconformities', project_path=_manager_project_path(manager), input_path=payload.csv_path, well_id=payload.well_id):
        try:
            with manager.get_session() as session:
                import_unconformities_csv(session, payload.well_id, Path(payload.csv_path), column_map=payload.column_map or None)
                linked = link_tops_to_unconformities(session, payload.well_id)
                formation_count = len(list(session.scalars(select(FormationTopModel).where(FormationTopModel.well_id == payload.well_id))))
                session.commit()
            manager.save_project()
        except (ValueError, FileNotFoundError) as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        return ImportUnconformitiesResponse(well_id=payload.well_id, formation_count=formation_count, linked_count=len(linked))


@router.post('/import-deviation', response_model=ImportDeviationResponse)
def import_deviation(payload: ImportDeviationRequest, request: Request) -> ImportDeviationResponse:
    manager = _require_open_project(request)
    with operation_log('import.deviation', project_path=_manager_project_path(manager), input_path=payload.csv_path, well_id=payload.well_id, create_new_well=payload.create_new_well):
        try:
            with manager.get_session() as session:
                survey = import_deviation_csv(
                    session,
                    manager.project_path,
                    payload.well_id,
                    Path(payload.csv_path),
                    column_map=payload.column_map or None,
                    create_new_well=payload.create_new_well,
                )
                target_well_id = survey.well_id
                reference = survey.reference
                mode = survey.mode
                data_uri = survey.data_uri
                well = session.get(WellModel, target_well_id)
                updated_count = recalculate_picks_tvd(session, manager.project_path, well) if well else 0
                session.commit()
            manager.save_project()
        except (ValueError, FileNotFoundError) as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        return ImportDeviationResponse(well_id=target_well_id, reference=reference, mode=mode, data_uri=data_uri)
