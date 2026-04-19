from __future__ import annotations

import csv
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import delete, select

from subsidence.data import ProjectManager
from subsidence.data.schema import FormationTopModel, StratUnit

router = APIRouter(tags=['strat-chart'])


def _manager(request: Request) -> ProjectManager:
    return request.app.state.project_manager


def _require_open_project(request: Request) -> ProjectManager:
    manager = _manager(request)
    if not manager.is_open:
        raise HTTPException(status_code=400, detail='No project is open')
    return manager


class ImportStratChartRequest(BaseModel):
    csv_path: str


class ImportStratChartResponse(BaseModel):
    units_imported: int


def _import_ics_csv(session, csv_path: Path) -> int:
    # Unlink all formations before replacing strat units.
    session.execute(
        FormationTopModel.__table__.update().values(strat_unit_id=None)
    )
    session.execute(delete(StratUnit))
    session.flush()

    pending: dict[int, dict[str, str]] = {}
    with csv_path.open('r', encoding='utf-8-sig', newline='') as handle:
        for row in csv.DictReader(handle):
            unit_id_raw = (row.get('unit_id') or '').strip()
            name = (row.get('unit_name') or '').strip()
            if not unit_id_raw or not name:
                continue
            pending[int(unit_id_raw)] = row

    inserted_ids: set[int] = set()
    count = 0
    while pending:
        inserted_in_pass = False
        for unit_id in list(pending):
            row = pending[unit_id]
            parent_id_raw = (row.get('parent_unit_id') or '').strip()
            parent_id = int(parent_id_raw) if parent_id_raw else None
            if parent_id is not None and parent_id not in inserted_ids:
                continue

            age_top_raw = (row.get('start_age_ma') or '').strip()
            age_base_raw = (row.get('end_age_ma') or '').strip()
            session.add(
                StratUnit(
                    id=unit_id,
                    name=(row.get('unit_name') or '').strip(),
                    rank=(row.get('rank_name') or '').strip() or None,
                    parent_id=parent_id,
                    age_top_ma=float(age_top_raw) if age_top_raw else None,
                    age_base_ma=float(age_base_raw) if age_base_raw else None,
                    lithology=None,
                    color_hex=(row.get('html_rgb_hash') or '').strip() or None,
                )
            )
            inserted_ids.add(unit_id)
            pending.pop(unit_id)
            inserted_in_pass = True
            count += 1

        if not inserted_in_pass:
            raise ValueError('Unresolved parent references in strat chart CSV')

    return count


@router.post('/strat-chart/import', response_model=ImportStratChartResponse)
def import_strat_chart(body: ImportStratChartRequest, request: Request) -> ImportStratChartResponse:
    manager = _require_open_project(request)
    csv_path = Path(body.csv_path)
    if not csv_path.exists():
        raise HTTPException(status_code=400, detail=f'File not found: {body.csv_path}')
    if not csv_path.is_file():
        raise HTTPException(status_code=400, detail=f'Path is not a file: {body.csv_path}')

    with manager.get_session() as session:
        try:
            count = _import_ics_csv(session, csv_path)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    return ImportStratChartResponse(units_imported=count)


@router.delete('/strat-chart', status_code=204)
def delete_strat_chart(request: Request) -> None:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        session.execute(
            FormationTopModel.__table__.update().values(strat_unit_id=None)
        )
        session.execute(delete(StratUnit))
