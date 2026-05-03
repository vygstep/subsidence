from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func, select

from subsidence.data.engine import create_all_tables
from subsidence.data.lithology_patterns import SvgValidationError, normalize_pattern_code, sanitize_svg_content, sanitize_svg_file
from subsidence.data.schema import LithologyPattern, LithologyPatternPalette, LithologySetEntry

router = APIRouter(tags=['lithology-patterns'])


class LithologyPatternPaletteSummary(BaseModel):
    id: int
    name: str
    origin: str
    is_builtin: bool
    source_url: str | None
    license_name: str | None
    entry_count: int


class LithologyPatternItem(BaseModel):
    id: int
    palette_id: int
    code: str
    display_name: str
    svg_content: str
    source_code: str | None
    source_name: str | None
    source_path: str | None
    tile_width: int
    tile_height: int
    description: str | None
    sort_order: int
    group_name: str | None
    base_lithology_code: str | None


class LithologyPatternPaletteDetail(LithologyPatternPaletteSummary):
    description: str | None
    patterns: list[LithologyPatternItem]


class LithologyPatternPaletteCreate(BaseModel):
    name: str
    clone_from_id: int | None = None


class LithologyPatternPalettePatch(BaseModel):
    name: str | None = None
    description: str | None = None


class LithologyPatternImportRequest(BaseModel):
    path: str
    code: str | None = None
    display_name: str | None = None
    description: str | None = None


def _require_open_project(request: Request):
    manager = request.app.state.project_manager
    if not manager.is_open:
        raise HTTPException(status_code=400, detail='No project is currently open')
    return manager


def _ensure_pattern_palettes(manager) -> None:
    project_path = manager.project_path
    if project_path is None:
        return
    with manager.get_session() as session:
        create_all_tables(session.get_bind())
        manager._seed_dictionaries(session, project_path)
        session.commit()


def _normalize_name(value: str | None, field: str = 'Name') -> str:
    name = (value or '').strip()
    if not name:
        raise HTTPException(status_code=400, detail=f'{field} is required')
    return name


def _normalize_code(value: str | None) -> str:
    try:
        return normalize_pattern_code(value)
    except SvgValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _require_palette(session, palette_id: int) -> LithologyPatternPalette:
    row = session.get(LithologyPatternPalette, palette_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f'Lithology pattern palette not found: {palette_id}')
    return row


def _require_user_palette(session, palette_id: int) -> LithologyPatternPalette:
    row = _require_palette(session, palette_id)
    if row.is_builtin:
        raise HTTPException(status_code=403, detail='Built-in lithology pattern palette cannot be edited')
    return row


def _require_pattern(session, palette_id: int, pattern_id: int) -> LithologyPattern:
    row = session.get(LithologyPattern, pattern_id)
    if row is None or row.palette_id != palette_id:
        raise HTTPException(status_code=404, detail=f'Lithology pattern not found: {pattern_id}')
    return row


def _ensure_unique_code(session, code: str, exclude_pattern_id: int | None = None) -> None:
    query = select(LithologyPattern).where(LithologyPattern.code == code)
    if exclude_pattern_id is not None:
        query = query.where(LithologyPattern.id != exclude_pattern_id)
    if session.scalar(query) is not None:
        raise HTTPException(status_code=409, detail=f'Lithology pattern code already exists: {code}')


def _ensure_pattern_not_referenced(session, code: str) -> None:
    count = session.scalar(select(func.count()).select_from(LithologySetEntry).where(LithologySetEntry.pattern_id == code))
    if count:
        raise HTTPException(status_code=409, detail=f'Lithology pattern is used by {count} lithology set entries')


def _next_sort_order(session, palette_id: int) -> int:
    value = session.scalar(
        select(func.max(LithologyPattern.sort_order)).where(LithologyPattern.palette_id == palette_id)
    )
    return int(value or 0) + 10


