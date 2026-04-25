from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from .schema import MeasurementUnit, MeasurementUnitAlias, UnitDimension


_NORMALIZE_REPLACEMENTS = {
    " ": "",
    "\t": "",
    "^": "",
    "\u00b5": "u",
    "\u03bc": "u",
    "\u00b3": "3",
    "\u00b2": "2",
    "\u207b": "-",
    "\u00b9": "1",
}


@dataclass(frozen=True)
class ResolvedUnit:
    code: str
    dimension_code: str
    symbol: str
    display_name: str
    engine_unit_code: str
    to_engine_factor: float
    to_engine_offset: float


_CURVE_FAMILY_DIMENSIONS = {
    "bulk_density": "density",
    "caliper": "caliper",
    "density_correction": "density",
    "gamma_ray": "gamma_ray",
    "neutron_porosity": "fraction",
    "resistivity_deep": "resistivity",
    "resistivity_medium": "resistivity",
    "sonic_p": "slowness",
    "sonic_s": "slowness",
}


def normalize_unit_key(unit: str) -> str:
    key = unit.strip().lower()
    for source, target in _NORMALIZE_REPLACEMENTS.items():
        key = key.replace(source, target)
    return key


def resolve_unit(session: Session, unit: str | None, dimension_code: str | None = None) -> ResolvedUnit | None:
    raw = (unit or "").strip()
    if not raw:
        return None

    stmt = (
        select(MeasurementUnit, UnitDimension)
        .join(MeasurementUnitAlias, MeasurementUnitAlias.unit_code == MeasurementUnit.code)
        .join(UnitDimension, UnitDimension.code == MeasurementUnit.dimension_code)
        .where(
            MeasurementUnitAlias.normalized_alias == normalize_unit_key(raw),
            MeasurementUnitAlias.is_active.is_(True),
            MeasurementUnit.is_active.is_(True),
        )
        .order_by(MeasurementUnit.sort_order.asc(), MeasurementUnit.id.asc())
    )
    if dimension_code:
        stmt = stmt.where(MeasurementUnit.dimension_code == dimension_code)

    rows = session.execute(stmt).all()
    if not rows:
        return None

    unit_codes = {row[0].code for row in rows}
    if len(unit_codes) > 1:
        return None

    unit_row, dimension = rows[0]
    return ResolvedUnit(
        code=unit_row.code,
        dimension_code=unit_row.dimension_code,
        symbol=unit_row.symbol,
        display_name=unit_row.display_name,
        engine_unit_code=dimension.engine_unit_code,
        to_engine_factor=unit_row.to_engine_factor,
        to_engine_offset=unit_row.to_engine_offset,
    )


def get_engine_unit(session: Session, dimension_code: str) -> ResolvedUnit | None:
    row = session.execute(
        select(MeasurementUnit, UnitDimension)
        .join(UnitDimension, UnitDimension.code == MeasurementUnit.dimension_code)
        .where(
            UnitDimension.code == dimension_code,
            MeasurementUnit.code == UnitDimension.engine_unit_code,
            MeasurementUnit.is_active.is_(True),
        )
    ).one_or_none()
    if row is None:
        return None

    unit_row, dimension = row
    return ResolvedUnit(
        code=unit_row.code,
        dimension_code=unit_row.dimension_code,
        symbol=unit_row.symbol,
        display_name=unit_row.display_name,
        engine_unit_code=dimension.engine_unit_code,
        to_engine_factor=unit_row.to_engine_factor,
        to_engine_offset=unit_row.to_engine_offset,
    )


def convert_scalar_to_engine(value: float, unit: ResolvedUnit) -> float:
    return value * unit.to_engine_factor + unit.to_engine_offset


def convert_values_to_engine(values: list[float], unit: ResolvedUnit) -> list[float]:
    return [convert_scalar_to_engine(value, unit) for value in values]


def convert_scalar_value_to_engine(
    session: Session,
    value: float,
    dimension_code: str,
    unit: str,
) -> float:
    resolved = resolve_unit(session, unit, dimension_code)
    if resolved is None:
        raise ValueError(f"Unsupported unit for dimension {dimension_code!r}: {unit!r}")
    return convert_scalar_to_engine(value, resolved)


def convert_scalar(value: float, from_unit: ResolvedUnit, to_unit: ResolvedUnit) -> float:
    if from_unit.dimension_code != to_unit.dimension_code:
        raise ValueError(
            f"Cannot convert between dimensions: {from_unit.dimension_code!r} -> {to_unit.dimension_code!r}"
        )
    engine_value = convert_scalar_to_engine(value, from_unit)
    return (engine_value - to_unit.to_engine_offset) / to_unit.to_engine_factor


def convert_values(values: list[float], from_unit: ResolvedUnit, to_unit: ResolvedUnit) -> list[float]:
    return [convert_scalar(value, from_unit, to_unit) for value in values]


def curve_family_dimension(family_code: str | None) -> str | None:
    family = (family_code or "").strip().lower()
    if not family:
        return None
    if "resistivity" in family:
        return "resistivity"
    if "density" in family:
        return "density"
    if "porosity" in family:
        return "fraction"
    if "sonic" in family or "slowness" in family:
        return "slowness"
    return _CURVE_FAMILY_DIMENSIONS.get(family)


def convert_depth_values_to_meters(session: Session, values: list[float], unit: str | None) -> list[float]:
    from_unit = resolve_unit(session, unit or "m", "depth")
    to_unit = resolve_unit(session, "m", "depth")
    if from_unit is None or to_unit is None:
        raise ValueError(f"Unsupported depth unit: {unit!r}")
    return convert_values(values, from_unit, to_unit)


def convert_curve_values_to_target(
    session: Session,
    values: list[float],
    from_unit: str,
    to_unit: str,
    family_code: str | None = None,
) -> tuple[list[float], str]:
    if not from_unit or not to_unit:
        return values, to_unit

    dimension_code = curve_family_dimension(family_code)
    if dimension_code is None:
        raise ValueError(f"Unsupported unit conversion family: {family_code!r}")

    source = resolve_unit(session, from_unit, dimension_code)
    target = resolve_unit(session, to_unit, dimension_code)
    if source is None or target is None:
        raise ValueError(
            f"Unsupported unit conversion for family {family_code!r}: {from_unit!r} -> {to_unit!r}"
        )
    return convert_values(values, source, target), target.symbol


def normalize_lithology_values_to_engine(
    session: Session,
    *,
    density: float,
    porosity_surface: float,
    compaction_coeff: float,
    density_unit: str = "kg/m3",
    porosity_surface_unit: str = "v/v",
    compaction_coeff_unit: str = "km^-1",
) -> tuple[float, float, float]:
    return (
        convert_scalar_value_to_engine(session, density, "density", density_unit),
        convert_scalar_value_to_engine(session, porosity_surface, "fraction", porosity_surface_unit),
        convert_scalar_value_to_engine(session, compaction_coeff, "compaction_coeff", compaction_coeff_unit),
    )
