from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select

from subsidence.data import (
    ProjectManager,
    import_deviation_csv,
    import_las_file,
    import_tops_csv,
    import_unconformities_csv,
    link_tops_to_unconformities,
    load_curve_alias_rules,
    load_lithology_entries,
)
from subsidence.data.schema import CurveDictEntry, CurveMetadata, FormationTopModel, LithologyDictEntry

router = APIRouter(tags=['projects'])


class CreateProjectRequest(BaseModel):
    name: str
    path: str


class OpenProjectRequest(BaseModel):
    path: str


class ImportLasRequest(BaseModel):
    las_path: str


class ImportTopsRequest(BaseModel):
    well_id: str
    csv_path: str
    depth_ref: str = 'MD'


class ImportUnconformitiesRequest(BaseModel):
    well_id: str
    csv_path: str


class ImportDeviationRequest(BaseModel):
    well_id: str
    csv_path: str


class CreateCheckpointRequest(BaseModel):
    name: str
    description: str = ''


class AddCurveRuleRequest(BaseModel):
    pattern: str
    is_regex: bool = False
    priority: int = 0
    family_code: str | None = None
    canonical_mnemonic: str | None = None
    canonical_unit: str | None = None
    is_active: bool = True


class UpdateLithologyRequest(BaseModel):
    display_name: str | None = None
    color_hex: str | None = None


class ProjectStatusResponse(BaseModel):
    is_open: bool
    is_dirty: bool
    can_undo: bool
    can_redo: bool
    project_name: str | None = None
    project_path: str | None = None
    working_db_path: str | None = None


class UndoRedoResponse(BaseModel):
    description: str
    can_undo: bool
    can_redo: bool
    is_dirty: bool


class CheckpointResponse(BaseModel):
    id: int
    name: str
    description: str
    timestamp: str
    file_path: str
    byte_size: int
    sha256: str
    app_version: str
    schema_version: int


class CurveRuleResponse(BaseModel):
    id: int
    scope: str
    pattern: str
    is_regex: bool
    priority: int
    family_code: str | None = None
    canonical_mnemonic: str | None = None
    canonical_unit: str | None = None
    is_active: bool


class LithologyResponse(BaseModel):
    id: int
    lithology_code: str
    display_name: str
    color_hex: str
    pattern_id: str | None = None
    description: str | None = None
    sort_order: int


class ImportLasResponse(BaseModel):
    well_id: str
    well_name: str
    curve_count: int


class ImportTopsResponse(BaseModel):
    well_id: str
    formation_count: int
    linked_count: int


class ImportUnconformitiesResponse(BaseModel):
    well_id: str
    formation_count: int
    linked_count: int


class ImportDeviationResponse(BaseModel):
    well_id: str
    reference: str
    mode: str
    data_uri: str


class CreateProjectResponse(BaseModel):
    project_path: str


class SaveProjectResponse(BaseModel):
    project_path: str


class CloseProjectResponse(BaseModel):
    status: str


class DictionaryUpdateResponse(BaseModel):
    status: str



def _manager(request: Request) -> ProjectManager:
    return request.app.state.project_manager



def _require_open_project(request: Request) -> ProjectManager:
    manager = _manager(request)
    if not manager.is_open:
        raise HTTPException(status_code=400, detail='No project is currently open')
    return manager



def _status_payload(manager: ProjectManager) -> ProjectStatusResponse:
    project_name = None
    if manager.is_open:
        with manager.get_session() as session:
            from subsidence.data.schema import ProjectMeta
            meta = session.get(ProjectMeta, 1)
            if meta is not None:
                project_name = meta.project_name
    return ProjectStatusResponse(
        is_open=manager.is_open,
        is_dirty=manager.is_dirty,
        can_undo=manager.can_undo,
        can_redo=manager.can_redo,
        project_name=project_name,
        project_path=str(manager.project_path) if manager.project_path else None,
        working_db_path=str(manager.working_db_path) if manager.working_db_path else None,
    )


