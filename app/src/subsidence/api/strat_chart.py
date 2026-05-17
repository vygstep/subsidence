from __future__ import annotations

import csv
import re
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import delete, func, select

from subsidence.data import ActivateStratChart, ProjectManager
from subsidence.data.schema import FormationStratLink, StratChart, StratUnit
from subsidence.data.strat_link import auto_link_all_formations_to_chart
from subsidence.observability import operation_log
from subsidence.api._deps import manager_project_path as _manager_project_path, require_open_project

router = APIRouter(tags=['strat-chart'])

RANK_ORDER: dict[str, float] = {
    'super eon': -1.0,
    'super-eon': -1.0,
    'supereon': -1.0,
    'super eonothem': -1.0,
    'super-eonothem': -1.0,
    'supereonothem': -1.0,
    'eon': 0.0,
    'eonothem': 0.0,
    'era': 1.0,
    'erathem': 1.0,
    'period': 2.0,
    'system': 2.0,
    'subperiod': 2.5,
    'sub-period': 2.5,
    'sub period': 2.5,
    'subsystem': 2.5,
    'sub-system': 2.5,
    'sub system': 2.5,
    'epoch': 3.0,
    'series': 3.0,
    'subepoch': 3.5,
    'sub-epoch': 3.5,
    'sub epoch': 3.5,
    'subseries': 3.5,
    'sub-series': 3.5,
    'sub series': 3.5,
    'age': 4.0,
    'stage': 4.0,
}
NORMALIZED_RANK_ORDER = {
    re.sub(r'[\s_-]+', '', rank.casefold()): order
    for rank, order in RANK_ORDER.items()
}


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


class StratChartImportError(ValueError):
    pass


def _is_builtin_chart(chart: StratChart) -> bool:
    source_name = Path(chart.source_path).name.lower() if chart.source_path else ''
    return chart.name == 'ICS 2023' and source_name in {'', 'ics_2023.csv', 'ics_chart2023.csv', 'ics_chart2023_units.csv'}


def _apply_column_map(row: dict[str, str], column_map: dict[str, str]) -> dict[str, str]:
    return {
        canonical: row.get(source, '')
        for canonical, source in column_map.items()
    }


def _line_error(line_number: int, message: str) -> StratChartImportError:
    return StratChartImportError(f'StratChart is inconsistent at line {line_number}: {message}')


def _float_or_none(value: str | None) -> float | None:
    stripped = (value or '').strip()
    return float(stripped) if stripped else None


def _required_float(value: str | None, field_name: str, line_number: int) -> float:
    try:
        parsed = _float_or_none(value)
    except ValueError as exc:
        raise _line_error(line_number, f'{field_name} must be numeric.') from exc
    if parsed is None:
        raise _line_error(line_number, f'{field_name} is required.')
    return parsed


def _required_int(value: str | None, field_name: str, line_number: int) -> int:
    raw = (value or '').strip()
    if not raw:
        raise _line_error(line_number, f'{field_name} is required.')
    try:
        return int(raw)
    except ValueError as exc:
        raise _line_error(line_number, f'{field_name} must be an integer.') from exc


def _optional_int(value: str | None, field_name: str, line_number: int) -> int | None:
    raw = (value or '').strip()
    if not raw:
        return None
    try:
        return int(raw)
    except ValueError as exc:
        raise _line_error(line_number, f'{field_name} must be an integer.') from exc


def _rank_order(rank: str | None) -> float | None:
    raw = (rank or '').strip()
    if not raw:
        return None
    normalized = re.sub(r'[\s_-]+', '', raw.casefold())
    return NORMALIZED_RANK_ORDER.get(normalized)


def _normalize_rank(rank: str | None, line_number: int) -> str | None:
    raw = (rank or '').strip()
    if not raw:
        return None
    if _rank_order(raw) is None:
        raise _line_error(line_number, f'Unknown rank "{raw}". Define rank order before importing custom ranks.')
    return raw


