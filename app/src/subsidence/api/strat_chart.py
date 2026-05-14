from __future__ import annotations

import csv
import re
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import delete, func, select

from subsidence.data import ActivateStratChart, ProjectManager
from subsidence.data.schema import FormationStratLink, StratChart, StratUnit
from subsidence.data.strat_link import auto_link_all_formations_to_chart
from subsidence.observability import operation_log
from subsidence.api._deps import manager_project_path as _manager_project_path, require_open_project

router = APIRouter(tags=['strat-chart'])


def _require_open_project(request: Request) -> ProjectManager:
    return require_open_project(request, detail='No project is open')


class ImportStratChartRequest(BaseModel):
    csv_path: str
    column_map: dict[str, str]


class ImportStratChartResponse(BaseModel):
    units_imported: int


class StratChartInfo(BaseModel):
    id: int
    name: str
    is_active: bool
    is_builtin: bool
    unit_count: int
    imported_at: str
    source_path: str | None


def _is_builtin_chart(chart: StratChart) -> bool:
    source_name = Path(chart.source_path).name.lower() if chart.source_path else ''
    return chart.name == 'ICS 2023' and source_name in {'', 'ics_2023.csv', 'ics_chart2023.csv', 'ics_chart2023_units.csv'}


def _apply_column_map(row: dict[str, str], column_map: dict[str, str]) -> dict[str, str]:
    return {
        canonical: row.get(source, '')
        for canonical, source in column_map.items()
    }


def _float_or_none(value: str | None) -> float | None:
    stripped = (value or '').strip()
    return float(stripped) if stripped else None


def _parse_color_hex(value: str | None) -> str | None:
    raw = (value or '').strip()
    if not raw:
        return None

    hex_match = re.fullmatch(r'#?([0-9a-fA-F]{6})', raw)
    if hex_match:
        return f'#{hex_match.group(1).lower()}'

    parts = [part.strip() for part in re.split(r'[/,;\s]+', raw) if part.strip()]
    if len(parts) == 3:
        rgb = [_float_or_none(part) for part in parts]
        if all(channel is not None for channel in rgb):
            clamped = [max(0, min(255, round(float(channel)))) for channel in rgb if channel is not None]
            return '#{:02x}{:02x}{:02x}'.format(*clamped)

    if len(parts) == 4:
        cmyk = [_float_or_none(part) for part in parts]
        if all(channel is not None for channel in cmyk):
            c, m, y, k = [float(channel) for channel in cmyk if channel is not None]
            if max(c, m, y, k) > 1.0:
                c, m, y, k = c / 100.0, m / 100.0, y / 100.0, k / 100.0
            c, m, y, k = [max(0.0, min(1.0, value)) for value in (c, m, y, k)]
            r = round(255 * (1 - c) * (1 - k))
            g = round(255 * (1 - m) * (1 - k))
            b = round(255 * (1 - y) * (1 - k))
            return '#{:02x}{:02x}{:02x}'.format(r, g, b)

    return None


