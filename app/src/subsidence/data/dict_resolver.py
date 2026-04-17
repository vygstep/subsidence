from __future__ import annotations

import fnmatch
import re
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from .schema import CurveDictEntry, LithologyDictEntry

_SCOPE_RANK = {'user': 3, 'project': 2, 'base': 1}


@dataclass(frozen=True)
class CurveMatchResult:
    family_code: str | None
    canonical_mnemonic: str | None
    canonical_unit: str | None
    matched: bool


def load_curve_alias_rules(session: Session) -> list[CurveDictEntry]:
    rows = session.scalars(select(CurveDictEntry).where(CurveDictEntry.is_active.is_(True))).all()
    return sorted(
        rows,
        key=lambda rule: (
            _SCOPE_RANK.get(rule.scope, 0),
            rule.priority,
            len(rule.pattern),
        ),
        reverse=True,
    )


def resolve_curve_alias(mnemonic: str, rules: list[CurveDictEntry]) -> CurveMatchResult:
    name = mnemonic.upper()
    for rule in rules:
        pattern = rule.pattern.upper()
        matched = bool(re.match(pattern, name)) if rule.is_regex else fnmatch.fnmatch(name, pattern)
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


def load_lithology_entries(session: Session) -> dict[str, LithologyDictEntry]:
    rows = session.scalars(select(LithologyDictEntry).order_by(LithologyDictEntry.sort_order)).all()
    return {row.lithology_code: row for row in rows}
