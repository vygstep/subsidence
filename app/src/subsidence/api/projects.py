from __future__ import annotations

import math
import platform
import subprocess
import tkinter as tk
from tkinter import filedialog
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select

from subsidence.data import (
    DEFAULT_WELL_CRS,
    DEFAULT_WELL_KB,
    DEFAULT_WELL_NAME,
    DEFAULT_WELL_X,
    DEFAULT_WELL_Y,
    ImportWell,
    ProjectManager,
    RemoveWell,
    create_empty_well,
)
from subsidence.data.schema import ProjectMeta, WellModel
from subsidence.observability import operation_log

router = APIRouter(tags=['projects'])


class CreateProjectRequest(BaseModel):
    name: str
    path: str
    overwrite: bool = False


class OpenProjectRequest(BaseModel):
    path: str


class RevealPathRequest(BaseModel):
    path: str


class PickFolderRequest(BaseModel):
    initial_path: str | None = None


class PickFileRequest(BaseModel):
    initial_path: str | None = None
    file_types: list[tuple[str, str]] | None = None


class ImportLasRequest(BaseModel):
    las_path: str
    well_id: str | None = None
    create_new_well: bool = False


class ImportLogsCsvRequest(BaseModel):
    csv_path: str
    well_id: str | None = None
    depth_column: str | None = None
    create_new_well: bool = False


class ImportTopsRequest(BaseModel):
    well_id: str | None = None
    csv_path: str
    depth_ref: str = 'MD'
    create_new_well: bool = False
    column_map: dict[str, str] | None = None


class ImportUnconformitiesRequest(BaseModel):
    well_id: str
    csv_path: str
    column_map: dict[str, str] | None = None


class ImportDeviationRequest(BaseModel):
    well_id: str | None = None
    csv_path: str
    create_new_well: bool = False
    column_map: dict[str, str] | None = None


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


class VisualConfigPatchRequest(BaseModel):
    scope: str = 'project'
    scope_id: str | None = None
    config: dict


class ExportRequest(BaseModel):
    well_id: str | None = None


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


class CurveMatchResponse(BaseModel):
    mnemonic: str
    family_code: str | None
    canonical_mnemonic: str | None
    canonical_unit: str | None
    matched: bool


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


class CreateWellRequest(BaseModel):
    name: str
    x: float = DEFAULT_WELL_X
    y: float = DEFAULT_WELL_Y
    kb: float = DEFAULT_WELL_KB
    td: float | None = None
    crs: str = DEFAULT_WELL_CRS


class CreateWellResponse(BaseModel):
    well_id: str
    well_name: str


class OpenProjectResponse(BaseModel):
    project_name: str
    project_uuid: str
    project_path: str
    working_db_path: str
    session_id: str
    recovery_available: bool


class SaveProjectResponse(BaseModel):
    project_path: str


class RecentProjectItemResponse(BaseModel):
    name: str
    path: str
    last_opened: str


class CloseProjectResponse(BaseModel):
    status: str


class DictionaryUpdateResponse(BaseModel):
    status: str


class VisualConfigResponse(BaseModel):
    scope: str
    scope_id: str
    config: dict


class PickPathResponse(BaseModel):
    path: str | None = None


def _manager(request: Request) -> ProjectManager:
    return request.app.state.project_manager


def _manager_project_path(manager: ProjectManager) -> str | None:
    return str(manager.project_path) if manager.project_path else None


def _require_open_project(request: Request) -> ProjectManager:
    manager = _manager(request)
    if not manager.is_open:
        raise HTTPException(status_code=400, detail='No project is currently open')
    return manager


def _project_meta(session):
    meta = session.get(ProjectMeta, 1)
    if meta is None:
        raise HTTPException(status_code=500, detail='Project metadata is missing')
    return meta


def _resolve_scope_id(session, scope: str, scope_id: str | None) -> str:
    if scope_id:
        return scope_id
    if scope == 'project':
        return _project_meta(session).project_uuid
    raise HTTPException(status_code=400, detail=f'scope_id is required for scope {scope}')


def _status_payload(manager: ProjectManager) -> ProjectStatusResponse:
    project_name = None
    if manager.is_open:
        with manager.get_session() as session:
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


def _require_finite_number(value: float, field_name: str) -> float:
    if not math.isfinite(value):
        raise HTTPException(status_code=400, detail=f'{field_name} must be a finite number')
    return value


def _require_non_negative_number(value: float | None, field_name: str) -> float | None:
    if value is None:
        return None
    if _require_finite_number(value, field_name) < 0:
        raise HTTPException(status_code=400, detail=f'{field_name} must be >= 0')
    return value


def _normalize_initial_dir(path: str | None) -> str | None:
    if not path:
        return None
    candidate = Path(path.strip()).expanduser()
    if candidate.is_file():
        candidate = candidate.parent
    if candidate.exists() and candidate.is_dir():
        return str(candidate.resolve())
    return None


def _pick_path(callback):
    root = tk.Tk()
    root.withdraw()
    root.attributes('-topmost', True)
    root.update()
    try:
        return callback()
    finally:
        root.destroy()


@router.post('', response_model=CreateProjectResponse)
def create_project(payload: CreateProjectRequest, request: Request) -> CreateProjectResponse:
    manager = _manager(request)
    with operation_log('project.create', project_name=payload.name, base_path=payload.path, overwrite=payload.overwrite):
        try:
            project_path = manager.create_project(payload.name, payload.path, overwrite=payload.overwrite)
        except FileExistsError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error
        return CreateProjectResponse(project_path=str(project_path))


