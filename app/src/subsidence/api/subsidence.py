from __future__ import annotations

import asyncio
import hashlib
import json
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy import select

from subsidence.data.backstrip import (
    FormationInput,
    LithologyParam,
    ZoneLayerInput,
    backstrip,
)
from subsidence.data.unit_registry import normalize_lithology_values_to_engine
from subsidence.data.zone_service import build_zone_layer_inputs, get_well_active_top_set_id
from subsidence.data.schema import (
    CalculationResult,
    CompactionModel,
    CompactionModelParam,
    CompactionPreset,
    FormationTopModel,
    LithologyDictEntry,
    WellModel,
)
from subsidence.observability import operation_log, reset_request_id, set_request_id

router = APIRouter(tags=['subsidence'])


class BurialPointResponse(BaseModel):
    age_ma: float
    depth_m: float


class SubsidenceResultResponse(BaseModel):
    formation_name: str
    color: str
    lithology: str
    burial_path: list[BurialPointResponse]


class WellSubsidenceResultsResponse(BaseModel):
    well_id: str
    well_name: str
    algorithm: str
    td_md: float
    curves: list[SubsidenceResultResponse]


def _require_open_project(request: Request):
    manager = request.app.state.project_manager
    if not manager.is_open:
        raise HTTPException(status_code=400, detail='No project is currently open')
    return manager


def _manager_project_path(manager) -> str | None:
    return str(manager.project_path) if manager.project_path else None


def _engine_lithology_param(session, density: float, porosity_surface: float, compaction_coeff: float) -> LithologyParam:
    density, porosity_surface, compaction_coeff = normalize_lithology_values_to_engine(
        session,
        density=density,
        porosity_surface=porosity_surface,
        compaction_coeff=compaction_coeff,
    )
    return LithologyParam(
        density=density,
        porosity_surface=porosity_surface,
        compaction_coeff=compaction_coeff,
    )


def _compute_subsidence(manager, well_id: str, water_depth_m: float = 0.0) -> list[SubsidenceResultResponse]:
    with manager.get_session() as session:
        well = session.get(WellModel, well_id)
        if well is None:
            raise ValueError(f'Well not found: {well_id}')

        active_model = session.scalar(
            select(CompactionModel).where(CompactionModel.is_active.is_(True))
        )
        if active_model is not None:
            param_rows = session.scalars(
                select(CompactionModelParam)
                .where(CompactionModelParam.model_id == active_model.id)
            ).all()
            litho_params: dict[str, LithologyParam] = {
                r.lithology_code: _engine_lithology_param(
                    session, r.density, r.porosity_surface, r.compaction_coeff
                )
                for r in param_rows
            }
        else:
            builtin_presets = session.scalars(
                select(CompactionPreset).where(
                    CompactionPreset.is_builtin.is_(True),
                    CompactionPreset.source_lithology_code.is_not(None),
                )
            ).all()
            if builtin_presets:
                litho_params = {
                    r.source_lithology_code: _engine_lithology_param(
                        session, r.density, r.porosity_surface, r.compaction_coeff
                    )
                    for r in builtin_presets
                    if r.source_lithology_code
                }
            else:
                litho_rows = session.scalars(select(LithologyDictEntry)).all()
                litho_params = {
                    r.lithology_code: _engine_lithology_param(
                        session, r.density, r.porosity_surface, r.compaction_coeff
                    )
                    for r in litho_rows
                }

        top_set_id = get_well_active_top_set_id(session, well_id)
        if top_set_id is not None:
            zone_inputs = build_zone_layer_inputs(session, well_id, litho_params)
            results = backstrip(zone_inputs, litho_params, water_depth_m=water_depth_m)
        else:
            td_m = well.td_md if well.td_md is not None else 0.0
            formations = session.scalars(
                select(FormationTopModel)
                .where(FormationTopModel.well_id == well_id)
                .order_by(FormationTopModel.depth_md.asc(), FormationTopModel.id.asc())
            ).all()
            inputs: list[FormationInput] = []

            def _is_undated_unconformity(pick: FormationTopModel) -> bool:
                if pick.kind != 'unconformity':
                    return False
                if pick.age_top_ma is None or pick.age_base_ma is None:
                    return True
                return pick.age_base_ma <= pick.age_top_ma

            for idx, f in enumerate(formations):
                next_f = formations[idx + 1] if idx + 1 < len(formations) else None
                base_m = next_f.depth_md if next_f is not None else max(td_m, f.depth_md + 1.0)

                if (f.kind == 'unconformity'
                        and f.age_top_ma is not None
                        and f.age_base_ma is not None
                        and f.age_base_ma > f.age_top_ma):
                    age_top = f.age_base_ma
                else:
                    age_top = f.age_top_ma

                if next_f is None:
                    age_base = f.age_base_ma
                elif _is_undated_unconformity(next_f):
                    skip_f = formations[idx + 2] if idx + 2 < len(formations) else None
                    age_base = skip_f.age_top_ma if skip_f is not None else f.age_base_ma
                else:
                    age_base = next_f.age_top_ma

                inputs.append(FormationInput(
                    name=f.name,
                    color=f.color,
                    lithology=f.lithology or '',
                    age_top_ma=age_top,
                    age_base_ma=age_base,
                    current_top_m=f.depth_md,
                    current_base_m=base_m,
                ))

            results = backstrip(inputs, litho_params, water_depth_m=water_depth_m)

    return [
        SubsidenceResultResponse(
            formation_name=r.formation_name,
            color=r.color,
            lithology=r.lithology,
            burial_path=[
                BurialPointResponse(age_ma=p.age_ma, depth_m=p.depth_m)
                for p in r.burial_path
            ],
        )
        for r in results
    ]


