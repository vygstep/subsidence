from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .schema import FormationTopModel, StratUnit

_AUTO_LINK_FALLBACK_COLORS = {'', '#4b5563', '#808080', '#9ca3af', '#90a4ae'}


def normalize_strat_name(value: str | None) -> str:
    return (value or '').strip().casefold()


def find_strat_unit_by_name(session: Session, name: str | None) -> StratUnit | None:
    normalized_name = normalize_strat_name(name)
    if not normalized_name:
        return None
    return session.scalar(
        select(StratUnit)
        .where(func.lower(StratUnit.name) == normalized_name)
        .order_by(StratUnit.id.asc())
    )


def auto_link_formation_to_strat_unit(session: Session, formation: FormationTopModel) -> bool:
    if formation.strat_unit_id is not None:
        return False

    strat_unit = find_strat_unit_by_name(session, formation.name)
    if strat_unit is None:
        return False

    formation.strat_unit_id = strat_unit.id
    current_color = (formation.color or '').strip().lower()
    if current_color in _AUTO_LINK_FALLBACK_COLORS and strat_unit.color_hex:
        formation.color = strat_unit.color_hex
    return True