def _palette_summary_to_item(row: LithologyPatternPalette, entry_count: int | None = None) -> LithologyPatternPaletteSummary:
    return LithologyPatternPaletteSummary(
        id=row.id,
        name=row.name,
        origin=row.origin,
        is_builtin=row.is_builtin,
        source_url=row.source_url,
        license_name=row.license_name,
        entry_count=entry_count if entry_count is not None else len(row.patterns),
    )


def _pattern_to_item(row: LithologyPattern) -> LithologyPatternItem:
    return LithologyPatternItem(
        id=row.id,
        palette_id=row.palette_id,
        code=row.code,
        display_name=row.display_name,
        svg_content=row.svg_content,
        source_code=row.source_code,
        source_name=row.source_name,
        source_path=row.source_path,
        tile_width=row.tile_width,
        tile_height=row.tile_height,
        description=row.description,
        sort_order=row.sort_order,
        group_name=row.group_name,
        base_lithology_code=row.base_lithology_code,
    )


def _create_pattern_row(
    *,
    palette_id: int,
    code: str,
    display_name: str,
    svg_content: str,
    tile_width: int,
    tile_height: int,
    sort_order: int,
    description: str | None = None,
    source_path: str | None = None,
) -> LithologyPattern:
    return LithologyPattern(
        palette_id=palette_id,
        code=code,
        display_name=display_name,
        svg_content=svg_content,
        source_path=source_path,
        tile_width=tile_width,
        tile_height=tile_height,
        description=(description or '').strip() or None,
        sort_order=sort_order,
    )


@router.get('/lithology-pattern-palettes', response_model=list[LithologyPatternPaletteSummary])
def list_lithology_pattern_palettes(request: Request) -> list[LithologyPatternPaletteSummary]:
    manager = _require_open_project(request)
    _ensure_pattern_palettes(manager)
    with manager.get_session() as session:
        counts = dict(
            session.execute(
                select(LithologyPattern.palette_id, func.count(LithologyPattern.id)).group_by(LithologyPattern.palette_id)
            ).all()
        )
        rows = session.scalars(
            select(LithologyPatternPalette).order_by(
                LithologyPatternPalette.is_builtin.desc(),
                LithologyPatternPalette.sort_order.asc(),
                LithologyPatternPalette.name.asc(),
                LithologyPatternPalette.id.asc(),
            )
        ).all()
        return [_palette_summary_to_item(row, counts.get(row.id, 0)) for row in rows]


@router.get('/lithology-pattern-palettes/{palette_id}', response_model=LithologyPatternPaletteDetail)
def get_lithology_pattern_palette(palette_id: int, request: Request) -> LithologyPatternPaletteDetail:
    manager = _require_open_project(request)
    _ensure_pattern_palettes(manager)
    with manager.get_session() as session:
        row = _require_palette(session, palette_id)
        patterns = session.scalars(
            select(LithologyPattern)
            .where(LithologyPattern.palette_id == row.id)
            .order_by(LithologyPattern.sort_order.asc(), LithologyPattern.id.asc())
        ).all()
        return LithologyPatternPaletteDetail(
            **_palette_summary_to_item(row, len(patterns)).model_dump(),
            description=row.description,
            patterns=[_pattern_to_item(pattern) for pattern in patterns],
        )