def _store_results(manager, well_id: str, results: list[SubsidenceResultResponse], water_depth_m: float) -> None:
    if not manager.project_path:
        return
    results_dir = Path(manager.project_path) / 'results'
    results_dir.mkdir(exist_ok=True)

    fname = f'{well_id}_burial_history.json'
    data_uri = f'results/{fname}'
    fpath = Path(manager.project_path) / data_uri
    fpath.write_text(json.dumps([r.model_dump() for r in results]))

    inputs_hash = hashlib.sha256(
        json.dumps({'well_id': well_id, 'water_depth_m': water_depth_m}).encode()
    ).hexdigest()[:32]

    with manager.get_session() as session:
        existing = session.scalar(
            select(CalculationResult).where(
                CalculationResult.well_id == well_id,
                CalculationResult.kind == 'burial_history',
            )
        )
        if existing is not None:
            existing.data_uri = data_uri
            existing.inputs_hash = inputs_hash
            existing.is_stale = False
            existing.params_json = json.dumps({'water_depth_m': water_depth_m})
        else:
            session.add(CalculationResult(
                well_id=well_id,
                kind='burial_history',
                algorithm='airy_backstrip',
                params_json=json.dumps({'water_depth_m': water_depth_m}),
                inputs_hash=inputs_hash,
                data_uri=data_uri,
                is_stale=False,
            ))
        session.commit()


@router.get('/subsidence/stored-results', response_model=list[WellSubsidenceResultsResponse])
def get_stored_results(request: Request) -> list[WellSubsidenceResultsResponse]:
    manager = _require_open_project(request)
    with operation_log('subsidence.stored_results', project_path=_manager_project_path(manager)):
        out: list[WellSubsidenceResultsResponse] = []
        with manager.get_session() as session:
            rows = session.scalars(
                select(CalculationResult).where(
                    CalculationResult.kind == 'burial_history',
                    CalculationResult.is_stale.is_(False),
                )
            ).all()
            for row in rows:
                well = session.get(WellModel, row.well_id)
                if well is None:
                    continue
                fpath = Path(manager.project_path) / row.data_uri
                if not fpath.exists():
                    continue
                payload = json.loads(fpath.read_text())
                curves = [SubsidenceResultResponse.model_validate(c) for c in payload]
                out.append(WellSubsidenceResultsResponse(
                    well_id=row.well_id,
                    well_name=well.name,
                    algorithm=row.algorithm,
                    td_md=well.td_md or 0.0,
                    curves=curves,
                ))
        return out


@router.post('/wells/{well_id}/subsidence', response_model=list[SubsidenceResultResponse])
def calculate_subsidence(well_id: str, request: Request) -> list[SubsidenceResultResponse]:
    manager = _require_open_project(request)
    with operation_log('subsidence.calculate', project_path=_manager_project_path(manager), well_id=well_id):
        results = _compute_subsidence(manager, well_id)
        if not results:
            raise HTTPException(
                status_code=400,
                detail='Fewer than 2 formations have both ages assigned',
            )
        return results


@router.websocket('/ws/recalculate')
async def ws_recalculate(websocket: WebSocket) -> None:
    manager = websocket.app.state.project_manager
    token = set_request_id(str(uuid4()))
    await websocket.accept()
    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            well_id = data.get('well_id')
            if not well_id:
                await websocket.send_json({'status': 'error', 'message': 'well_id required'})
                continue

            if not manager.is_open:
                await websocket.send_json({'status': 'error', 'message': 'No project is open'})
                continue

            water_depth_m = float(data.get('water_depth_m', 0.0))
            await websocket.send_json({'status': 'computing', 'progress': 0.0})
            try:
                with operation_log('subsidence.recalculate', project_path=_manager_project_path(manager), well_id=well_id, water_depth_m=water_depth_m):
                    results = await asyncio.to_thread(_compute_subsidence, manager, well_id, water_depth_m)
                    await asyncio.to_thread(_store_results, manager, well_id, results, water_depth_m)
                await websocket.send_json({
                    'status': 'complete',
                    'results': [r.model_dump() for r in results],
                })
            except Exception as exc:
                await websocket.send_json({'status': 'error', 'message': str(exc)})
    except WebSocketDisconnect:
        pass
    finally:
        reset_request_id(token)