def _validate_child_parent_rank(child: dict[str, Any], parent: StratUnit, parent_line: int) -> None:
    child_rank = child.get('rank_name')
    parent_rank = parent.rank
    child_order = _rank_order(child_rank)
    parent_order = _rank_order(parent_rank)
    if child_order is None or parent_order is None:
        return
    if child_order <= parent_order:
        raise _line_error(
            child['source_line'],
            f'{child_rank} cannot be child of {parent_rank} from line {parent_line}.',
        )


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


def _unit_code(row: dict[str, Any]) -> str | None:
    for key in ('unit_code', 'strat_index', 'unit_abbrev', 'code'):
        value = (row.get(key) or '').strip()
        if value:
            return value
    return None


def _import_ics_csv(session, csv_path: Path, column_map: dict[str, str]) -> tuple[StratChart, int]:
    required = {'unit_id', 'unit_name', 'start_age_ma', 'end_age_ma'}
    missing_mapping = sorted(required.difference(column_map))
    if missing_mapping:
        raise ValueError(f'Missing required StratChart column mapping: {missing_mapping}')

    pending: dict[int, dict[str, Any]] = {}
    with csv_path.open('r', encoding='utf-8-sig', newline='') as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            line_number = reader.line_num
            row = _apply_column_map(row, column_map)
            unit_id_raw = (row.get('unit_id') or '').strip()
            name = (row.get('unit_name') or '').strip()
            if not unit_id_raw and not name:
                continue
            csv_unit_id = _required_int(unit_id_raw, 'unit_id', line_number)
            if not name:
                raise _line_error(line_number, 'unit_name is required.')
            if csv_unit_id in pending:
                raise _line_error(line_number, f'Duplicate unit_id {csv_unit_id}.')
            row['source_line'] = line_number
            row['rank_name'] = _normalize_rank(row.get('rank_name'), line_number)
            row['parent_csv_id'] = _optional_int(row.get('parent_unit_id'), 'parent_unit_id', line_number)
            pending[csv_unit_id] = row

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
    csv_id_to_line: dict[int, int] = {}
    inserted_csv_ids: set[int] = set()
    count = 0

    while pending:
        ready = [
            (csv_unit_id, row)
            for csv_unit_id, row in list(pending.items())
            if row.get('parent_csv_id') is None
            or row['parent_csv_id'] in inserted_csv_ids
        ]
        if not ready:
            first = next(iter(pending.values()))
            raise _line_error(first['source_line'], 'Unresolved parent reference or cyclic parent relationship.')

        for csv_unit_id, row in ready:
            parent_csv_id = row.get('parent_csv_id')
            parent_db_id = csv_id_to_unit[parent_csv_id].id if parent_csv_id is not None else None
            line_number = row['source_line']
            age_top_ma = _required_float(row.get('end_age_ma'), 'end_age_ma', line_number)
            age_base_ma = _required_float(row.get('start_age_ma'), 'start_age_ma', line_number)
            if age_top_ma > age_base_ma:
                raise _line_error(line_number, f'end_age_ma must be <= start_age_ma (got end={age_top_ma}, start={age_base_ma}).')
            if parent_csv_id is not None:
                parent = csv_id_to_unit[parent_csv_id]
                _validate_child_parent_rank(row, parent, csv_id_to_line[parent_csv_id])
                if (
                    parent.age_top_ma is not None
                    and parent.age_base_ma is not None
                    and (age_top_ma < parent.age_top_ma or age_base_ma > parent.age_base_ma)
                ):
                    raise _line_error(
                        line_number,
                        f'Unit "{row.get("unit_name")}" age interval '
                        f'{age_top_ma:g}-{age_base_ma:g} Ma is outside parent "{parent.name}" '
                        f'interval {parent.age_top_ma:g}-{parent.age_base_ma:g} Ma.'
                    )
            unit = StratUnit(
                name=(row.get('unit_name') or '').strip(),
                unit_code=_unit_code(row),
                rank=row.get('rank_name'),
                parent_id=parent_db_id,
                age_top_ma=age_top_ma,
                age_base_ma=age_base_ma,
                lithology=None,
                color_hex=_parse_color_hex(row.get('color')),
                chart_id=chart.id,
            )
            session.add(unit)
            csv_id_to_unit[csv_unit_id] = unit
            csv_id_to_line[csv_unit_id] = line_number
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
