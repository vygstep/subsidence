from __future__ import annotations

import fnmatch
import re
import sqlite3
from dataclasses import dataclass
from pathlib import Path


_SCOPE_RANK = {"user": 3, "project": 2, "base": 1}


@dataclass(frozen=True)
class CurveAliasRule:
    source_scope: str
    pattern: str
    is_regex: bool
    priority: int
    family_code: str | None
    canonical_mnemonic: str | None
    canonical_unit: str | None


@dataclass(frozen=True)
class CurveMatchResult:
    family_code: str | None
    canonical_mnemonic: str | None
    canonical_unit: str | None
    matched: bool


def load_curve_alias_rules(db_path: str | Path) -> list[CurveAliasRule]:
    path = Path(db_path)
    if not path.exists():
        return []

    query = """
        SELECT
            COALESCE(a.source_scope, 'base') AS source_scope,
            a.pattern,
            COALESCE(a.is_regex, 0) AS is_regex,
            COALESCE(a.priority, 0) AS priority,
            f.family_code,
            COALESCE(a.canonical_mnemonic_override, f.canonical_mnemonic) AS canonical_mnemonic,
            COALESCE(a.canonical_unit_override, f.canonical_unit) AS canonical_unit
        FROM dict_curve_alias a
        LEFT JOIN dict_curve_family f ON f.family_id = a.family_id
        WHERE COALESCE(a.is_active, 1) = 1
          AND (f.family_id IS NULL OR COALESCE(f.is_active, 1) = 1)
    """

    try:
        with sqlite3.connect(path) as conn:
            rows = conn.execute(query).fetchall()
    except sqlite3.OperationalError:
        return []

    rules = [
        CurveAliasRule(
            source_scope=str(row[0]).lower(),
            pattern=str(row[1]),
            is_regex=bool(row[2]),
            priority=int(row[3]),
            family_code=row[4],
            canonical_mnemonic=row[5],
            canonical_unit=row[6],
        )
        for row in rows
    ]

    return sorted(
        rules,
        key=lambda r: (
            _SCOPE_RANK.get(r.source_scope, 0),
            r.priority,
            len(r.pattern),
        ),
        reverse=True,
    )


def resolve_curve_alias(
    mnemonic: str,
    rules: list[CurveAliasRule],
) -> CurveMatchResult:
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
