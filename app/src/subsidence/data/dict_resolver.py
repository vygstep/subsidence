from __future__ import annotations

import fnmatch
import re
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from .unit_registry import get_engine_unit, resolve_unit
from .schema import CurveMnemonicEntry, CurveMnemonicSet, LithologyDictEntry


_UNIT_FALLBACK_FAMILIES = {
    'caliper': 'caliper',
    'density': 'bulk_density',
    'gamma_ray': 'gamma_ray',
}


@dataclass(frozen=True)
class CurveMatchResult:
    family_code: str | None
    canonical_mnemonic: str | None
    canonical_unit: str | None
    matched: bool


@dataclass(frozen=True)
class CurveAliasRule:
    id: int
    scope: str
    pattern: str
    is_regex: bool
    priority: int
    family_code: str | None
    canonical_mnemonic: str | None
    canonical_unit: str | None
    is_active: bool
    set_id: int
    set_name: str
    set_sort_order: int
    is_builtin_set: bool


def load_curve_alias_rules(session: Session) -> list[CurveAliasRule]:
    rows = session.execute(
        select(CurveMnemonicEntry, CurveMnemonicSet)
        .join(CurveMnemonicSet, CurveMnemonicEntry.set_id == CurveMnemonicSet.id)
        .where(CurveMnemonicEntry.is_active.is_(True))
        .order_by(
            CurveMnemonicSet.is_builtin.asc(),
            CurveMnemonicSet.sort_order.asc(),
            CurveMnemonicSet.id.asc(),
            CurveMnemonicEntry.priority.desc(),
            CurveMnemonicEntry.id.asc(),
        )
    ).all()
    rules = [
        CurveAliasRule(
            id=entry.id,
            scope='base' if mnemonic_set.is_builtin else 'project',
            pattern=entry.pattern,
            is_regex=entry.is_regex,
            priority=entry.priority,
            family_code=entry.family_code,
            canonical_mnemonic=entry.canonical_mnemonic,
            canonical_unit=entry.canonical_unit,
            is_active=entry.is_active,
            set_id=mnemonic_set.id,
            set_name=mnemonic_set.name,
            set_sort_order=mnemonic_set.sort_order,
            is_builtin_set=mnemonic_set.is_builtin,
        )
        for entry, mnemonic_set in rows
    ]
    return sorted(
        rules,
        key=lambda rule: (
            rule.is_builtin_set,
            rule.set_sort_order,
            rule.set_id,
            -rule.priority,
            -len(rule.pattern),
            rule.id,
        ),
    )


def resolve_curve_alias(mnemonic: str, rules: list[CurveAliasRule]) -> CurveMatchResult:
    name = mnemonic.upper()
    for rule in rules:
        pattern = rule.pattern.upper()
        try:
            matched = bool(re.match(pattern, name)) if rule.is_regex else fnmatch.fnmatch(name, pattern)
        except re.error:
            continue
        if matched:
            return CurveMatchResult(
                family_code=rule.family_code,
                canonical_mnemonic=rule.canonical_mnemonic,
                canonical_unit=rule.canonical_unit,
                matched=True,
            )

    return CurveMatchResult(
        family_code=None,
        canonical_mnemonic=None,
        canonical_unit=None,
        matched=False,
    )


def resolve_curve_alias_with_unit(
    session: Session,
    mnemonic: str,
    unit: str | None,
    rules: list[CurveAliasRule],
) -> CurveMatchResult:
    match = resolve_curve_alias(mnemonic, rules)
    if match.matched:
        return match

    resolved_unit = resolve_unit(session, unit)
    if resolved_unit is None:
        return match

    family_code = _UNIT_FALLBACK_FAMILIES.get(resolved_unit.dimension_code)
    if family_code is None:
        return match

    engine_unit = get_engine_unit(session, resolved_unit.dimension_code)
    if engine_unit is None:
        return match

    return CurveMatchResult(
        family_code=family_code,
        canonical_mnemonic=None,
        canonical_unit=engine_unit.symbol,
        matched=True,
    )


def load_lithology_entries(session: Session) -> dict[str, LithologyDictEntry]:
    rows = session.scalars(select(LithologyDictEntry).order_by(LithologyDictEntry.sort_order)).all()
    return {row.lithology_code: row for row in rows}