def _import_ics_csv(session, csv_path: Path, column_map: dict[str, str]) -> tuple[StratChart, int]:
    required = {'unit_id', 'unit_name', 'start_age_ma', 'end_age_ma'}
    missing_mapping = sorted(required.difference(column_map))
    if missing_mapping:
        raise ValueError(f'Missing required StratChart column mapping: {missing_mapping}')

    pending: dict[int, dict[str, str]] = {}
    with csv_path.open('r', encoding='utf-8-sig', newline='') as handle:
        for row in csv.DictReader(handle):
            row = _apply_column_map(row, column_map)
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
            age_top_ma = _float_or_none(row.get('end_age_ma'))
            age_base_ma = _float_or_none(row.get('start_age_ma'))
            if age_top_ma is None or age_base_ma is None:
                raise ValueError(f'Unit "{row.get("unit_name") or csv_unit_id}" must have start_age_ma and end_age_ma.')
            if age_top_ma > age_base_ma:
                raise ValueError(f"end_age_ma must be <= start_age_ma (got end={age_top_ma}, start={age_base_ma})")
            if parent_csv_id is not None:
                parent = csv_id_to_unit[parent_csv_id]
                if (
                    parent.age_top_ma is not None
                    and parent.age_base_ma is not None
                    and (age_top_ma < parent.age_top_ma or age_base_ma > parent.age_base_ma)
                ):
                    raise ValueError(
                        f'Unit "{row.get("unit_name")}" age interval '
                        f'{age_top_ma:g}-{age_base_ma:g} Ma is outside parent "{parent.name}" '
                        f'interval {parent.age_top_ma:g}-{parent.age_base_ma:g} Ma.'
                    )
            unit = StratUnit(
                name=(row.get('unit_name') or '').strip(),
                rank=(row.get('rank_name') or '').strip() or None,
                parent_id=parent_db_id,
                age_top_ma=age_top_ma,
                age_base_ma=age_base_ma,
                lithology=None,
                color_hex=_parse_color_hex(row.get('color')),
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
        is_builtin=_is_builtin_chart(chart),
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
    with operation_log('strat_chart.activate', project_path=_manager_project_path(manager), chart_id=chart_id):
        with manager.get_session() as session:
            chart = session.get(StratChart, chart_id)
            if chart is None:
                raise HTTPException(status_code=404, detail=f'Strat chart not found: {chart_id}')
            if chart.is_active:
                return _chart_info(session, chart)
            previous_active = session.scalar(select(StratChart).where(StratChart.is_active.is_(True)))
            previous_active_id = previous_active.id if previous_active is not None else None

        manager.execute_command(ActivateStratChart(chart_id, previous_active_id))

        with manager.get_session() as session:
            chart = session.get(StratChart, chart_id)
            if chart is None:
                raise HTTPException(status_code=404, detail=f'Strat chart not found: {chart_id}')
            return _chart_info(session, chart)


@router.delete('/strat-charts/{chart_id}', status_code=204)
def delete_strat_chart_by_id(chart_id: int, request: Request) -> None:
    manager = _require_open_project(request)
    with operation_log('strat_chart.delete', project_path=_manager_project_path(manager), chart_id=chart_id):
        with manager.get_session() as session:
            chart = session.get(StratChart, chart_id)
            if chart is None:
                raise HTTPException(status_code=404, detail=f'Strat chart not found: {chart_id}')
            if _is_builtin_chart(chart):
                raise HTTPException(status_code=403, detail='Built-in ICS chart cannot be deleted')
            session.execute(delete(FormationStratLink).where(FormationStratLink.chart_id == chart_id))
            session.execute(delete(StratUnit).where(StratUnit.chart_id == chart_id))
            session.execute(delete(StratChart).where(StratChart.id == chart_id))
            session.commit()
        manager.save_project()


@router.post('/strat-charts/import', response_model=ImportStratChartResponse)
def import_strat_chart(body: ImportStratChartRequest, request: Request) -> ImportStratChartResponse:
    manager = _require_open_project(request)
    with operation_log('strat_chart.import', project_path=_manager_project_path(manager), input_path=body.csv_path):
        csv_path = Path(body.csv_path)
        if not csv_path.exists():
            raise HTTPException(status_code=400, detail=f'File not found: {body.csv_path}')
        if not csv_path.is_file():
            raise HTTPException(status_code=400, detail=f'Path is not a file: {body.csv_path}')

        with manager.get_session() as session:
            try:
                chart, count = _import_ics_csv(session, csv_path, body.column_map)
                if chart.is_active:
                    auto_link_all_formations_to_chart(session, chart)
                session.commit()
            except ValueError as exc:
                raise HTTPException(status_code=422, detail=str(exc)) from exc

        manager.save_project()
        return ImportStratChartResponse(units_imported=count)
