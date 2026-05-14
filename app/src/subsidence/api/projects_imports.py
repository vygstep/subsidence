from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import func, select

from subsidence.data import (
    ImportWell,
    import_deviation_csv,
    import_deviation_csv_multi,
    import_las_file,
    import_logs_csv,
    import_logs_csv_multi,
    import_tops_csv,
    import_tops_csv_multi,
    import_wells_rows,
)
from subsidence.data.deviation_transform import recalculate_picks_tvd
from subsidence.data.deviation_transform import deviation_extrapolation_warning_for_import
from subsidence.data.schema import CurveMetadata, FormationTopModel, FormationZone, TopSet, TopSetHorizon, WellModel
from subsidence.data.zone_service import (
    activate_top_set_for_well,
    linked_well_ids_for_top_set,
    normalize_top_set_horizon_order,
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
    ImportWellsRequest,
    ImportWellsResponse,
    _manager_project_path,
    _require_open_project,
)

router = APIRouter(tags=['projects'])


def _top_name_key(name: str | None) -> str:
    return (name or '').strip().lower()


def _ensure_top_set_name_available(session, name: str) -> None:
    existing = session.scalar(
        select(TopSet).where(func.lower(TopSet.name) == name.lower())
    )
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail=f'TopSet "{name}" already exists; choose the existing TopSet or use a different name.',
        )


def _resolve_import_top_set(
    session,
    payload: ImportTopsRequest,
    target_well_id: str | None,
) -> int | None:
    if payload.create_zone_set and payload.zone_set_id is not None:
        raise HTTPException(status_code=400, detail='Choose either create_zone_set or zone_set_id, not both')
    if not payload.create_zone_set and payload.zone_set_id is None:
        return None

    if payload.zone_set_id is not None:
        if session.get(TopSet, payload.zone_set_id) is None:
            raise HTTPException(status_code=404, detail=f'TopSet not found: {payload.zone_set_id}')
        return payload.zone_set_id

    name = (payload.zone_set_name or '').strip()
    if not name:
        well = session.get(WellModel, target_well_id) if target_well_id is not None else None
        name = f'{well.name if well else "Imported"} tops'

    _ensure_top_set_name_available(session, name)
    top_set = TopSet(name=name, description='Created during tops import')
    session.add(top_set)
    session.flush()
    return top_set.id


def _zone_set_qc_warnings(
    session,
    top_set_id: int,
    imported: list[FormationTopModel],
    target_well_id: str | None,
) -> list[str]:
    imported_names = {
        _top_name_key(pick.name)
        for pick in imported
        if (target_well_id is None or pick.well_id == target_well_id) and _top_name_key(pick.name)
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
        f'{len(unmatched)} imported top(s) were not found in the selected TopSet horizons: {", ".join(unmatched[:8])}'
    ]


@router.post('/import-las', response_model=ImportLasResponse)
def import_las(payload: ImportLasRequest, request: Request) -> ImportLasResponse:
    manager = _require_open_project(request)
    with operation_log('import.las', project_path=_manager_project_path(manager), input_path=payload.las_path, well_id=payload.well_id, create_new_well=payload.create_new_well):
        try:
            with manager.get_session() as session:
                well, qc_warnings, imported_max_md = import_las_file(
                    session,
                    manager.project_path,
                    Path(payload.las_path),
                    well_id=payload.well_id,
                    create_new_well=payload.create_new_well,
                    trusted_depth_reference=payload.trusted_depth_reference,
                )
                well.depth_unit = payload.depth_unit
                session.flush()
                well_id = well.id
                if payload.curve_types:
                    for curve_row in session.scalars(select(CurveMetadata).where(CurveMetadata.well_id == well_id)):
                        ct = payload.curve_types.get(curve_row.mnemonic)
                        if ct in ('continuous', 'discrete'):
                            curve_row.curve_type = ct
                deviation_warning = deviation_extrapolation_warning_for_import(manager.project_path, well, imported_max_md)
                if deviation_warning is not None:
                    qc_warnings.append(deviation_warning)
                command = ImportWell.capture(session, manager.project_path, well.id)
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
            if payload.multi_well:
                with manager.get_session() as session:
                    wells, qc_warnings, imported_max_by_well, imported_row_count = import_logs_csv_multi(
                        session,
                        manager.project_path,
                        Path(payload.csv_path),
                        depth_column=payload.depth_column,
                        create_new_well=payload.create_new_well,
                        trusted_depth_reference=payload.trusted_depth_reference,
                    )
                    well_ids = [well.id for well in wells]
                    for well in wells:
                        well.depth_unit = payload.depth_unit
                    session.flush()
                    if payload.curve_types:
                        for curve_row in session.scalars(select(CurveMetadata).where(CurveMetadata.well_id.in_(well_ids))):
                            ct = payload.curve_types.get(curve_row.mnemonic)
                            if ct in ('continuous', 'discrete'):
                                curve_row.curve_type = ct
                    for well in wells:
                        deviation_warning = deviation_extrapolation_warning_for_import(manager.project_path, well, imported_max_by_well.get(well.id))
                        if deviation_warning is not None:
                            qc_warnings.append(deviation_warning)
                    commands = [ImportWell.capture(session, manager.project_path, well.id) for well in wells]
                    first_well = wells[0]
                    curve_count = len(list(session.scalars(select(CurveMetadata).where(CurveMetadata.well_id.in_(well_ids)))))
                    session.commit()
                for command in commands:
                    manager.execute_command(command)
                manager.save_project()
                with manager.get_session() as session:
                    from subsidence.data.zone_service import aggregate_zone_lithology_from_curve
                    for well_id in well_ids:
                        aggregate_zone_lithology_from_curve(session, manager.project_path, well_id)
                    session.commit()
                return ImportLasResponse(
                    well_id=first_well.id,
                    well_name=first_well.name,
                    curve_count=curve_count,
                    qc_warnings=qc_warnings,
                    well_ids=well_ids,
                    imported_well_count=len(well_ids),
                    imported_row_count=imported_row_count,
                )

            with manager.get_session() as session:
                well, qc_warnings, imported_max_md = import_logs_csv(
                    session,
                    manager.project_path,
                    Path(payload.csv_path),
                    well_id=payload.well_id,
                    depth_column=payload.depth_column,
                    create_new_well=payload.create_new_well,
                    trusted_depth_reference=payload.trusted_depth_reference,
                )
                well.depth_unit = payload.depth_unit
                session.flush()
                well_id = well.id
                if payload.curve_types:
                    for curve_row in session.scalars(select(CurveMetadata).where(CurveMetadata.well_id == well_id)):
                        ct = payload.curve_types.get(curve_row.mnemonic)
                        if ct in ('continuous', 'discrete'):
                            curve_row.curve_type = ct
                deviation_warning = deviation_extrapolation_warning_for_import(manager.project_path, well, imported_max_md)
                if deviation_warning is not None:
                    qc_warnings.append(deviation_warning)
                command = ImportWell.capture(session, manager.project_path, well.id)
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
        return ImportLasResponse(well_id=well_id, well_name=well_name, curve_count=curve_count, qc_warnings=qc_warnings, well_ids=[well_id])


