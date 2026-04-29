from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func, select

from subsidence.data.schema import SeaLevelCurve, SeaLevelPoint, WellActiveSeaLevelCurve, WellModel

router = APIRouter(tags=['sea-level'])


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


def _require_open_project(request: Request):
    manager = request.app.state.project_manager
    if not manager.is_open:
        raise HTTPException(status_code=400, detail='No project is currently open')
    return manager


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


@router.delete('/sea-level-curves/{curve_id}', status_code=204)
def delete_sea_level_curve(curve_id: int, request: Request) -> None:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        curve = session.get(SeaLevelCurve, curve_id)
        if curve is None:
            raise HTTPException(status_code=404, detail=f'Sea level curve not found: {curve_id}')
        if curve.is_builtin:
            raise HTTPException(status_code=409, detail='Built-in sea level curve cannot be deleted')
        if session.scalar(select(WellActiveSeaLevelCurve).where(WellActiveSeaLevelCurve.curve_id == curve_id)) is not None:
            raise HTTPException(status_code=409, detail='Sea level curve is in use by one or more wells')
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
