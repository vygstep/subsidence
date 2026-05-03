from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select

from subsidence.data.engine import create_all_tables
from subsidence.data.unit_registry import normalize_lithology_values_to_engine
from subsidence.data.schema import (
    CompactionModel,
    CompactionModelParam,
    CompactionPreset,
    CurveDictEntry,
    CurveMnemonicEntry,
    CurveMnemonicSet,
    LithologyDictEntry,
    LithologySet,
    LithologySetEntry,
    MeasurementUnit,
    MeasurementUnitAlias,
    UnitDimension,
)

router = APIRouter(tags=['compaction'])


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class CompactionModelResponse(BaseModel):
    id: int
    name: str
    is_builtin: bool
    is_active: bool


class CompactionModelCreate(BaseModel):
    name: str
    clone_from_id: int | None = None


class CompactionModelPatch(BaseModel):
    name: str | None = None
    is_active: bool | None = None


class CompactionPresetSummary(BaseModel):
    id: int
    name: str
    origin: str
    is_builtin: bool
    source_lithology_code: str | None


class CompactionPresetDetail(CompactionPresetSummary):
    description: str | None
    density: float
    porosity_surface: float
    compaction_coeff: float


class CompactionPresetCreate(BaseModel):
    name: str | None = None
    clone_from_id: int | None = None
    description: str | None = None
    density: float | None = None
    density_unit: str | None = None
    porosity_surface: float | None = None
    porosity_surface_unit: str | None = None
    compaction_coeff: float | None = None
    compaction_coeff_unit: str | None = None


class CompactionPresetPatch(BaseModel):
    name: str | None = None
    description: str | None = None
    density: float | None = None
    density_unit: str | None = None
    porosity_surface: float | None = None
    porosity_surface_unit: str | None = None
    compaction_coeff: float | None = None
    compaction_coeff_unit: str | None = None


class LithologyParamItem(BaseModel):
    lithology_code: str
    display_name: str
    color_hex: str
    density: float
    porosity_surface: float
    compaction_coeff: float


class LithologyParamPatch(BaseModel):
    density: float | None = None
    density_unit: str | None = None
    porosity_surface: float | None = None
    porosity_surface_unit: str | None = None
    compaction_coeff: float | None = None
    compaction_coeff_unit: str | None = None


class CurveDictionaryItem(BaseModel):
    id: int
    scope: str
    pattern: str
    is_regex: bool
    priority: int
    family_code: str | None
    canonical_mnemonic: str | None
    canonical_unit: str | None
    is_active: bool


class CurveMnemonicSetSummary(BaseModel):
    id: int
    name: str
    is_builtin: bool
    entry_count: int


class CurveMnemonicEntryItem(BaseModel):
    id: int
    pattern: str
    is_regex: bool
    priority: int
    family_code: str | None
    canonical_mnemonic: str | None
    canonical_unit: str | None
    is_active: bool


class CurveMnemonicSetDetail(CurveMnemonicSetSummary):
    entries: list[CurveMnemonicEntryItem]


class CurveMnemonicSetCreate(BaseModel):
    name: str


class CurveMnemonicSetPatch(BaseModel):
    name: str | None = None


class CurveMnemonicEntryCreate(BaseModel):
    pattern: str | None = None
    is_regex: bool = False
    priority: int = 0
    family_code: str | None = None
    canonical_mnemonic: str | None = None
    canonical_unit: str | None = None
    is_active: bool = True


class CurveMnemonicEntryPatch(BaseModel):
    pattern: str | None = None
    is_regex: bool | None = None
    priority: int | None = None
    family_code: str | None = None
    canonical_mnemonic: str | None = None
    canonical_unit: str | None = None
    is_active: bool | None = None


class LithologyDictionaryItem(BaseModel):
    id: int
    lithology_code: str
    display_name: str
    color_hex: str
    pattern_id: str | None
    description: str | None
    sort_order: int
    density: float
    porosity_surface: float
    compaction_coeff: float


class LithologySetSummary(BaseModel):
    id: int
    name: str
    is_builtin: bool
    entry_count: int


class LithologySetEntryItem(BaseModel):
    id: int
    lithology_code: str
    display_name: str
    color_hex: str
    pattern_id: str | None
    sort_order: int
    compaction_preset_id: int | None
    compaction_preset_label: str | None
    density: float | None
    porosity_surface: float | None
    compaction_coeff: float | None


class LithologySetDetail(LithologySetSummary):
    entries: list[LithologySetEntryItem]


class LithologySetCreate(BaseModel):
    name: str


class LithologySetPatch(BaseModel):
    name: str | None = None


class LithologySetEntryCreate(BaseModel):
    lithology_code: str | None = None
    display_name: str | None = None
    color_hex: str | None = None
    pattern_id: str | None = None
    compaction_preset_id: int | None = None


class LithologySetEntryPatch(BaseModel):
    lithology_code: str | None = None
    display_name: str | None = None
    color_hex: str | None = None
    pattern_id: str | None = None
    compaction_preset_id: int | None = None


class MeasurementUnitAliasItem(BaseModel):
    id: int
    dimension_code: str
    unit_code: str
    alias: str
    normalized_alias: str
    is_builtin: bool
    is_active: bool


class MeasurementUnitItem(BaseModel):
    id: int
    code: str
    dimension_code: str
    symbol: str
    display_name: str
    to_engine_factor: float
    to_engine_offset: float
    is_builtin: bool
    is_active: bool
    sort_order: int
    aliases: list[MeasurementUnitAliasItem]


class UnitDimensionSummary(BaseModel):
    id: int
    code: str
    display_name: str
    description: str | None
    engine_unit_code: str
    is_builtin: bool
    sort_order: int
    unit_count: int
    alias_count: int


class UnitDimensionDetail(UnitDimensionSummary):
    units: list[MeasurementUnitItem]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _require_open_project(request: Request):
    manager = request.app.state.project_manager
    if not manager.is_open:
        raise HTTPException(status_code=400, detail='No project is currently open')
    return manager


def _ensure_lithology_sets(manager) -> None:
    project_path = manager.project_path
    if project_path is None:
        return
    with manager.get_session() as session:
        create_all_tables(session.get_bind())
        manager._seed_dictionaries(session, project_path)
        session.commit()