@router.post('', response_model=CreateProjectResponse)
def create_project(payload: CreateProjectRequest, request: Request) -> CreateProjectResponse:
    manager = _manager(request)
    try:
        project_path = manager.create_project(payload.name, payload.path)
    except FileExistsError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return CreateProjectResponse(project_path=str(project_path))


@router.post('/open')
def open_project(payload: OpenProjectRequest, request: Request) -> dict:
    manager = _manager(request)
    try:
        return manager.open_project(payload.path)
    except (RuntimeError, FileNotFoundError, ValueError) as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post('/close', response_model=CloseProjectResponse)
def close_project(request: Request) -> CloseProjectResponse:
    manager = _manager(request)
    manager.close_project()
    return CloseProjectResponse(status='closed')


@router.post('/save', response_model=SaveProjectResponse)
def save_project(request: Request) -> SaveProjectResponse:
    manager = _require_open_project(request)
    return SaveProjectResponse(project_path=str(manager.save_project()))


@router.get('/status', response_model=ProjectStatusResponse)
def project_status(request: Request) -> ProjectStatusResponse:
    return _status_payload(_manager(request))


@router.post('/import-las', response_model=ImportLasResponse)
def import_las(payload: ImportLasRequest, request: Request) -> ImportLasResponse:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        well = import_las_file(session, manager.project_path, Path(payload.las_path))
        well_id = well.id
        well_name = well.name
        curve_count = len(list(session.scalars(select(CurveMetadata).where(CurveMetadata.well_id == well_id))))
        session.commit()
    manager.mark_dirty()
    return ImportLasResponse(well_id=well_id, well_name=well_name, curve_count=curve_count)


@router.post('/import-tops', response_model=ImportTopsResponse)
def import_tops(payload: ImportTopsRequest, request: Request) -> ImportTopsResponse:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        import_tops_csv(session, payload.well_id, Path(payload.csv_path), payload.depth_ref)
        linked = link_tops_to_unconformities(session, payload.well_id)
        formation_count = len(list(session.scalars(select(FormationTopModel).where(FormationTopModel.well_id == payload.well_id))))
        session.commit()
    manager.mark_dirty()
    return ImportTopsResponse(well_id=payload.well_id, formation_count=formation_count, linked_count=len(linked))


@router.post('/import-unconformities', response_model=ImportUnconformitiesResponse)
def import_unconformities(payload: ImportUnconformitiesRequest, request: Request) -> ImportUnconformitiesResponse:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        import_unconformities_csv(session, payload.well_id, Path(payload.csv_path))
        linked = link_tops_to_unconformities(session, payload.well_id)
        formation_count = len(list(session.scalars(select(FormationTopModel).where(FormationTopModel.well_id == payload.well_id))))
        session.commit()
    manager.mark_dirty()
    return ImportUnconformitiesResponse(well_id=payload.well_id, formation_count=formation_count, linked_count=len(linked))


@router.post('/import-deviation', response_model=ImportDeviationResponse)
def import_deviation(payload: ImportDeviationRequest, request: Request) -> ImportDeviationResponse:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        survey = import_deviation_csv(session, manager.project_path, payload.well_id, Path(payload.csv_path))
        reference = survey.reference
        mode = survey.mode
        data_uri = survey.data_uri
        session.commit()
    manager.mark_dirty()
    return ImportDeviationResponse(well_id=payload.well_id, reference=reference, mode=mode, data_uri=data_uri)


@router.post('/undo', response_model=UndoRedoResponse)
def undo(request: Request) -> UndoRedoResponse:
    manager = _require_open_project(request)
    try:
        command = manager.undo()
    except RuntimeError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return UndoRedoResponse(description=command.description, can_undo=manager.can_undo, can_redo=manager.can_redo, is_dirty=manager.is_dirty)


@router.post('/redo', response_model=UndoRedoResponse)
def redo(request: Request) -> UndoRedoResponse:
    manager = _require_open_project(request)
    try:
        command = manager.redo()
    except RuntimeError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return UndoRedoResponse(description=command.description, can_undo=manager.can_undo, can_redo=manager.can_redo, is_dirty=manager.is_dirty)