@router.post('/import-wells', response_model=ImportWellsResponse)
def import_wells(payload: ImportWellsRequest, request: Request) -> ImportWellsResponse:
    manager = _require_open_project(request)
    with operation_log('import.wells', project_path=_manager_project_path(manager), input_path=payload.csv_path):
        try:
            with manager.get_session() as session:
                from subsidence.data.importers.common import _apply_column_map, _read_csv_rows

                source_path = Path(payload.csv_path)
                fieldnames, rows = _read_csv_rows(source_path)
                if payload.column_map:
                    fieldnames, rows = _apply_column_map(fieldnames, rows, payload.column_map)
                wells, qc_warnings, imported_row_count = import_wells_rows(session, source_path, fieldnames, rows)
                well_ids = [well.id for well in wells]
                commands = [ImportWell.capture(session, manager.project_path, well.id) for well in wells]
                session.commit()
            for command in commands:
                manager.execute_command(command)
            manager.save_project()
        except (ValueError, FileNotFoundError) as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        return ImportWellsResponse(
            well_id=well_ids[0] if well_ids else '',
            well_ids=well_ids,
            imported_well_count=len(well_ids),
            imported_row_count=imported_row_count,
            qc_warnings=qc_warnings,
        )


@router.post('/import-tops', response_model=ImportTopsResponse)
def import_tops(payload: ImportTopsRequest, request: Request) -> ImportTopsResponse:
    manager = _require_open_project(request)
    with operation_log('import.tops', project_path=_manager_project_path(manager), input_path=payload.csv_path, well_id=payload.well_id, depth_ref=payload.depth_ref, create_new_well=payload.create_new_well):
        try:
            with manager.get_session() as session:
                target_well_id = payload.well_id
                zone_set_id = _resolve_import_top_set(session, payload, target_well_id) if target_well_id is not None else None
                imported_row_count: int | None = None
                if payload.multi_well:
                    if zone_set_id is None:
                        zone_set_id = _resolve_import_top_set(session, payload, None)
                    imported, qc_warnings, imported_well_ids, imported_row_count = import_tops_csv_multi(
                        session,
                        Path(payload.csv_path),
                        payload.depth_ref,
                        column_map=payload.column_map or None,
                        create_new_well=payload.create_new_well,
                        top_set_id=zone_set_id,
                    )
                else:
                    imported, qc_warnings = import_tops_csv(
                        session,
                        payload.well_id,
                        Path(payload.csv_path),
                        payload.depth_ref,
                        column_map=payload.column_map or None,
                        create_new_well=payload.create_new_well,
                        top_set_id=zone_set_id,
                    )
                    imported_well_ids = sorted({pick.well_id for pick in imported})
                first_pass_qc_warnings = list(qc_warnings)
                target_well_id = imported[0].well_id if imported else target_well_id
                if target_well_id is None:
                    raise HTTPException(status_code=500, detail='Import created no well')
                if zone_set_id is None and not payload.multi_well:
                    zone_set_id = _resolve_import_top_set(session, payload, target_well_id)
                    if zone_set_id is not None:
                        for pick in imported:
                            pick.horizon_id = None
                        session.flush()
                        # Re-run as an upsert into the newly created/resolved TopSet now that the target well is known.
                        imported, qc_warnings = import_tops_csv(
                            session,
                            target_well_id,
                            Path(payload.csv_path),
                            payload.depth_ref,
                            column_map=payload.column_map or None,
                            create_new_well=False,
                            top_set_id=zone_set_id,
                        )
                        qc_warnings = first_pass_qc_warnings + qc_warnings
                affected_well_ids = imported_well_ids or ([target_well_id] if target_well_id else [])
                for affected_well_id in affected_well_ids:
                    affected_well = session.get(WellModel, affected_well_id)
                    if affected_well:
                        affected_well.depth_unit = payload.depth_unit
                        imported_max_md = max((pick.depth_md or 0.0) for pick in imported if pick.well_id == affected_well_id) if imported else None
                        deviation_warning = deviation_extrapolation_warning_for_import(manager.project_path, affected_well, imported_max_md)
                        if deviation_warning is not None:
                            qc_warnings.append(deviation_warning)
                        recalculate_picks_tvd(session, manager.project_path, affected_well)
                horizon_count = 0
                zone_count = 0
                if zone_set_id is not None:
                    normalize_top_set_horizon_order(session, zone_set_id)
                    rebuild_zones_for_top_set(session, zone_set_id)
                    qc_warnings.extend(_zone_set_qc_warnings(session, zone_set_id, imported, None if payload.multi_well else target_well_id))
                    include_ids = affected_well_ids or [target_well_id]
                    linked_ids = set()
                    for include_well_id in include_ids:
                        linked_ids.update(linked_well_ids_for_top_set(session, zone_set_id, include_well_id=include_well_id))
                    for linked_well_id in sorted(linked_ids):
                        activate_top_set_for_well(session, manager.project_path, linked_well_id, zone_set_id)
                    horizon_count = len(list(session.scalars(select(TopSetHorizon).where(TopSetHorizon.top_set_id == zone_set_id))))
                    zone_count = len(list(session.scalars(select(FormationZone).where(FormationZone.top_set_id == zone_set_id))))
                formation_count = len(list(session.scalars(select(FormationTopModel).where(FormationTopModel.well_id == target_well_id))))
                session.commit()
            manager.save_project()
        except (ValueError, FileNotFoundError) as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        return ImportTopsResponse(
            well_id=target_well_id,
            formation_count=formation_count,
            linked_count=0,
            zone_set_id=zone_set_id,
            horizon_count=horizon_count,
            zone_count=zone_count,
            qc_warnings=qc_warnings,
            well_ids=affected_well_ids,
            imported_well_count=len(affected_well_ids),
            imported_row_count=imported_row_count,
        )