def _ensure_mnemonic_sets(manager) -> None:
    project_path = manager.project_path
    if project_path is None:
        return
    with manager.get_session() as session:
        create_all_tables(session.get_bind())
        manager._seed_dictionaries(session, project_path)
        session.commit()


def _ensure_measurement_units(manager) -> None:
    project_path = manager.project_path
    if project_path is None:
        return
    with manager.get_session() as session:
        create_all_tables(session.get_bind())
        manager._seed_dictionaries(session, project_path)
        session.commit()


def _require_mnemonic_set(session, set_id: int) -> CurveMnemonicSet:
    row = session.get(CurveMnemonicSet, set_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f'Mnemonic set not found: {set_id}')
    return row


def _require_user_mnemonic_set(session, set_id: int) -> CurveMnemonicSet:
    row = _require_mnemonic_set(session, set_id)
    if row.is_builtin:
        raise HTTPException(status_code=403, detail='Built-in mnemonic set cannot be edited')
    return row


def _normalize_mnemonic_set_name(value: str | None) -> str:
    name = (value or '').strip()
    if not name:
        raise HTTPException(status_code=400, detail='Mnemonic set name is required')
    return name


def _next_mnemonic_set_sort_order(session) -> int:
    values = [
        row.sort_order
        for row in session.scalars(
            select(CurveMnemonicSet).where(CurveMnemonicSet.is_builtin.is_(False))
        ).all()
    ]
    return max(values, default=0) + 1


