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
from subsidence.data.schema import CurveMetadata, FormationTopModel
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


@router.post('/import-las', response_model=ImportLasResponse)
def import_las(payload: ImportLasRequest, request: Request) -> ImportLasResponse:
    manager = _require_open_project(request)
    with operation_log('import.las', project_path=_manager_project_path(manager), input_path=payload.las_path, well_id=payload.well_id, create_new_well=payload.create_new_well):
        try:
            with manager.get_session() as session:
                well = import_las_file(
                    session,
                    manager.project_path,
                    Path(payload.las_path),
                    well_id=payload.well_id,
                    create_new_well=payload.create_new_well,
                )
                session.flush()
                command = ImportWell.capture(session, manager.project_path, well.id)
                well_id = well.id
                well_name = well.name
                curve_count = len(list(session.scalars(select(CurveMetadata).where(CurveMetadata.well_id == well_id))))
                session.commit()
            manager.execute_command(command)
            manager.save_project()
        except (ValueError, FileNotFoundError) as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        return ImportLasResponse(well_id=well_id, well_name=well_name, curve_count=curve_count)


@router.post('/import-logs-csv', response_model=ImportLasResponse)
def import_logs_csv_route(payload: ImportLogsCsvRequest, request: Request) -> ImportLasResponse:
    manager = _require_open_project(request)
    with operation_log('import.logs_csv', project_path=_manager_project_path(manager), input_path=payload.csv_path, well_id=payload.well_id, depth_column=payload.depth_column, create_new_well=payload.create_new_well):
        try:
            with manager.get_session() as session:
                well = import_logs_csv(
                    session,
                    manager.project_path,
                    Path(payload.csv_path),
                    well_id=payload.well_id,
                    depth_column=payload.depth_column,
                    create_new_well=payload.create_new_well,
                )
                session.flush()
                command = ImportWell.capture(session, manager.project_path, well.id)
                well_id = well.id
                well_name = well.name
                curve_count = len(list(session.scalars(select(CurveMetadata).where(CurveMetadata.well_id == well_id))))
                session.commit()
            manager.execute_command(command)
            manager.save_project()
        except (ValueError, FileNotFoundError) as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        return ImportLasResponse(well_id=well_id, well_name=well_name, curve_count=curve_count)


@router.post('/import-tops', response_model=ImportTopsResponse)
def import_tops(payload: ImportTopsRequest, request: Request) -> ImportTopsResponse:
    manager = _require_open_project(request)
    with operation_log('import.tops', project_path=_manager_project_path(manager), input_path=payload.csv_path, well_id=payload.well_id, depth_ref=payload.depth_ref, create_new_well=payload.create_new_well):
        try:
            with manager.get_session() as session:
                imported = import_tops_csv(
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
                formation_count = len(list(session.scalars(select(FormationTopModel).where(FormationTopModel.well_id == target_well_id))))
                session.commit()
            manager.save_project()
        except (ValueError, FileNotFoundError, NotImplementedError) as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        return ImportTopsResponse(well_id=target_well_id, formation_count=formation_count, linked_count=len(linked))


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
                session.commit()
            manager.save_project()
        except (ValueError, FileNotFoundError) as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        return ImportDeviationResponse(well_id=target_well_id, reference=reference, mode=mode, data_uri=data_uri)