@router.post('/checkpoints', response_model=CheckpointResponse)
def create_checkpoint(payload: CreateCheckpointRequest, request: Request) -> CheckpointResponse:
    manager = _require_open_project(request)
    return CheckpointResponse(**manager.create_checkpoint(payload.name, payload.description))


@router.get('/checkpoints', response_model=list[CheckpointResponse])
def list_checkpoints(request: Request) -> list[CheckpointResponse]:
    manager = _require_open_project(request)
    return [CheckpointResponse(**item) for item in manager.list_checkpoints()]


@router.post('/checkpoints/{checkpoint_id}/restore', response_model=CheckpointResponse)
def restore_checkpoint(checkpoint_id: int, request: Request) -> CheckpointResponse:
    manager = _require_open_project(request)
    try:
        return CheckpointResponse(**manager.restore_checkpoint(checkpoint_id))
    except (ValueError, FileNotFoundError) as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.delete('/checkpoints/{checkpoint_id}', response_model=DictionaryUpdateResponse)
def delete_checkpoint(checkpoint_id: int, request: Request) -> DictionaryUpdateResponse:
    manager = _require_open_project(request)
    try:
        manager.delete_checkpoint(checkpoint_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return DictionaryUpdateResponse(status='deleted')


@router.get('/dictionary/curves', response_model=list[CurveRuleResponse])
def list_curve_rules(request: Request) -> list[CurveRuleResponse]:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        rows = load_curve_alias_rules(session)
        return [CurveRuleResponse(id=row.id, scope=row.scope, pattern=row.pattern, is_regex=row.is_regex, priority=row.priority, family_code=row.family_code, canonical_mnemonic=row.canonical_mnemonic, canonical_unit=row.canonical_unit, is_active=row.is_active) for row in rows]


@router.post('/dictionary/curves', response_model=CurveRuleResponse)
def add_curve_rule(payload: AddCurveRuleRequest, request: Request) -> CurveRuleResponse:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        row = CurveDictEntry(scope='project', pattern=payload.pattern, is_regex=payload.is_regex, priority=payload.priority, family_code=payload.family_code, canonical_mnemonic=payload.canonical_mnemonic, canonical_unit=payload.canonical_unit, is_active=payload.is_active)
        session.add(row)
        session.commit()
        session.refresh(row)
        response = CurveRuleResponse(id=row.id, scope=row.scope, pattern=row.pattern, is_regex=row.is_regex, priority=row.priority, family_code=row.family_code, canonical_mnemonic=row.canonical_mnemonic, canonical_unit=row.canonical_unit, is_active=row.is_active)
    manager.mark_dirty()
    return response


@router.get('/dictionary/lithology', response_model=list[LithologyResponse])
def list_lithology(request: Request) -> list[LithologyResponse]:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        items = load_lithology_entries(session)
        rows = sorted(items.values(), key=lambda row: row.sort_order)
        return [LithologyResponse(id=row.id, lithology_code=row.lithology_code, display_name=row.display_name, color_hex=row.color_hex, pattern_id=row.pattern_id, description=row.description, sort_order=row.sort_order) for row in rows]


@router.put('/dictionary/lithology/{code}', response_model=LithologyResponse)
def update_lithology(code: str, payload: UpdateLithologyRequest, request: Request) -> LithologyResponse:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        row = session.scalar(select(LithologyDictEntry).where(LithologyDictEntry.lithology_code == code))
        if row is None:
            raise HTTPException(status_code=404, detail=f'Lithology not found: {code}')
        if payload.display_name is not None:
            row.display_name = payload.display_name
        if payload.color_hex is not None:
            row.color_hex = payload.color_hex
        session.commit()
        session.refresh(row)
        response = LithologyResponse(id=row.id, lithology_code=row.lithology_code, display_name=row.display_name, color_hex=row.color_hex, pattern_id=row.pattern_id, description=row.description, sort_order=row.sort_order)
    manager.mark_dirty()
    return response