def _normalize_optional_string(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def _normalize_mnemonic_pattern(value: str | None, is_regex: bool) -> str:
    pattern = (value or '').strip()
    if not pattern:
        raise HTTPException(status_code=400, detail='Mnemonic pattern is required')
    if is_regex:
        try:
            re.compile(pattern)
        except re.error as exc:
            raise HTTPException(status_code=400, detail=f'Invalid regex pattern: {exc}') from exc
    return pattern


def _next_generated_mnemonic_pattern(session, set_id: int) -> str:
    existing_patterns = {
        row.pattern
        for row in session.scalars(
            select(CurveMnemonicEntry).where(CurveMnemonicEntry.set_id == set_id)
        ).all()
    }
    index = 1
    while True:
        candidate = f'MNEM_{index}'
        if candidate not in existing_patterns:
            return candidate
        index += 1


def _require_mnemonic_entry(session, set_id: int, entry_id: int) -> CurveMnemonicEntry:
    row = session.get(CurveMnemonicEntry, entry_id)
    if row is None or row.set_id != set_id:
        raise HTTPException(status_code=404, detail=f'Mnemonic entry not found: {entry_id}')
    return row


def _require_unit_dimension(session, dimension_code: str) -> UnitDimension:
    row = session.scalar(select(UnitDimension).where(UnitDimension.code == dimension_code))
    if row is None:
        raise HTTPException(status_code=404, detail=f'Unit dimension not found: {dimension_code}')
    return row


def _require_lithology_set(session, set_id: int) -> LithologySet:
    row = session.get(LithologySet, set_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f'Lithology set not found: {set_id}')
    return row


def _require_user_lithology_set(session, set_id: int) -> LithologySet:
    row = _require_lithology_set(session, set_id)
    if row.is_builtin:
        raise HTTPException(status_code=403, detail='Built-in lithology set cannot be edited')
    return row


def _normalize_lithology_set_name(value: str | None) -> str:
    name = (value or '').strip()
    if not name:
        raise HTTPException(status_code=400, detail='Lithology set name is required')
    return name


def _normalize_entry_code(value: str | None) -> str:
    code = (value or '').strip()
    if not code:
        raise HTTPException(status_code=400, detail='Lithology code is required')
    return code


def _normalize_entry_name(value: str | None) -> str:
    name = (value or '').strip()
    if not name:
        raise HTTPException(status_code=400, detail='Lithology name is required')
    return name


def _ensure_unique_lithology_code(session, set_id: int, code: str, exclude_entry_id: int | None = None) -> None:
    existing = session.scalars(
        select(LithologySetEntry).where(
            LithologySetEntry.set_id == set_id,
            LithologySetEntry.lithology_code == code,
        )
    ).all()
    for row in existing:
        if exclude_entry_id is None or row.id != exclude_entry_id:
            raise HTTPException(status_code=409, detail=f'Lithology code already exists in this set: {code!r}')


def _resolve_compaction_preset_id(session, preset_id: int | None) -> int | None:
    if preset_id is None:
        return None
    row = session.get(CompactionPreset, preset_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f'Compaction preset not found: {preset_id}')
    return row.id


def _normalize_compaction_values(
    session,
    *,
    density: float,
    porosity_surface: float,
    compaction_coeff: float,
    density_unit: str | None = None,
    porosity_surface_unit: str | None = None,
    compaction_coeff_unit: str | None = None,
) -> tuple[float, float, float]:
    try:
        return normalize_lithology_values_to_engine(
            session,
            density=density,
            porosity_surface=porosity_surface,
            compaction_coeff=compaction_coeff,
            density_unit=density_unit or 'kg/m3',
            porosity_surface_unit=porosity_surface_unit or 'v/v',
            compaction_coeff_unit=compaction_coeff_unit or 'km^-1',
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _reject_unit_without_value(payload, value_field: str, unit_field: str) -> None:
    if unit_field in payload.model_fields_set and value_field not in payload.model_fields_set:
        raise HTTPException(status_code=400, detail=f'{unit_field} requires {value_field}')


def _next_generated_lithology_code(session, set_id: int) -> str:
    existing_codes = {
        row.lithology_code
        for row in session.scalars(
            select(LithologySetEntry).where(LithologySetEntry.set_id == set_id)
        ).all()
    }
    index = 1
    while True:
        candidate = f'LITH_{index}'
        if candidate not in existing_codes:
            return candidate
        index += 1


def _to_model_response(row: CompactionModel) -> CompactionModelResponse:
    return CompactionModelResponse(
        id=row.id,
        name=row.name,
        is_builtin=row.is_builtin,
        is_active=row.is_active,
    )


def _to_preset_summary(row: CompactionPreset) -> CompactionPresetSummary:
    return CompactionPresetSummary(
        id=row.id,
        name=row.name,
        origin=row.origin,
        is_builtin=row.is_builtin,
        source_lithology_code=row.source_lithology_code,
    )


def _to_preset_detail(row: CompactionPreset) -> CompactionPresetDetail:
    return CompactionPresetDetail(
        id=row.id,
        name=row.name,
        origin=row.origin,
        is_builtin=row.is_builtin,
        source_lithology_code=row.source_lithology_code,
        description=row.description,
        density=row.density,
        porosity_surface=row.porosity_surface,
        compaction_coeff=row.compaction_coeff,
    )


def _param_to_item(param: CompactionModelParam, litho: LithologyDictEntry) -> LithologyParamItem:
    return LithologyParamItem(
        lithology_code=param.lithology_code,
        display_name=litho.display_name,
        color_hex=litho.color_hex,
        density=param.density,
        porosity_surface=param.porosity_surface,
        compaction_coeff=param.compaction_coeff,
    )


def _curve_dict_to_item(row: CurveDictEntry) -> CurveDictionaryItem:
    return CurveDictionaryItem(
        id=row.id,
        scope=row.scope,
        pattern=row.pattern,
        is_regex=row.is_regex,
        priority=row.priority,
        family_code=row.family_code,
        canonical_mnemonic=row.canonical_mnemonic,
        canonical_unit=row.canonical_unit,
        is_active=row.is_active,
    )


def _lithology_dict_to_item(row: LithologyDictEntry) -> LithologyDictionaryItem:
    return LithologyDictionaryItem(
        id=row.id,
        lithology_code=row.lithology_code,
        display_name=row.display_name,
        color_hex=row.color_hex,
        pattern_id=row.pattern_id,
        description=row.description,
        sort_order=row.sort_order,
        density=row.density,
        porosity_surface=row.porosity_surface,
        compaction_coeff=row.compaction_coeff,
    )


def _mnemonic_set_summary_to_item(row: CurveMnemonicSet, entry_count: int | None = None) -> CurveMnemonicSetSummary:
    return CurveMnemonicSetSummary(
        id=row.id,
        name=row.name,
        is_builtin=row.is_builtin,
        entry_count=len(row.entries) if entry_count is None else entry_count,
    )


def _mnemonic_entry_to_item(row: CurveMnemonicEntry) -> CurveMnemonicEntryItem:
    return CurveMnemonicEntryItem(
        id=row.id,
        pattern=row.pattern,
        is_regex=row.is_regex,
        priority=row.priority,
        family_code=row.family_code,
        canonical_mnemonic=row.canonical_mnemonic,
        canonical_unit=row.canonical_unit,
        is_active=row.is_active,
    )


def _lithology_set_summary_to_item(row: LithologySet) -> LithologySetSummary:
    return LithologySetSummary(
        id=row.id,
        name=row.name,
        is_builtin=row.is_builtin,
        entry_count=len(row.entries),
    )


def _lithology_set_entry_to_item(row: LithologySetEntry) -> LithologySetEntryItem:
    preset = row.compaction_preset
    return LithologySetEntryItem(
        id=row.id,
        lithology_code=row.lithology_code,
        display_name=row.display_name,
        color_hex=row.color_hex,
        pattern_id=row.pattern_id,
        sort_order=row.sort_order,
        compaction_preset_id=row.compaction_preset_id,
        compaction_preset_label=(
            f"{preset.id} {preset.name} [{preset.origin}]"
            if preset is not None
            else None
        ),
        density=preset.density if preset is not None else None,
        porosity_surface=preset.porosity_surface if preset is not None else None,
        compaction_coeff=preset.compaction_coeff if preset is not None else None,
    )


def _unit_alias_to_item(row: MeasurementUnitAlias) -> MeasurementUnitAliasItem:
    return MeasurementUnitAliasItem(
        id=row.id,
        dimension_code=row.dimension_code,
        unit_code=row.unit_code,
        alias=row.alias,
        normalized_alias=row.normalized_alias,
        is_builtin=row.is_builtin,
        is_active=row.is_active,
    )


def _unit_to_item(row: MeasurementUnit) -> MeasurementUnitItem:
    aliases = sorted(row.aliases, key=lambda item: (item.normalized_alias, item.id))
    return MeasurementUnitItem(
        id=row.id,
        code=row.code,
        dimension_code=row.dimension_code,
        symbol=row.symbol,
        display_name=row.display_name,
        to_engine_factor=row.to_engine_factor,
        to_engine_offset=row.to_engine_offset,
        is_builtin=row.is_builtin,
        is_active=row.is_active,
        sort_order=row.sort_order,
        aliases=[_unit_alias_to_item(alias) for alias in aliases],
    )


def _dimension_to_summary(row: UnitDimension) -> UnitDimensionSummary:
    units = list(row.units)
    return UnitDimensionSummary(
        id=row.id,
        code=row.code,
        display_name=row.display_name,
        description=row.description,
        engine_unit_code=row.engine_unit_code,
        is_builtin=row.is_builtin,
        sort_order=row.sort_order,
        unit_count=len(units),
        alias_count=sum(len(unit.aliases) for unit in units),
    )


def _dimension_to_detail(row: UnitDimension) -> UnitDimensionDetail:
    units = sorted(row.units, key=lambda item: (item.sort_order, item.id))
    summary = _dimension_to_summary(row)
    return UnitDimensionDetail(
        **summary.model_dump(),
        units=[_unit_to_item(unit) for unit in units],
    )


# ---------------------------------------------------------------------------
# Measurement unit dictionary read-only API
# ---------------------------------------------------------------------------

@router.get('/unit-dimensions', response_model=list[UnitDimensionSummary])
def list_unit_dimensions(request: Request) -> list[UnitDimensionSummary]:
    manager = _require_open_project(request)
    _ensure_measurement_units(manager)
    with manager.get_session() as session:
        rows = session.scalars(
            select(UnitDimension).order_by(UnitDimension.sort_order.asc(), UnitDimension.id.asc())
        ).all()
        return [_dimension_to_summary(row) for row in rows]


@router.get('/unit-dimensions/{dimension_code}', response_model=UnitDimensionDetail)
def get_unit_dimension(dimension_code: str, request: Request) -> UnitDimensionDetail:
    manager = _require_open_project(request)
    _ensure_measurement_units(manager)
    with manager.get_session() as session:
        row = _require_unit_dimension(session, dimension_code)
        return _dimension_to_detail(row)


@router.get('/measurement-units', response_model=list[MeasurementUnitItem])
def list_measurement_units(request: Request, dimension_code: str | None = None) -> list[MeasurementUnitItem]:
    manager = _require_open_project(request)
    _ensure_measurement_units(manager)
    with manager.get_session() as session:
        stmt = select(MeasurementUnit).order_by(
            MeasurementUnit.dimension_code.asc(),
            MeasurementUnit.sort_order.asc(),
            MeasurementUnit.id.asc(),
        )
        if dimension_code is not None:
            _require_unit_dimension(session, dimension_code)
            stmt = stmt.where(MeasurementUnit.dimension_code == dimension_code)
        rows = session.scalars(stmt).all()
        return [_unit_to_item(row) for row in rows]


@router.get('/measurement-unit-aliases', response_model=list[MeasurementUnitAliasItem])
def list_measurement_unit_aliases(
    request: Request,
    dimension_code: str | None = None,
    unit_code: str | None = None,
) -> list[MeasurementUnitAliasItem]:
    manager = _require_open_project(request)
    _ensure_measurement_units(manager)
    with manager.get_session() as session:
        stmt = select(MeasurementUnitAlias).order_by(
            MeasurementUnitAlias.dimension_code.asc(),
            MeasurementUnitAlias.normalized_alias.asc(),
            MeasurementUnitAlias.id.asc(),
        )
        if dimension_code is not None:
            _require_unit_dimension(session, dimension_code)
            stmt = stmt.where(MeasurementUnitAlias.dimension_code == dimension_code)
        if unit_code is not None:
            unit = session.scalar(select(MeasurementUnit).where(MeasurementUnit.code == unit_code))
            if unit is None:
                raise HTTPException(status_code=404, detail=f'Measurement unit not found: {unit_code}')
            stmt = stmt.where(MeasurementUnitAlias.unit_code == unit_code)
        rows = session.scalars(stmt).all()
        return [_unit_alias_to_item(row) for row in rows]


# ---------------------------------------------------------------------------
# Compaction preset CRUD
# ---------------------------------------------------------------------------

@router.get('/compaction-presets', response_model=list[CompactionPresetSummary])
def list_compaction_presets(request: Request) -> list[CompactionPresetSummary]:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        rows = session.scalars(
            select(CompactionPreset).order_by(
                CompactionPreset.is_builtin.desc(),
                CompactionPreset.name.asc(),
                CompactionPreset.id.asc(),
            )
        ).all()
        return [_to_preset_summary(row) for row in rows]


@router.get('/compaction-presets/{preset_id}', response_model=CompactionPresetDetail)
def get_compaction_preset(preset_id: int, request: Request) -> CompactionPresetDetail:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        row = session.get(CompactionPreset, preset_id)
        if row is None:
            raise HTTPException(status_code=404, detail=f'Compaction preset not found: {preset_id}')
        return _to_preset_detail(row)


@router.post('/compaction-presets', response_model=CompactionPresetDetail, status_code=201)
def create_compaction_preset(payload: CompactionPresetCreate, request: Request) -> CompactionPresetDetail:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        source: CompactionPreset | None = None
        if payload.clone_from_id is not None:
            source = session.get(CompactionPreset, payload.clone_from_id)
            if source is None:
                raise HTTPException(status_code=404, detail=f'Compaction preset not found: {payload.clone_from_id}')

        _reject_unit_without_value(payload, 'density', 'density_unit')
        _reject_unit_without_value(payload, 'porosity_surface', 'porosity_surface_unit')
        _reject_unit_without_value(payload, 'compaction_coeff', 'compaction_coeff_unit')

        name = (payload.name if payload.name is not None else source.name if source is not None else '').strip()
        if not name:
            raise HTTPException(status_code=400, detail='Compaction preset name is required')

        density = payload.density if payload.density is not None else source.density if source is not None else None
        porosity_surface = (
            payload.porosity_surface
            if payload.porosity_surface is not None
            else source.porosity_surface if source is not None else None
        )
        compaction_coeff = (
            payload.compaction_coeff
            if payload.compaction_coeff is not None
            else source.compaction_coeff if source is not None else None
        )
        if density is None or porosity_surface is None or compaction_coeff is None:
            raise HTTPException(status_code=400, detail='density, porosity_surface, and compaction_coeff are required')

        density, porosity_surface, compaction_coeff = _normalize_compaction_values(
            session,
            density=density,
            porosity_surface=porosity_surface,
            compaction_coeff=compaction_coeff,
            density_unit=payload.density_unit if payload.density is not None else None,
            porosity_surface_unit=payload.porosity_surface_unit if payload.porosity_surface is not None else None,
            compaction_coeff_unit=payload.compaction_coeff_unit if payload.compaction_coeff is not None else None,
        )

        row = CompactionPreset(
            name=name,
            origin='user',
            is_builtin=False,
            source_lithology_code=source.source_lithology_code if source is not None else None,
            description=payload.description if payload.description is not None else source.description if source is not None else None,
            density=density,
            porosity_surface=porosity_surface,
            compaction_coeff=compaction_coeff,
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        return _to_preset_detail(row)


@router.patch('/compaction-presets/{preset_id}', response_model=CompactionPresetDetail)
def patch_compaction_preset(
    preset_id: int,
    payload: CompactionPresetPatch,
    request: Request,
) -> CompactionPresetDetail:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        row = session.get(CompactionPreset, preset_id)
        if row is None:
            raise HTTPException(status_code=404, detail=f'Compaction preset not found: {preset_id}')
        if row.is_builtin:
            raise HTTPException(status_code=403, detail='Built-in compaction preset cannot be edited')

        _reject_unit_without_value(payload, 'density', 'density_unit')
        _reject_unit_without_value(payload, 'porosity_surface', 'porosity_surface_unit')
        _reject_unit_without_value(payload, 'compaction_coeff', 'compaction_coeff_unit')

        if payload.name is not None:
            next_name = payload.name.strip()
            if not next_name:
                raise HTTPException(status_code=400, detail='Compaction preset name is required')
            row.name = next_name
        if payload.description is not None:
            row.description = payload.description
        if payload.density is not None:
            row.density = _normalize_compaction_values(
                session,
                density=payload.density,
                porosity_surface=0.0,
                compaction_coeff=0.0,
                density_unit=payload.density_unit,
            )[0]
        if payload.porosity_surface is not None:
            row.porosity_surface = _normalize_compaction_values(
                session,
                density=0.0,
                porosity_surface=payload.porosity_surface,
                compaction_coeff=0.0,
                porosity_surface_unit=payload.porosity_surface_unit,
            )[1]
        if payload.compaction_coeff is not None:
            row.compaction_coeff = _normalize_compaction_values(
                session,
                density=0.0,
                porosity_surface=0.0,
                compaction_coeff=payload.compaction_coeff,
                compaction_coeff_unit=payload.compaction_coeff_unit,
            )[2]

        session.commit()
        session.refresh(row)
        return _to_preset_detail(row)


@router.delete('/compaction-presets/{preset_id}', status_code=204)
def delete_compaction_preset(preset_id: int, request: Request) -> None:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        row = session.get(CompactionPreset, preset_id)
        if row is None:
            raise HTTPException(status_code=404, detail=f'Compaction preset not found: {preset_id}')
        if row.is_builtin:
            raise HTTPException(status_code=403, detail='Built-in compaction preset cannot be deleted')
        session.delete(row)
        session.commit()


# ---------------------------------------------------------------------------
# Compaction model CRUD
# ---------------------------------------------------------------------------

@router.get('/curve-dictionary', response_model=list[CurveDictionaryItem])
def list_curve_dictionary(request: Request) -> list[CurveDictionaryItem]:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        rows = session.scalars(
            select(CurveDictEntry).order_by(
                CurveDictEntry.scope.asc(),
                CurveDictEntry.priority.desc(),
                CurveDictEntry.pattern.asc(),
            )
        ).all()
        return [_curve_dict_to_item(row) for row in rows]


@router.get('/mnemonic-sets', response_model=list[CurveMnemonicSetSummary])
def list_mnemonic_sets(request: Request) -> list[CurveMnemonicSetSummary]:
    manager = _require_open_project(request)
    _ensure_mnemonic_sets(manager)
    with manager.get_session() as session:
        rows = session.scalars(
            select(CurveMnemonicSet).order_by(
                CurveMnemonicSet.is_builtin.asc(),
                CurveMnemonicSet.sort_order.asc(),
                CurveMnemonicSet.id.asc(),
            )
        ).all()
        from sqlalchemy import func as sa_func
        entry_counts: dict[int, int] = dict(
            session.execute(
                select(CurveMnemonicEntry.set_id, sa_func.count(CurveMnemonicEntry.id))
                .group_by(CurveMnemonicEntry.set_id)
            ).all()
        )
        return [
            _mnemonic_set_summary_to_item(row, entry_counts.get(row.id, 0))
            for row in rows
        ]


@router.get('/mnemonic-entries', response_model=list[CurveMnemonicEntryItem])
def list_all_mnemonic_entries(request: Request) -> list[CurveMnemonicEntryItem]:
    manager = _require_open_project(request)
    _ensure_mnemonic_sets(manager)
    with manager.get_session() as session:
        rows = session.scalars(
            select(CurveMnemonicEntry)
            .where(CurveMnemonicEntry.is_active == True)  # noqa: E712
            .order_by(CurveMnemonicEntry.priority.desc(), CurveMnemonicEntry.pattern.asc())
        ).all()
        return [_mnemonic_entry_to_item(row) for row in rows]


@router.get('/mnemonic-sets/{set_id}', response_model=CurveMnemonicSetDetail)
def get_mnemonic_set(set_id: int, request: Request) -> CurveMnemonicSetDetail:
    manager = _require_open_project(request)
    _ensure_mnemonic_sets(manager)
    with manager.get_session() as session:
        row = _require_mnemonic_set(session, set_id)
        entries = session.scalars(
            select(CurveMnemonicEntry)
            .where(CurveMnemonicEntry.set_id == set_id)
            .order_by(CurveMnemonicEntry.priority.desc(), CurveMnemonicEntry.id.asc())
        ).all()
        return CurveMnemonicSetDetail(
            id=row.id,
            name=row.name,
            is_builtin=row.is_builtin,
            entry_count=len(entries),
            entries=[_mnemonic_entry_to_item(entry) for entry in entries],
        )


@router.post('/mnemonic-sets', response_model=CurveMnemonicSetSummary, status_code=201)
def create_mnemonic_set(payload: CurveMnemonicSetCreate, request: Request) -> CurveMnemonicSetSummary:
    manager = _require_open_project(request)
    _ensure_mnemonic_sets(manager)
    with manager.get_session() as session:
        row = CurveMnemonicSet(
            name=_normalize_mnemonic_set_name(payload.name),
            is_builtin=False,
            sort_order=_next_mnemonic_set_sort_order(session),
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        return _mnemonic_set_summary_to_item(row)


@router.post('/mnemonic-sets/{set_id}/copy', response_model=CurveMnemonicSetSummary, status_code=201)
def copy_mnemonic_set(set_id: int, request: Request) -> CurveMnemonicSetSummary:
    manager = _require_open_project(request)
    _ensure_mnemonic_sets(manager)
    with manager.get_session() as session:
        source = _require_mnemonic_set(session, set_id)
        copied = CurveMnemonicSet(
            name=f'{source.name} Copy',
            is_builtin=False,
            sort_order=_next_mnemonic_set_sort_order(session),
        )
        session.add(copied)
        session.flush()

        source_entries = session.scalars(
            select(CurveMnemonicEntry)
            .where(CurveMnemonicEntry.set_id == source.id)
            .order_by(CurveMnemonicEntry.priority.desc(), CurveMnemonicEntry.id.asc())
        ).all()
        for entry in source_entries:
            session.add(
                CurveMnemonicEntry(
                    set_id=copied.id,
                    pattern=entry.pattern,
                    is_regex=entry.is_regex,
                    priority=entry.priority,
                    family_code=entry.family_code,
                    canonical_mnemonic=entry.canonical_mnemonic,
                    canonical_unit=entry.canonical_unit,
                    is_active=entry.is_active,
                )
            )

        session.commit()
        session.refresh(copied)
        return _mnemonic_set_summary_to_item(copied, len(source_entries))


@router.patch('/mnemonic-sets/{set_id}', response_model=CurveMnemonicSetSummary)
def patch_mnemonic_set(set_id: int, payload: CurveMnemonicSetPatch, request: Request) -> CurveMnemonicSetSummary:
    manager = _require_open_project(request)
    _ensure_mnemonic_sets(manager)
    with manager.get_session() as session:
        row = _require_user_mnemonic_set(session, set_id)
        if payload.name is not None:
            row.name = _normalize_mnemonic_set_name(payload.name)
        session.commit()
        session.refresh(row)
        return _mnemonic_set_summary_to_item(row)


@router.delete('/mnemonic-sets/{set_id}', status_code=204)
def delete_mnemonic_set(set_id: int, request: Request) -> None:
    manager = _require_open_project(request)
    _ensure_mnemonic_sets(manager)
    with manager.get_session() as session:
        row = _require_user_mnemonic_set(session, set_id)
        session.delete(row)
        session.commit()


@router.post('/mnemonic-sets/{set_id}/entries', response_model=CurveMnemonicEntryItem, status_code=201)
def create_mnemonic_set_entry(
    set_id: int,
    payload: CurveMnemonicEntryCreate,
    request: Request,
) -> CurveMnemonicEntryItem:
    manager = _require_open_project(request)
    _ensure_mnemonic_sets(manager)
    with manager.get_session() as session:
        _require_user_mnemonic_set(session, set_id)
        pattern = _normalize_mnemonic_pattern(
            payload.pattern if payload.pattern is not None else _next_generated_mnemonic_pattern(session, set_id),
            payload.is_regex,
        )
        row = CurveMnemonicEntry(
            set_id=set_id,
            pattern=pattern,
            is_regex=payload.is_regex,
            priority=payload.priority,
            family_code=_normalize_optional_string(payload.family_code),
            canonical_mnemonic=_normalize_optional_string(payload.canonical_mnemonic),
            canonical_unit=_normalize_optional_string(payload.canonical_unit),
            is_active=payload.is_active,
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        return _mnemonic_entry_to_item(row)


@router.patch('/mnemonic-sets/{set_id}/entries/{entry_id}', response_model=CurveMnemonicEntryItem)
def patch_mnemonic_set_entry(
    set_id: int,
    entry_id: int,
    payload: CurveMnemonicEntryPatch,
    request: Request,
) -> CurveMnemonicEntryItem:
    manager = _require_open_project(request)
    _ensure_mnemonic_sets(manager)
    with manager.get_session() as session:
        _require_user_mnemonic_set(session, set_id)
        row = _require_mnemonic_entry(session, set_id, entry_id)

        next_pattern = payload.pattern if 'pattern' in payload.model_fields_set else row.pattern
        next_is_regex = payload.is_regex if payload.is_regex is not None else row.is_regex
        if 'pattern' in payload.model_fields_set or payload.is_regex is not None:
            row.pattern = _normalize_mnemonic_pattern(next_pattern, next_is_regex)
            row.is_regex = next_is_regex
        if payload.priority is not None:
            row.priority = payload.priority
        if 'family_code' in payload.model_fields_set:
            row.family_code = _normalize_optional_string(payload.family_code)
        if 'canonical_mnemonic' in payload.model_fields_set:
            row.canonical_mnemonic = _normalize_optional_string(payload.canonical_mnemonic)
        if 'canonical_unit' in payload.model_fields_set:
            row.canonical_unit = _normalize_optional_string(payload.canonical_unit)
        if payload.is_active is not None:
            row.is_active = payload.is_active

        session.commit()
        session.refresh(row)
        return _mnemonic_entry_to_item(row)


@router.delete('/mnemonic-sets/{set_id}/entries/{entry_id}', status_code=204)
def delete_mnemonic_set_entry(set_id: int, entry_id: int, request: Request) -> None:
    manager = _require_open_project(request)
    _ensure_mnemonic_sets(manager)
    with manager.get_session() as session:
        _require_user_mnemonic_set(session, set_id)
        row = _require_mnemonic_entry(session, set_id, entry_id)
        session.delete(row)
        session.commit()


@router.get('/lithology-dictionary', response_model=list[LithologyDictionaryItem])
def list_lithology_dictionary(request: Request) -> list[LithologyDictionaryItem]:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        rows = session.scalars(
            select(LithologyDictEntry).order_by(LithologyDictEntry.sort_order.asc(), LithologyDictEntry.id.asc())
        ).all()
        return [_lithology_dict_to_item(row) for row in rows]


@router.get('/lithology-sets', response_model=list[LithologySetSummary])
def list_lithology_sets(request: Request) -> list[LithologySetSummary]:
    manager = _require_open_project(request)
    _ensure_lithology_sets(manager)
    with manager.get_session() as session:
        rows = session.scalars(
            select(LithologySet).order_by(
                LithologySet.is_builtin.desc(),
                LithologySet.name.asc(),
                LithologySet.id.asc(),
            )
        ).all()
        return [_lithology_set_summary_to_item(row) for row in rows]


@router.get('/lithology-sets/{set_id}', response_model=LithologySetDetail)
def get_lithology_set(set_id: int, request: Request) -> LithologySetDetail:
    manager = _require_open_project(request)
    _ensure_lithology_sets(manager)
    with manager.get_session() as session:
        row = _require_lithology_set(session, set_id)
        entries = sorted(row.entries, key=lambda item: (item.sort_order, item.id))
        return LithologySetDetail(
            id=row.id,
            name=row.name,
            is_builtin=row.is_builtin,
            entry_count=len(entries),
            entries=[_lithology_set_entry_to_item(entry) for entry in entries],
        )


@router.post('/lithology-sets', response_model=LithologySetSummary, status_code=201)
def create_lithology_set(payload: LithologySetCreate, request: Request) -> LithologySetSummary:
    manager = _require_open_project(request)
    _ensure_lithology_sets(manager)
    with manager.get_session() as session:
        row = LithologySet(name=_normalize_lithology_set_name(payload.name), is_builtin=False)
        session.add(row)
        session.commit()
        session.refresh(row)
        return _lithology_set_summary_to_item(row)


@router.post('/lithology-sets/{set_id}/copy', response_model=LithologySetSummary, status_code=201)
def copy_lithology_set(set_id: int, request: Request) -> LithologySetSummary:
    manager = _require_open_project(request)
    _ensure_lithology_sets(manager)
    with manager.get_session() as session:
        source = _require_lithology_set(session, set_id)
        copied = LithologySet(name=f'{source.name} Copy', is_builtin=False)
        session.add(copied)
        session.flush()

        source_entries = session.scalars(
            select(LithologySetEntry)
            .where(LithologySetEntry.set_id == source.id)
            .order_by(LithologySetEntry.sort_order.asc(), LithologySetEntry.id.asc())
        ).all()
        for entry in source_entries:
            session.add(
                LithologySetEntry(
                    set_id=copied.id,
                    lithology_code=entry.lithology_code,
                    display_name=entry.display_name,
                    color_hex=entry.color_hex,
                    pattern_id=entry.pattern_id,
                    sort_order=entry.sort_order,
                    compaction_preset_id=entry.compaction_preset_id,
                )
            )

        session.commit()
        session.refresh(copied)
        return _lithology_set_summary_to_item(copied)


@router.patch('/lithology-sets/{set_id}', response_model=LithologySetSummary)
def patch_lithology_set(set_id: int, payload: LithologySetPatch, request: Request) -> LithologySetSummary:
    manager = _require_open_project(request)
    _ensure_lithology_sets(manager)
    with manager.get_session() as session:
        row = _require_user_lithology_set(session, set_id)
        if payload.name is not None:
            row.name = _normalize_lithology_set_name(payload.name)
        session.commit()
        session.refresh(row)
        return _lithology_set_summary_to_item(row)


@router.delete('/lithology-sets/{set_id}', status_code=204)
def delete_lithology_set(set_id: int, request: Request) -> None:
    manager = _require_open_project(request)
    _ensure_lithology_sets(manager)
    with manager.get_session() as session:
        row = _require_user_lithology_set(session, set_id)
        session.delete(row)
        session.commit()


@router.post('/lithology-sets/{set_id}/entries', response_model=LithologySetEntryItem, status_code=201)
def create_lithology_set_entry(set_id: int, payload: LithologySetEntryCreate, request: Request) -> LithologySetEntryItem:
    manager = _require_open_project(request)
    _ensure_lithology_sets(manager)
    with manager.get_session() as session:
        lithology_set = _require_user_lithology_set(session, set_id)
        code = _normalize_entry_code(payload.lithology_code) if payload.lithology_code is not None else _next_generated_lithology_code(session, set_id)
        _ensure_unique_lithology_code(session, set_id, code)
        display_name = _normalize_entry_name(payload.display_name) if payload.display_name is not None else code
        sort_order = (max((entry.sort_order for entry in lithology_set.entries), default=-1) + 1)

        row = LithologySetEntry(
            set_id=set_id,
            lithology_code=code,
            display_name=display_name,
            color_hex=(payload.color_hex or '#9ca3af').strip() or '#9ca3af',
            pattern_id=(payload.pattern_id or '').strip() or None,
            sort_order=sort_order,
            compaction_preset_id=_resolve_compaction_preset_id(session, payload.compaction_preset_id),
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        return _lithology_set_entry_to_item(row)


@router.patch('/lithology-sets/{set_id}/entries/{entry_id}', response_model=LithologySetEntryItem)
def patch_lithology_set_entry(
    set_id: int,
    entry_id: int,
    payload: LithologySetEntryPatch,
    request: Request,
) -> LithologySetEntryItem:
    manager = _require_open_project(request)
    _ensure_lithology_sets(manager)
    with manager.get_session() as session:
        _require_user_lithology_set(session, set_id)
        row = session.get(LithologySetEntry, entry_id)
        if row is None or row.set_id != set_id:
            raise HTTPException(status_code=404, detail=f'Lithology entry not found: {entry_id}')

        if payload.lithology_code is not None:
            next_code = _normalize_entry_code(payload.lithology_code)
            _ensure_unique_lithology_code(session, set_id, next_code, exclude_entry_id=row.id)
            row.lithology_code = next_code
        if payload.display_name is not None:
            row.display_name = _normalize_entry_name(payload.display_name)
        if payload.color_hex is not None:
            next_color = payload.color_hex.strip() or '#9ca3af'
            row.color_hex = next_color
        if payload.pattern_id is not None:
            row.pattern_id = payload.pattern_id.strip() or None
        if 'compaction_preset_id' in payload.model_fields_set:
            row.compaction_preset_id = _resolve_compaction_preset_id(session, payload.compaction_preset_id)

        session.commit()
        session.refresh(row)
        return _lithology_set_entry_to_item(row)


@router.delete('/lithology-sets/{set_id}/entries/{entry_id}', status_code=204)
def delete_lithology_set_entry(set_id: int, entry_id: int, request: Request) -> None:
    manager = _require_open_project(request)
    _ensure_lithology_sets(manager)
    with manager.get_session() as session:
        _require_user_lithology_set(session, set_id)
        row = session.get(LithologySetEntry, entry_id)
        if row is None or row.set_id != set_id:
            raise HTTPException(status_code=404, detail=f'Lithology entry not found: {entry_id}')
        session.delete(row)
        session.commit()


# ---------------------------------------------------------------------------
# Compaction model CRUD
# ---------------------------------------------------------------------------

@router.get('/compaction-models', response_model=list[CompactionModelResponse])
def list_compaction_models(request: Request) -> list[CompactionModelResponse]:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        rows = session.scalars(
            select(CompactionModel).order_by(CompactionModel.id.asc())
        ).all()
        return [_to_model_response(r) for r in rows]


@router.post('/compaction-models', response_model=CompactionModelResponse, status_code=201)
def create_compaction_model(payload: CompactionModelCreate, request: Request) -> CompactionModelResponse:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        existing = session.scalar(
            select(CompactionModel).where(CompactionModel.name == payload.name)
        )
        if existing is not None:
            raise HTTPException(status_code=409, detail=f'Model name already exists: {payload.name!r}')

        model = CompactionModel(name=payload.name, is_builtin=False, is_active=False)
        session.add(model)
        session.flush()

        if payload.clone_from_id is not None:
            source_model = session.get(CompactionModel, payload.clone_from_id)
            if source_model is None:
                raise HTTPException(status_code=404, detail=f'Compaction model not found: {payload.clone_from_id}')
            source_params = session.scalars(
                select(CompactionModelParam)
                .where(CompactionModelParam.model_id == payload.clone_from_id)
            ).all()
        else:
            # clone from the built-in model by default
            builtin = session.scalar(
                select(CompactionModel).where(CompactionModel.is_builtin.is_(True))
            )
            source_params = session.scalars(
                select(CompactionModelParam)
                .where(CompactionModelParam.model_id == builtin.id)
            ).all() if builtin else []

        for sp in source_params:
            session.add(CompactionModelParam(
                model_id=model.id,
                lithology_code=sp.lithology_code,
                density=sp.density,
                porosity_surface=sp.porosity_surface,
                compaction_coeff=sp.compaction_coeff,
            ))

        session.commit()
        session.refresh(model)
        return _to_model_response(model)


@router.patch('/compaction-models/{model_id}', response_model=CompactionModelResponse)
def patch_compaction_model(
    model_id: int,
    payload: CompactionModelPatch,
    request: Request,
) -> CompactionModelResponse:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        model = session.get(CompactionModel, model_id)
        if model is None:
            raise HTTPException(status_code=404, detail=f'Compaction model not found: {model_id}')

        if payload.name is not None:
            if model.is_builtin:
                raise HTTPException(status_code=403, detail='Built-in model cannot be renamed')
            model.name = payload.name

        if payload.is_active is True:
            # deactivate all others, activate this one
            all_models = session.scalars(select(CompactionModel)).all()
            for m in all_models:
                m.is_active = (m.id == model_id)
        elif payload.is_active is False and model.is_active:
            raise HTTPException(status_code=400, detail='Cannot deactivate without activating another model')

        session.commit()
        session.refresh(model)
        return _to_model_response(model)


@router.delete('/compaction-models/{model_id}', status_code=204)
def delete_compaction_model(model_id: int, request: Request) -> None:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        model = session.get(CompactionModel, model_id)
        if model is None:
            raise HTTPException(status_code=404, detail=f'Compaction model not found: {model_id}')
        if model.is_builtin:
            raise HTTPException(status_code=403, detail='Built-in model cannot be deleted')
        if model.is_active:
            raise HTTPException(status_code=400, detail='Cannot delete the active model; activate another first')
        session.delete(model)
        session.commit()


# ---------------------------------------------------------------------------
# Per-model param CRUD
# ---------------------------------------------------------------------------

@router.get('/compaction-models/{model_id}/params', response_model=list[LithologyParamItem])
def get_model_params(model_id: int, request: Request) -> list[LithologyParamItem]:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        if session.get(CompactionModel, model_id) is None:
            raise HTTPException(status_code=404, detail=f'Compaction model not found: {model_id}')

        litho_map = {
            r.lithology_code: r
            for r in session.scalars(select(LithologyDictEntry)).all()
        }
        params = session.scalars(
            select(CompactionModelParam)
            .where(CompactionModelParam.model_id == model_id)
            .order_by(CompactionModelParam.lithology_code.asc())
        ).all()
        return [
            _param_to_item(p, litho_map[p.lithology_code])
            for p in params
            if p.lithology_code in litho_map
        ]


@router.patch(
    '/compaction-models/{model_id}/params/{lithology_code}',
    response_model=LithologyParamItem,
)
def patch_model_param(
    model_id: int,
    lithology_code: str,
    payload: LithologyParamPatch,
    request: Request,
) -> LithologyParamItem:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        model = session.get(CompactionModel, model_id)
        if model is None:
            raise HTTPException(status_code=404, detail=f'Compaction model not found: {model_id}')
        if model.is_builtin:
            raise HTTPException(status_code=403, detail='Built-in model parameters cannot be edited')

        param = session.scalar(
            select(CompactionModelParam).where(
                CompactionModelParam.model_id == model_id,
                CompactionModelParam.lithology_code == lithology_code,
            )
        )
        if param is None:
            raise HTTPException(status_code=404, detail=f'Param not found: {lithology_code!r}')

        _reject_unit_without_value(payload, 'density', 'density_unit')
        _reject_unit_without_value(payload, 'porosity_surface', 'porosity_surface_unit')
        _reject_unit_without_value(payload, 'compaction_coeff', 'compaction_coeff_unit')

        if payload.density is not None:
            param.density = _normalize_compaction_values(
                session,
                density=payload.density,
                porosity_surface=0.0,
                compaction_coeff=0.0,
                density_unit=payload.density_unit,
            )[0]
        if payload.porosity_surface is not None:
            param.porosity_surface = _normalize_compaction_values(
                session,
                density=0.0,
                porosity_surface=payload.porosity_surface,
                compaction_coeff=0.0,
                porosity_surface_unit=payload.porosity_surface_unit,
            )[1]
        if payload.compaction_coeff is not None:
            param.compaction_coeff = _normalize_compaction_values(
                session,
                density=0.0,
                porosity_surface=0.0,
                compaction_coeff=payload.compaction_coeff,
                compaction_coeff_unit=payload.compaction_coeff_unit,
            )[2]

        session.flush()
        litho = session.scalar(
            select(LithologyDictEntry).where(LithologyDictEntry.lithology_code == lithology_code)
        )
        if litho is None:
            raise HTTPException(status_code=404, detail=f'Unknown lithology: {lithology_code!r}')
        item = _param_to_item(param, litho)
        session.commit()
        return item
