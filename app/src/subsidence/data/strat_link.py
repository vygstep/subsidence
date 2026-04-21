from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .schema import FormationStratLink, FormationTopModel, StratChart, StratUnit

_FALLBACK_COLORS = {'', '#4b5563', '#808080', '#9ca3af', '#90a4ae'}


def normalize_strat_name(value: str | None) -> str:
    return (value or '').strip().casefold()


def find_strat_unit_by_name(session: Session, name: str | None, chart_id: int | None = None) -> StratUnit | None:
    normalized = normalize_strat_name(name)
    if not normalized:
        return None
    stmt = (
        select(StratUnit)
        .where(func.lower(StratUnit.name) == normalized)
        .order_by(StratUnit.id.asc())
    )
    if chart_id is not None:
        stmt = stmt.where(StratUnit.chart_id == chart_id)
    return session.scalar(stmt)


def find_strat_unit_by_age(session: Session, age_ma: float | None, chart_id: int) -> StratUnit | None:
    if age_ma is None:
        return None
    return session.scalar(
        select(StratUnit)
        .where(
            StratUnit.chart_id == chart_id,
            StratUnit.age_top_ma <= age_ma,
            StratUnit.age_base_ma >= age_ma,
        )
        .order_by((StratUnit.age_base_ma - StratUnit.age_top_ma).asc())
        .limit(1)
    )


def _link_exists(session: Session, formation_id: int, chart_id: int) -> bool:
    return session.scalar(
        select(FormationStratLink.id).where(
            FormationStratLink.formation_id == formation_id,
            FormationStratLink.chart_id == chart_id,
        )
    ) is not None


def auto_link_formation_to_chart(session: Session, formation: FormationTopModel, chart: StratChart) -> bool:
    if formation.id is None:
        session.flush()
    if _link_exists(session, formation.id, chart.id):
        return False

    unit = find_strat_unit_by_name(session, formation.name, chart.id)
    if unit is None and formation.age_top_ma is not None:
        unit = find_strat_unit_by_age(session, formation.age_top_ma, chart.id)
    if unit is None:
        return False

    session.add(FormationStratLink(
        formation_id=formation.id,
        strat_unit_id=unit.id,
        chart_id=chart.id,
    ))
    current_color = (formation.color or '').strip().lower()
    if current_color in _FALLBACK_COLORS and unit.color_hex:
        formation.color = unit.color_hex
    if formation.age_top_ma is None and unit.age_top_ma is not None:
        formation.age_top_ma = unit.age_top_ma
    return True


def auto_link_all_formations_to_chart(session: Session, chart: StratChart) -> int:
    formations = session.scalars(select(FormationTopModel)).all()
    count = 0
    for formation in formations:
        if auto_link_formation_to_chart(session, formation, chart):
            count += 1
    session.flush()
    return count


def auto_link_to_active_chart(session: Session, formation: FormationTopModel) -> bool:
    chart = session.scalar(select(StratChart).where(StratChart.is_active.is_(True)))
    if chart is None:
        return False
    return auto_link_formation_to_chart(session, formation, chart)
