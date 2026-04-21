from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy import select

from subsidence.data.backstrip import (
    FormationInput,
    LithologyParam,
    backstrip,
)
from subsidence.data.schema import CompactionModel, CompactionModelParam, FormationTopModel, LithologyDictEntry, WellModel

router = APIRouter(tags=['subsidence'])


class BurialPointResponse(BaseModel):
    age_ma: float
    depth_m: float


class SubsidenceResultResponse(BaseModel):
    formation_name: str
    color: str
    lithology: str
    burial_path: list[BurialPointResponse]


def _require_open_project(request: Request):
    manager = request.app.state.project_manager
    if not manager.is_open:
        raise HTTPException(status_code=400, detail='No project is currently open')
    return manager


def _compute_subsidence(manager, well_id: str) -> list[SubsidenceResultResponse]:
    with manager.get_session() as session:
        well = session.get(WellModel, well_id)
        if well is None:
            raise ValueError(f'Well not found: {well_id}')

        formations = session.scalars(
            select(FormationTopModel)
            .where(FormationTopModel.well_id == well_id)
            .order_by(FormationTopModel.depth_md.asc(), FormationTopModel.id.asc())
        ).all()

        active_model = session.scalar(
            select(CompactionModel).where(CompactionModel.is_active.is_(True))
        )
        if active_model is not None:
            param_rows = session.scalars(
                select(CompactionModelParam)
                .where(CompactionModelParam.model_id == active_model.id)
            ).all()
            litho_params: dict[str, LithologyParam] = {
                r.lithology_code: LithologyParam(
                    density=r.density,
                    porosity_surface=r.porosity_surface,
                    compaction_coeff=r.compaction_coeff,
                )
                for r in param_rows
            }
        else:
            litho_rows = session.scalars(select(LithologyDictEntry)).all()
            litho_params = {
                r.lithology_code: LithologyParam(
                    density=r.density,
                    porosity_surface=r.porosity_surface,
                    compaction_coeff=r.compaction_coeff,
                )
                for r in litho_rows
            }

        td_m = well.td_md if well.td_md is not None else 0.0
        inputs: list[FormationInput] = []
        for idx, f in enumerate(formations):
            if idx + 1 < len(formations):
                base_m = formations[idx + 1].depth_md
            else:
                base_m = max(td_m, f.depth_md + 1.0)

            inputs.append(FormationInput(
                name=f.name,
                color=f.color,
                lithology='',
                age_top_ma=f.age_top_ma,
                age_base_ma=f.age_base_ma,
                current_top_m=f.depth_md,
                current_base_m=base_m,
            ))

        results = backstrip(inputs, litho_params)

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


@router.post('/wells/{well_id}/subsidence', response_model=list[SubsidenceResultResponse])
def calculate_subsidence(well_id: str, request: Request) -> list[SubsidenceResultResponse]:
    manager = _require_open_project(request)
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

            await websocket.send_json({'status': 'computing', 'progress': 0.0})
            try:
                results = _compute_subsidence(manager, well_id)
                await websocket.send_json({
                    'status': 'complete',
                    'results': [r.model_dump() for r in results],
                })
            except Exception as exc:
                await websocket.send_json({'status': 'error', 'message': str(exc)})
    except WebSocketDisconnect:
        pass