@router.get('/recent', response_model=list[RecentProjectItemResponse])
def list_recent_projects(request: Request) -> list[RecentProjectItemResponse]:
    manager = _manager(request)
    return [RecentProjectItemResponse(**entry) for entry in manager.list_recent_projects()]


@router.post('/wells', response_model=CreateWellResponse)
def create_well(payload: CreateWellRequest, request: Request) -> CreateWellResponse:
    manager = _require_open_project(request)
    with operation_log('well.create', project_path=_manager_project_path(manager), well_name=payload.name):
        well_name = payload.name.strip()
        if not well_name:
            raise HTTPException(status_code=400, detail='Well name is required')
        x = _require_finite_number(payload.x, 'Project X')
        y = _require_finite_number(payload.y, 'Project Y')
        kb = _require_non_negative_number(payload.kb, 'KB')
        td = _require_non_negative_number(payload.td, 'TD')
        crs = payload.crs.strip()
        if not crs:
            raise HTTPException(status_code=400, detail='CRS cannot be empty')

        with manager.get_session() as session:
            row = create_empty_well(
                session,
                name=well_name,
                x=x,
                y=y,
                kb=kb,
                td=td,
                crs=crs,
            )
            session.flush()
            command = ImportWell.capture(session, manager.project_path, row.id)
            session.commit()
            session.refresh(row)

        manager.execute_command(command)
        return CreateWellResponse(well_id=row.id, well_name=row.name)


@router.delete('/wells/{well_id}', response_model=DictionaryUpdateResponse)
def delete_well(well_id: str, request: Request) -> DictionaryUpdateResponse:
    manager = _require_open_project(request)
    with operation_log('well.delete', project_path=_manager_project_path(manager), well_id=well_id):
        try:
            with manager.get_session() as session:
                command = RemoveWell.capture(session, manager.project_path, well_id)
            manager.execute_command(command)
            manager.save_project()
        except ValueError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error
        return DictionaryUpdateResponse(status='ok')


@router.post('/open', response_model=OpenProjectResponse)
def open_project(payload: OpenProjectRequest, request: Request) -> OpenProjectResponse:
    manager = _manager(request)
    with operation_log('project.open', project_path=payload.path):
        try:
            return OpenProjectResponse(**manager.open_project(payload.path))
        except (RuntimeError, FileNotFoundError, ValueError) as error:
            raise HTTPException(status_code=400, detail=str(error)) from error


@router.post('/reveal-path', response_model=DictionaryUpdateResponse)
def reveal_path(payload: RevealPathRequest, request: Request) -> DictionaryUpdateResponse:
    _manager(request)
    raw_path = payload.path.strip()
    if not raw_path:
        raise HTTPException(status_code=400, detail='Path is required')

    target = Path(raw_path).expanduser()
    if not target.exists():
        raise HTTPException(status_code=404, detail=f'Path does not exist: {raw_path}')

    try:
        resolved = str(target.resolve())
        system = platform.system()
        if system == 'Windows':
            if target.is_file():
                subprocess.Popen(['explorer', f'/select,{resolved}'])
            else:
                subprocess.Popen(['explorer', resolved])
        elif system == 'Darwin':
            if target.is_file():
                subprocess.Popen(['open', '-R', resolved])
            else:
                subprocess.Popen(['open', resolved])
        else:
            directory = str(target.parent.resolve() if target.is_file() else target.resolve())
            subprocess.Popen(['xdg-open', directory])
    except OSError as error:
        raise HTTPException(status_code=500, detail=f'Failed to open Explorer: {error}') from error

    return DictionaryUpdateResponse(status='ok')


@router.post('/pick-folder', response_model=PickPathResponse)
def pick_folder(payload: PickFolderRequest, request: Request) -> PickPathResponse:
    _manager(request)
    initial_dir = _normalize_initial_dir(payload.initial_path)

    try:
        selected = _pick_path(lambda: filedialog.askdirectory(initialdir=initial_dir or None, mustexist=True))
    except tk.TclError as error:
        raise HTTPException(status_code=500, detail=f'Failed to open folder picker: {error}') from error

    return PickPathResponse(path=selected or None)


@router.post('/pick-file', response_model=PickPathResponse)
def pick_file(payload: PickFileRequest, request: Request) -> PickPathResponse:
    _manager(request)
    initial_dir = _normalize_initial_dir(payload.initial_path)
    file_types = payload.file_types or [('All files', '*.*')]

    try:
        selected = _pick_path(
            lambda: filedialog.askopenfilename(
                initialdir=initial_dir or None,
                filetypes=file_types,
            )
        )
    except tk.TclError as error:
        raise HTTPException(status_code=500, detail=f'Failed to open file picker: {error}') from error

    return PickPathResponse(path=selected or None)


@router.post('/close', response_model=CloseProjectResponse)
def close_project(request: Request) -> CloseProjectResponse:
    manager = _manager(request)
    with operation_log('project.close', project_path=_manager_project_path(manager)):
        manager.close_project()
        return CloseProjectResponse(status='closed')


@router.post('/save', response_model=SaveProjectResponse)
def save_project(request: Request) -> SaveProjectResponse:
    manager = _require_open_project(request)
    with operation_log('project.save', project_path=_manager_project_path(manager)):
        return SaveProjectResponse(project_path=str(manager.save_project()))


@router.get('/status', response_model=ProjectStatusResponse)
def project_status(request: Request) -> ProjectStatusResponse:
    return _status_payload(_manager(request))
