from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select

from subsidence.data import UpdateVisualConfig, load_curve_alias_rules, load_lithology_entries
from subsidence.data.dict_resolver import resolve_curve_alias
from subsidence.data.schema import CurveDictEntry, LithologyDictEntry, VisualConfig
from subsidence.observability import operation_log

from .projects import (
    AddCurveRuleRequest,
    CheckpointResponse,
    CreateCheckpointRequest,
    CurveMatchResponse,
    CurveRuleResponse,
    DictionaryUpdateResponse,
    LithologyResponse,
    UndoRedoResponse,
    UpdateLithologyRequest,
    VisualConfigPatchRequest,
    VisualConfigResponse,
    _manager_project_path,
    _require_open_project,
    _resolve_scope_id,
)

router = APIRouter(tags=['projects'])


@router.post('/undo', response_model=UndoRedoResponse)
def undo(request: Request) -> UndoRedoResponse:
    manager = _require_open_project(request)
    with operation_log('undo.run', project_path=_manager_project_path(manager)):
        try:
            command = manager.undo()
        except RuntimeError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        return UndoRedoResponse(description=command.description, can_undo=manager.can_undo, can_redo=manager.can_redo, is_dirty=manager.is_dirty)


@router.post('/redo', response_model=UndoRedoResponse)
def redo(request: Request) -> UndoRedoResponse:
    manager = _require_open_project(request)
    with operation_log('redo.run', project_path=_manager_project_path(manager)):
        try:
            command = manager.redo()
        except RuntimeError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        return UndoRedoResponse(description=command.description, can_undo=manager.can_undo, can_redo=manager.can_redo, is_dirty=manager.is_dirty)


@router.post('/checkpoints', response_model=CheckpointResponse)
def create_checkpoint(payload: CreateCheckpointRequest, request: Request) -> CheckpointResponse:
    manager = _require_open_project(request)
    with operation_log('checkpoint.create', project_path=_manager_project_path(manager), checkpoint_name=payload.name):
        return CheckpointResponse(**manager.create_checkpoint(payload.name, payload.description))


@router.get('/checkpoints', response_model=list[CheckpointResponse])
def list_checkpoints(request: Request) -> list[CheckpointResponse]:
    manager = _require_open_project(request)
    return [CheckpointResponse(**item) for item in manager.list_checkpoints()]


@router.post('/checkpoints/{checkpoint_id}/restore', response_model=CheckpointResponse)
def restore_checkpoint(checkpoint_id: int, request: Request) -> CheckpointResponse:
    manager = _require_open_project(request)
    with operation_log('checkpoint.restore', project_path=_manager_project_path(manager), checkpoint_id=checkpoint_id):
        try:
            return CheckpointResponse(**manager.restore_checkpoint(checkpoint_id))
        except (ValueError, FileNotFoundError) as error:
            raise HTTPException(status_code=400, detail=str(error)) from error


@router.delete('/checkpoints/{checkpoint_id}', response_model=DictionaryUpdateResponse)
def delete_checkpoint(checkpoint_id: int, request: Request) -> DictionaryUpdateResponse:
    manager = _require_open_project(request)
    with operation_log('checkpoint.delete', project_path=_manager_project_path(manager), checkpoint_id=checkpoint_id):
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


@router.get('/dictionary/curves/match', response_model=CurveMatchResponse)
def match_curve(mnemonic: str, request: Request) -> CurveMatchResponse:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        rules = load_curve_alias_rules(session)
        result = resolve_curve_alias(mnemonic, rules)
    return CurveMatchResponse(
        mnemonic=mnemonic,
        family_code=result.family_code,
        canonical_mnemonic=result.canonical_mnemonic,
        canonical_unit=result.canonical_unit,
        matched=result.matched,
    )


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


@router.get('/visual-config', response_model=VisualConfigResponse)
def get_visual_config_alias(request: Request, scope: str = 'project', scope_id: str | None = None) -> VisualConfigResponse:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        resolved_scope_id = _resolve_scope_id(session, scope, scope_id)
        row = session.scalar(select(VisualConfig).where(VisualConfig.scope == scope, VisualConfig.scope_id == resolved_scope_id))
        config = json.loads(row.config) if row is not None else {}
        return VisualConfigResponse(scope=scope, scope_id=resolved_scope_id, config=config)


@router.patch('/visual-config', response_model=VisualConfigResponse)
def patch_visual_config(payload: VisualConfigPatchRequest, request: Request) -> VisualConfigResponse:
    manager = _require_open_project(request)
    with operation_log('visual_config.patch', project_path=_manager_project_path(manager), scope=payload.scope, scope_id=payload.scope_id):
        with manager.get_session() as session:
            resolved_scope_id = _resolve_scope_id(session, payload.scope, payload.scope_id)
            existing = session.scalar(select(VisualConfig).where(VisualConfig.scope == payload.scope, VisualConfig.scope_id == resolved_scope_id))
            old_config = json.loads(existing.config) if existing is not None else {}
            merged_config = {**old_config, **payload.config}
            if merged_config == old_config:
                return VisualConfigResponse(scope=payload.scope, scope_id=resolved_scope_id, config=old_config)
        manager.execute_command(UpdateVisualConfig(payload.scope, resolved_scope_id, old_config, merged_config))
        return VisualConfigResponse(scope=payload.scope, scope_id=resolved_scope_id, config=merged_config)
