from __future__ import annotations

import csv
import io
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from subsidence.api._deps import manager_project_path as _manager_project_path
from subsidence.api._deps import require_open_project as _require_open_project
from subsidence.data.importers.common import _apply_column_map, _extract_user_attributes, _json_or_none
from subsidence.data.schema import SeaLevelCurve, SeaLevelPoint, WellActiveSeaLevelCurve, WellModel
from subsidence.observability import operation_log

router = APIRouter(tags=['sea-level'])

_SEA_LEVEL_KNOWN_FIELDS = {
    'age_ma',
    'age',
    'age_ma_bp',
    'time_ma',
    'sea_level_m',
    'sea_level',
    'level_m',
    'sl_m',
    'eustatic_m',
}


class SeaLevelCurveCreate(BaseModel):
    name: str
    source: str | None = None


class SeaLevelCurveResponse(BaseModel):
    id: int
    name: str
    source: str | None
    is_builtin: bool
    point_count: int


class SeaLevelPointUpload(BaseModel):
    age_ma: float
    sea_level_m: float


class SeaLevelPointResponse(BaseModel):
    age_ma: float
    sea_level_m: float


class ActiveSeaLevelCurveRequest(BaseModel):
    curve_id: int | None


class ImportSeaLevelCurveRequest(BaseModel):
    csv_path: str
    curve_name: str
    column_map: dict[str, str]
    ignored_columns: list[str] = []
    delimiter: str = 'auto'
    header_row: int = Field(default=0, ge=0)


class ImportSeaLevelCurveResponse(BaseModel):
    curve_id: int
    point_count: int


def _float_required(value: str | None, field_name: str, row_number: int) -> float:
    raw = (value or '').strip()
    if not raw:
        raise ValueError(f'Missing {field_name} at row {row_number}')
    try:
        return float(raw)
    except ValueError as exc:
        raise ValueError(f'Invalid {field_name} at row {row_number}: {raw!r}') from exc


def _detect_delimiter(sample: str) -> str:
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=',;\t ')
        return dialect.delimiter
    except csv.Error:
        return ','


def _read_sea_level_rows(csv_path: Path, delimiter: str, header_row: int) -> tuple[list[str], list[dict[str, str]]]:
    try:
        content = csv_path.read_text(encoding='utf-8-sig')
    except UnicodeDecodeError:
        content = csv_path.read_text(encoding='latin-1')

    if not content.strip():
        raise ValueError('Sea level CSV is empty')

    detected = _detect_delimiter(content[:4096]) if delimiter == 'auto' else delimiter
    lines = content.splitlines()
    if header_row >= len(lines):
        raise ValueError(f'Header row {header_row} is outside the file')

    reader = csv.DictReader(io.StringIO('\n'.join(lines[header_row:])), delimiter=detected)
    fieldnames = [field.strip() for field in (reader.fieldnames or [])]
    rows: list[dict[str, str]] = []
    for row in reader:
        rows.append({(key or '').strip(): (value or '').strip() for key, value in row.items()})
    return fieldnames, rows


def _import_sea_level_curve_csv(
    session,
    csv_path: Path,
    curve_name: str,
    column_map: dict[str, str],
    ignored_columns: list[str] | None = None,
    delimiter: str = 'auto',
    header_row: int = 0,
) -> tuple[SeaLevelCurve, int]:
    required = {'age_ma', 'sea_level_m'}
    missing_mapping = sorted(required.difference(column_map))
    if missing_mapping:
        raise ValueError(f'Missing required sea level column mapping: {missing_mapping}')

    name = curve_name.strip()
    if not name:
        raise ValueError('Curve name cannot be empty')

    fieldnames, rows = _read_sea_level_rows(csv_path, delimiter, header_row)
    fieldnames, rows = _apply_column_map(fieldnames, rows, column_map, ignored_columns)
    if not rows:
        raise ValueError('No sea level points found in CSV')

    points: list[SeaLevelPoint] = []
    for row_number, row in enumerate(rows, start=header_row + 2):
        age_ma = _float_required(row.get('age_ma'), 'age_ma', row_number)
        sea_level_m = _float_required(row.get('sea_level_m'), 'sea_level_m', row_number)
        points.append(
            SeaLevelPoint(
                age_ma=age_ma,
                sea_level_m=sea_level_m,
                extra=_json_or_none(_extract_user_attributes(row, _SEA_LEVEL_KNOWN_FIELDS)),
            )
        )

    points.sort(key=lambda point: point.age_ma, reverse=True)

    curve = SeaLevelCurve(name=name, source=str(csv_path), is_builtin=False)
    session.add(curve)
    session.flush()
    for point in points:
        point.curve_id = curve.id
        session.add(point)

    return curve, len(points)


@router.get('/sea-level-curves', response_model=list[SeaLevelCurveResponse])
def list_sea_level_curves(request: Request) -> list[SeaLevelCurveResponse]:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        rows = session.scalars(select(SeaLevelCurve).order_by(SeaLevelCurve.name.asc())).all()
        counts: dict[int, int] = {
            row[0]: row[1]
            for row in session.execute(
                select(SeaLevelPoint.curve_id, func.count().label('count'))
                .group_by(SeaLevelPoint.curve_id)
            )
        }
        return [
            SeaLevelCurveResponse(
                id=row.id,
                name=row.name,
                source=row.source,
                is_builtin=row.is_builtin,
                point_count=counts.get(row.id, 0),
            )
            for row in rows
        ]