@router.post('/lithology-pattern-palettes', response_model=LithologyPatternPaletteSummary, status_code=201)
def create_lithology_pattern_palette(
    payload: LithologyPatternPaletteCreate,
    request: Request,
) -> LithologyPatternPaletteSummary:
    manager = _require_open_project(request)
    _ensure_pattern_palettes(manager)
    with manager.get_session() as session:
        if payload.clone_from_id is None:
            row = LithologyPatternPalette(name=_normalize_name(payload.name), origin='user', is_builtin=False)
            session.add(row)
            session.commit()
            session.refresh(row)
            return _palette_summary_to_item(row, 0)

        source = _require_palette(session, payload.clone_from_id)
        row = LithologyPatternPalette(
            name=_normalize_name(payload.name),
            origin='user',
            is_builtin=False,
            source_url=source.source_url,
            license_name=source.license_name,
            description=source.description,
        )
        session.add(row)
        session.flush()
        for pattern in session.scalars(
            select(LithologyPattern)
            .where(LithologyPattern.palette_id == source.id)
            .order_by(LithologyPattern.sort_order.asc(), LithologyPattern.id.asc())
        ).all():
            code = f'{pattern.code}_copy_{row.id}'
            session.add(
                LithologyPattern(
                    palette_id=row.id,
                    code=code,
                    display_name=pattern.display_name,
                    svg_content=pattern.svg_content,
                    source_code=pattern.source_code,
                    source_name=pattern.source_name,
                    source_path=pattern.source_path,
                    tile_width=pattern.tile_width,
                    tile_height=pattern.tile_height,
                    description=pattern.description,
                    sort_order=pattern.sort_order,
                )
            )
        session.commit()
        session.refresh(row)
        entry_count = session.scalar(select(func.count()).select_from(LithologyPattern).where(LithologyPattern.palette_id == row.id))
        return _palette_summary_to_item(row, int(entry_count or 0))


@router.patch('/lithology-pattern-palettes/{palette_id}', response_model=LithologyPatternPaletteSummary)
def patch_lithology_pattern_palette(
    palette_id: int,
    payload: LithologyPatternPalettePatch,
    request: Request,
) -> LithologyPatternPaletteSummary:
    manager = _require_open_project(request)
    _ensure_pattern_palettes(manager)
    with manager.get_session() as session:
        row = _require_user_palette(session, palette_id)
        if payload.name is not None:
            row.name = _normalize_name(payload.name)
        if payload.description is not None:
            row.description = payload.description.strip() or None
        session.commit()
        session.refresh(row)
        entry_count = session.scalar(select(func.count()).select_from(LithologyPattern).where(LithologyPattern.palette_id == row.id))
        return _palette_summary_to_item(row, int(entry_count or 0))


@router.delete('/lithology-pattern-palettes/{palette_id}', status_code=204)
def delete_lithology_pattern_palette(palette_id: int, request: Request) -> None:
    manager = _require_open_project(request)
    _ensure_pattern_palettes(manager)
    with manager.get_session() as session:
        row = _require_user_palette(session, palette_id)
        for pattern in session.scalars(select(LithologyPattern).where(LithologyPattern.palette_id == row.id)).all():
            _ensure_pattern_not_referenced(session, pattern.code)
        session.delete(row)
        session.commit()



@router.post('/lithology-pattern-palettes/{palette_id}/patterns/import', response_model=LithologyPatternItem, status_code=201)
def import_lithology_pattern(
    palette_id: int,
    payload: LithologyPatternImportRequest,
    request: Request,
) -> LithologyPatternItem:
    manager = _require_open_project(request)
    _ensure_pattern_palettes(manager)
    source_path = Path(payload.path)
    with manager.get_session() as session:
        _require_user_palette(session, palette_id)
        code = _normalize_code(payload.code or source_path.stem)
        _ensure_unique_code(session, code)
        try:
            svg_content, tile_width, tile_height = sanitize_svg_file(source_path)
        except (OSError, SvgValidationError) as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        row = _create_pattern_row(
            palette_id=palette_id,
            code=code,
            display_name=_normalize_name(payload.display_name or source_path.stem, 'Pattern display name'),
            svg_content=svg_content,
            tile_width=tile_width,
            tile_height=tile_height,
            sort_order=_next_sort_order(session, palette_id),
            description=payload.description,
            source_path=str(source_path),
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        return _pattern_to_item(row)



@router.delete('/lithology-pattern-palettes/{palette_id}/patterns/{pattern_id}', status_code=204)
def delete_lithology_pattern(palette_id: int, pattern_id: int, request: Request) -> None:
    manager = _require_open_project(request)
    _ensure_pattern_palettes(manager)
    with manager.get_session() as session:
        _require_user_palette(session, palette_id)
        row = _require_pattern(session, palette_id, pattern_id)
        _ensure_pattern_not_referenced(session, row.code)
        session.delete(row)
        session.commit()
