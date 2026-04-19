from __future__ import annotations

import csv
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import delete, func, select

from subsidence.data import ProjectManager
from subsidence.data.schema import StratChart, StratUnit
from subsidence.data.strat_link import auto_link_all_formations_to_chart

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


class StratChartInfo(BaseModel):
    id: int
    name: str
    is_active: bool
    unit_count: int
    imported_at: str
    source_path: str | None


def _import_ics_csv(session, csv_path: Path) -> tuple[StratChart, int]:
    pending: dict[int, dict[str, str]] = {}
    with csv_path.open('r', encoding='utf-8-sig', newline='') as handle:
        for row in csv.DictReader(handle):
            unit_id_raw = (row.get('unit_id') or '').strip()
            name = (row.get('unit_name') or '').strip()
            if not unit_id_raw or not name:
                continue
            pending[int(unit_id_raw)] = row

    existing_count = session.scalar(select(func.count()).select_from(StratChart)) or 0
    is_first = existing_count == 0

    chart = StratChart(
        name=csv_path.stem,
        source_path=str(csv_path),
        is_active=is_first,
    )
    session.add(chart)
    session.flush()

    # Topological sort: track CSV unit_id → StratUnit object for parent resolution
    csv_id_to_unit: dict[int, StratUnit] = {}
    inserted_csv_ids: set[int] = set()
    count = 0

    while pending:
        ready = [
            (csv_unit_id, row)
            for csv_unit_id, row in list(pending.items())
            if not (row.get('parent_unit_id') or '').strip()
            or int(row['parent_unit_id'].strip()) in inserted_csv_ids
        ]
        if not ready:
            raise ValueError('Unresolved parent references in strat chart CSV')

        for csv_unit_id, row in ready:
            parent_csv_id_raw = (row.get('parent_unit_id') or '').strip()
            parent_csv_id = int(parent_csv_id_raw) if parent_csv_id_raw else None
            parent_db_id = csv_id_to_unit[parent_csv_id].id if parent_csv_id is not None else None
            age_top_raw = (row.get('start_age_ma') or '').strip()
            age_base_raw = (row.get('end_age_ma') or '').strip()
            unit = StratUnit(
                name=(row.get('unit_name') or '').strip(),
                rank=(row.get('rank_name') or '').strip() or None,
                parent_id=parent_db_id,
                age_top_ma=float(age_top_raw) if age_top_raw else None,
                age_base_ma=float(age_base_raw) if age_base_raw else None,
                lithology=None,
                color_hex=(row.get('html_rgb_hash') or '').strip() or None,
                chart_id=chart.id,
            )
            session.add(unit)
            csv_id_to_unit[csv_unit_id] = unit
            inserted_csv_ids.add(csv_unit_id)
            del pending[csv_unit_id]

        session.flush()
        count += len(ready)

    return chart, count


def _chart_info(session, chart: StratChart) -> StratChartInfo:
    unit_count = session.scalar(
        select(func.count()).where(StratUnit.chart_id == chart.id)
    ) or 0
    return StratChartInfo(
        id=chart.id,
        name=chart.name,
        is_active=chart.is_active,
        unit_count=unit_count,
        imported_at=chart.imported_at.isoformat(),
        source_path=chart.source_path,
    )


@router.get('/strat-charts', response_model=list[StratChartInfo])
def list_strat_charts(request: Request) -> list[StratChartInfo]:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        charts = session.scalars(select(StratChart).order_by(StratChart.id.asc())).all()
        return [_chart_info(session, chart) for chart in charts]


@router.patch('/strat-charts/{chart_id}/activate', response_model=StratChartInfo)
def activate_strat_chart(chart_id: int, request: Request) -> StratChartInfo:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        chart = session.get(StratChart, chart_id)
        if chart is None:
            raise HTTPException(status_code=404, detail=f'Strat chart not found: {chart_id}')
        session.execute(StratChart.__table__.update().values(is_active=False))
        chart.is_active = True
        session.flush()
        session.commit()
        manager.save_project()
        return _chart_info(session, chart)


@router.delete('/strat-charts/{chart_id}', status_code=204)
def delete_strat_chart_by_id(chart_id: int, request: Request) -> None:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        chart = session.get(StratChart, chart_id)
        if chart is None:
            raise HTTPException(status_code=404, detail=f'Strat chart not found: {chart_id}')
        session.delete(chart)
        session.flush()
        session.commit()
    manager.save_project()


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
            chart, count = _import_ics_csv(session, csv_path)
            if chart.is_active:
                auto_link_all_formations_to_chart(session, chart)
            session.commit()
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    manager.save_project()
    return ImportStratChartResponse(units_imported=count)


@router.delete('/strat-chart', status_code=204)
def delete_all_strat_charts(request: Request) -> None:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        session.execute(delete(StratChart))
        session.commit()
    manager.save_project()