@router.post('/import-deviation', response_model=ImportDeviationResponse)
def import_deviation(payload: ImportDeviationRequest, request: Request) -> ImportDeviationResponse:
    manager = _require_open_project(request)
    with operation_log('import.deviation', project_path=_manager_project_path(manager), input_path=payload.csv_path, well_id=payload.well_id, create_new_well=payload.create_new_well):
        try:
            if payload.multi_well:
                with manager.get_session() as session:
                    surveys, qc_warnings, imported_row_count = import_deviation_csv_multi(
                        session,
                        manager.project_path,
                        Path(payload.csv_path),
                        column_map=payload.column_map or None,
                        create_new_well=payload.create_new_well,
                    )
                    for survey in surveys:
                        survey.depth_unit = payload.depth_unit
                    well_ids = [survey.well_id for survey in surveys]
                    first = surveys[0]
                    reference = first.reference
                    mode = first.mode
                    data_uri = first.data_uri
                    for well_id in well_ids:
                        well = session.get(WellModel, well_id)
                        if well:
                            recalculate_picks_tvd(session, manager.project_path, well)
                    session.commit()
                manager.save_project()
                return ImportDeviationResponse(
                    well_id=first.well_id,
                    reference=reference,
                    mode=mode,
                    data_uri=data_uri,
                    qc_warnings=qc_warnings,
                    well_ids=well_ids,
                    imported_well_count=len(well_ids),
                    imported_row_count=imported_row_count,
                )

            with manager.get_session() as session:
                survey, qc_warnings = import_deviation_csv(
                    session,
                    manager.project_path,
                    payload.well_id,
                    Path(payload.csv_path),
                    column_map=payload.column_map or None,
                    create_new_well=payload.create_new_well,
                )
                survey.depth_unit = payload.depth_unit
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
        return ImportDeviationResponse(well_id=target_well_id, reference=reference, mode=mode, data_uri=data_uri, qc_warnings=qc_warnings, well_ids=[target_well_id])