@router.post('/sea-level-curves', response_model=SeaLevelCurveResponse, status_code=201)
def create_sea_level_curve(body: SeaLevelCurveCreate, request: Request) -> SeaLevelCurveResponse:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        name = body.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail='Name cannot be empty')
        row = SeaLevelCurve(name=name, source=body.source)
        session.add(row)
        session.commit()
        return SeaLevelCurveResponse(id=row.id, name=row.name, source=row.source, is_builtin=row.is_builtin, point_count=0)


@router.post('/sea-level-curves/{curve_id}/points', status_code=201)
def upload_sea_level_points(curve_id: int, points: list[SeaLevelPointUpload], request: Request) -> dict[str, int]:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        curve = session.get(SeaLevelCurve, curve_id)
        if curve is None:
            raise HTTPException(status_code=404, detail=f'Sea level curve not found: {curve_id}')
        if curve.is_builtin:
            raise HTTPException(status_code=409, detail='Built-in sea level curve points cannot be overwritten')
        for p in session.scalars(select(SeaLevelPoint).where(SeaLevelPoint.curve_id == curve_id)).all():
            session.delete(p)
        session.flush()
        for pt in points:
            session.add(SeaLevelPoint(curve_id=curve_id, age_ma=pt.age_ma, sea_level_m=pt.sea_level_m))
        session.commit()
    return {'count': len(points)}


@router.get('/sea-level-curves/{curve_id}/points', response_model=list[SeaLevelPointResponse])
def get_sea_level_points(curve_id: int, request: Request) -> list[SeaLevelPointResponse]:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        if session.get(SeaLevelCurve, curve_id) is None:
            raise HTTPException(status_code=404, detail=f'Sea level curve not found: {curve_id}')
        points = session.scalars(
            select(SeaLevelPoint)
            .where(SeaLevelPoint.curve_id == curve_id)
            .order_by(SeaLevelPoint.age_ma.desc())
        ).all()
        return [SeaLevelPointResponse(age_ma=p.age_ma, sea_level_m=p.sea_level_m) for p in points]


@router.post('/sea-level-curves/import', response_model=ImportSeaLevelCurveResponse)
def import_sea_level_curve(body: ImportSeaLevelCurveRequest, request: Request) -> ImportSeaLevelCurveResponse:
    manager = _require_open_project(request)
    with operation_log('sea_level.import', project_path=_manager_project_path(manager), input_path=body.csv_path):
        csv_path = Path(body.csv_path)
        if not csv_path.exists():
            raise HTTPException(status_code=400, detail=f'File not found: {body.csv_path}')
        if not csv_path.is_file():
            raise HTTPException(status_code=400, detail=f'Path is not a file: {body.csv_path}')

        with manager.get_session() as session:
            try:
                curve, point_count = _import_sea_level_curve_csv(
                    session,
                    csv_path,
                    body.curve_name,
                    body.column_map,
                    body.ignored_columns,
                    delimiter=body.delimiter,
                    header_row=body.header_row,
                )
                curve_id = curve.id
                session.commit()
            except ValueError as exc:
                raise HTTPException(status_code=422, detail=str(exc)) from exc

        manager.save_project()
        return ImportSeaLevelCurveResponse(curve_id=curve_id, point_count=point_count)


@router.delete('/sea-level-curves/{curve_id}', status_code=204)
def delete_sea_level_curve(curve_id: int, request: Request) -> None:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        curve = session.get(SeaLevelCurve, curve_id)
        if curve is None:
            raise HTTPException(status_code=404, detail=f'Sea level curve not found: {curve_id}')
        if curve.is_builtin:
            raise HTTPException(status_code=409, detail='Built-in sea level curves cannot be deleted')
        in_use = session.scalar(
            select(WellActiveSeaLevelCurve).where(WellActiveSeaLevelCurve.curve_id == curve_id)
        )
        if in_use is not None:
            raise HTTPException(status_code=409, detail='Sea level curve is currently assigned to a well')
        for pt in session.scalars(select(SeaLevelPoint).where(SeaLevelPoint.curve_id == curve_id)).all():
            session.delete(pt)
        session.delete(curve)
        session.commit()


@router.put('/wells/{well_id}/active-sea-level-curve')
def set_well_active_sea_level_curve(well_id: str, body: ActiveSeaLevelCurveRequest, request: Request) -> dict[str, object]:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        if session.get(WellModel, well_id) is None:
            raise HTTPException(status_code=404, detail=f'Well not found: {well_id}')
        link = session.scalar(select(WellActiveSeaLevelCurve).where(WellActiveSeaLevelCurve.well_id == well_id))
        if body.curve_id is None:
            if link is not None:
                session.delete(link)
        else:
            if session.get(SeaLevelCurve, body.curve_id) is None:
                raise HTTPException(status_code=404, detail=f'Sea level curve not found: {body.curve_id}')
            if link is None:
                session.add(WellActiveSeaLevelCurve(well_id=well_id, curve_id=body.curve_id))
            else:
                link.curve_id = body.curve_id
        session.commit()
    return {'well_id': well_id, 'curve_id': body.curve_id}
