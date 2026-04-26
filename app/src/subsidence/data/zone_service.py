from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from .backstrip import DEFAULT_LITHO_PARAM, LithologyParam, ZoneLayerInput
from .schema import (
    FormationTopModel,
    FormationZone,
    TopSetHorizon,
    WellActiveTopSet,
    WellModel,
    ZoneWellData,
)


def rebuild_zones_for_top_set(session: Session, top_set_id: int) -> None:
    horizons = session.scalars(
        select(TopSetHorizon)
        .where(TopSetHorizon.top_set_id == top_set_id)
        .order_by(TopSetHorizon.sort_order.asc())
    ).all()

    expected_pairs = [
        (horizons[i].id, horizons[i + 1].id, horizons[i].sort_order)
        for i in range(len(horizons) - 1)
    ]
    expected_set = {(upper, lower) for upper, lower, _ in expected_pairs}

    existing_zones = session.scalars(
        select(FormationZone).where(FormationZone.top_set_id == top_set_id)
    ).all()
    existing_by_pair: dict[tuple[int, int], FormationZone] = {
        (z.upper_horizon_id, z.lower_horizon_id): z for z in existing_zones
    }

    # Delete zones that no longer correspond to an adjacent pair
    for pair, zone in list(existing_by_pair.items()):
        if pair not in expected_set:
            session.delete(zone)
            del existing_by_pair[pair]

    session.flush()

    # Create or update zones for each expected pair
    for upper_id, lower_id, sort_order in expected_pairs:
        pair = (upper_id, lower_id)
        if pair in existing_by_pair:
            existing_by_pair[pair].sort_order = sort_order
        else:
            zone = FormationZone(
                top_set_id=top_set_id,
                upper_horizon_id=upper_id,
                lower_horizon_id=lower_id,
                sort_order=sort_order,
            )
            session.add(zone)

    session.flush()


def ensure_zone_well_data(session: Session, top_set_id: int, well_id: str) -> None:
    zones = session.scalars(
        select(FormationZone).where(FormationZone.top_set_id == top_set_id)
    ).all()

    existing_zone_ids = {
        row.zone_id
        for row in session.scalars(
            select(ZoneWellData).where(
                ZoneWellData.zone_id.in_([z.id for z in zones]),
                ZoneWellData.well_id == well_id,
            )
        ).all()
    }

    for zone in zones:
        if zone.id not in existing_zone_ids:
            session.add(ZoneWellData(zone_id=zone.id, well_id=well_id))

    session.flush()


def recalculate_zone_thickness(session: Session, top_set_id: int, well_id: str) -> None:
    zones = session.scalars(
        select(FormationZone).where(FormationZone.top_set_id == top_set_id)
    ).all()
    if not zones:
        return

    horizon_ids = {z.upper_horizon_id for z in zones} | {z.lower_horizon_id for z in zones}
    picks_by_horizon: dict[int, FormationTopModel] = {}
    for pick in session.scalars(
        select(FormationTopModel).where(
            FormationTopModel.well_id == well_id,
            FormationTopModel.horizon_id.in_(horizon_ids),
        )
    ).all():
        if pick.horizon_id is not None:
            picks_by_horizon[pick.horizon_id] = pick

    zone_data_by_zone_id = {
        row.zone_id: row
        for row in session.scalars(
            select(ZoneWellData).where(
                ZoneWellData.zone_id.in_([z.id for z in zones]),
                ZoneWellData.well_id == well_id,
            )
        ).all()
    }

    for zone in zones:
        zwd = zone_data_by_zone_id.get(zone.id)
        if zwd is None:
            continue
        upper_pick = picks_by_horizon.get(zone.upper_horizon_id)
        lower_pick = picks_by_horizon.get(zone.lower_horizon_id)
        if (
            upper_pick is not None
            and lower_pick is not None
            and upper_pick.depth_md is not None
            and lower_pick.depth_md is not None
        ):
            zwd.thickness_md = lower_pick.depth_md - upper_pick.depth_md
        else:
            zwd.thickness_md = None

        if (
            upper_pick is not None
            and lower_pick is not None
            and upper_pick.depth_tvd is not None
            and lower_pick.depth_tvd is not None
        ):
            zwd.thickness_tvd = lower_pick.depth_tvd - upper_pick.depth_tvd
        else:
            zwd.thickness_tvd = None

    session.flush()


def merge_zones_on_horizon_delete(
    session: Session, top_set_id: int, horizon_id: int
) -> None:
    """Delete zones adjacent to horizon_id and create a merged replacement if both exist."""
    zone_above = session.scalar(
        select(FormationZone).where(
            FormationZone.top_set_id == top_set_id,
            FormationZone.lower_horizon_id == horizon_id,
        )
    )
    zone_below = session.scalar(
        select(FormationZone).where(
            FormationZone.top_set_id == top_set_id,
            FormationZone.upper_horizon_id == horizon_id,
        )
    )

    if zone_above is None and zone_below is None:
        return

    new_upper_id = zone_above.upper_horizon_id if zone_above is not None else None
    new_lower_id = zone_below.lower_horizon_id if zone_below is not None else None
    new_sort_order = zone_above.sort_order if zone_above is not None else (zone_below.sort_order if zone_below is not None else 0)

    # Collect well_ids with zone data before deleting
    affected_well_ids: set[str] = set()
    for zone in filter(None, [zone_above, zone_below]):
        for zwd in session.scalars(
            select(ZoneWellData).where(ZoneWellData.zone_id == zone.id)
        ).all():
            affected_well_ids.add(zwd.well_id)
        session.delete(zone)

    session.flush()

    # Create merged replacement only if both sides existed
    if new_upper_id is not None and new_lower_id is not None:
        merged = FormationZone(
            top_set_id=top_set_id,
            upper_horizon_id=new_upper_id,
            lower_horizon_id=new_lower_id,
            sort_order=new_sort_order,
        )
        session.add(merged)
        session.flush()

        for well_id in affected_well_ids:
            session.add(ZoneWellData(
                zone_id=merged.id,
                well_id=well_id,
                lithology_fractions=None,
                lithology_source='manual',
            ))
        session.flush()


def get_well_active_top_set_id(session: Session, well_id: str) -> int | None:
    link = session.scalar(
        select(WellActiveTopSet).where(WellActiveTopSet.well_id == well_id)
    )
    return link.top_set_id if link is not None else None


def _weighted_litho_param(
    fractions: dict[str, float],
    litho_params: dict[str, LithologyParam],
) -> LithologyParam:
    if not fractions:
        return DEFAULT_LITHO_PARAM
    density = porosity = coeff = total = 0.0
    for code, frac in fractions.items():
        p = litho_params.get(code, DEFAULT_LITHO_PARAM)
        density += frac * p.density
        porosity += frac * p.porosity_surface
        coeff += frac * p.compaction_coeff
        total += frac
    remaining = max(0.0, 1.0 - total)
    if remaining > 1e-9:
        density += remaining * DEFAULT_LITHO_PARAM.density
        porosity += remaining * DEFAULT_LITHO_PARAM.porosity_surface
        coeff += remaining * DEFAULT_LITHO_PARAM.compaction_coeff
    return LithologyParam(density=density, porosity_surface=porosity, compaction_coeff=coeff)


def build_zone_layer_inputs(
    session: Session,
    well_id: str,
    litho_params: dict[str, LithologyParam],
) -> list[ZoneLayerInput]:
    top_set_id = get_well_active_top_set_id(session, well_id)
    if top_set_id is None:
        return []

    zones = session.scalars(
        select(FormationZone)
        .where(FormationZone.top_set_id == top_set_id)
        .order_by(FormationZone.sort_order.asc())
    ).all()
    if not zones:
        return []

    horizon_ids = {z.upper_horizon_id for z in zones} | {z.lower_horizon_id for z in zones}
    picks_by_horizon: dict[int, FormationTopModel] = {
        pick.horizon_id: pick
        for pick in session.scalars(
            select(FormationTopModel).where(
                FormationTopModel.well_id == well_id,
                FormationTopModel.horizon_id.in_(horizon_ids),
            )
        ).all()
        if pick.horizon_id is not None
    }

    zwd_by_zone: dict[int, ZoneWellData] = {
        row.zone_id: row
        for row in session.scalars(
            select(ZoneWellData).where(
                ZoneWellData.zone_id.in_([z.id for z in zones]),
                ZoneWellData.well_id == well_id,
            )
        ).all()
    }

    result: list[ZoneLayerInput] = []
    for zone in zones:
        upper = zone.upper_horizon
        lower = zone.lower_horizon
        upper_pick = picks_by_horizon.get(upper.id)
        lower_pick = picks_by_horizon.get(lower.id)

        if (
            upper_pick is None or lower_pick is None
            or upper_pick.depth_md is None or lower_pick.depth_md is None
        ):
            continue

        zwd = zwd_by_zone.get(zone.id)
        fractions: dict[str, float] = {}
        if zwd is not None and zwd.lithology_fractions:
            try:
                parsed = json.loads(zwd.lithology_fractions)
                if isinstance(parsed, dict):
                    fractions = {k: float(v) for k, v in parsed.items()}
            except (ValueError, TypeError):
                pass
        elif upper_pick.lithology:
            fractions = {upper_pick.lithology: 1.0}

        dominant = max(fractions, key=lambda c: fractions[c]) if fractions else (upper_pick.lithology or '')
        result.append(ZoneLayerInput(
            name=f'{upper.name} → {lower.name}',
            color=upper.color,
            lithology=dominant,
            litho_param=_weighted_litho_param(fractions, litho_params),
            age_top_ma=upper.age_ma,
            age_base_ma=lower.age_ma,
            current_top_m=upper_pick.depth_md,
            current_base_m=lower_pick.depth_md,
        ))

    return result
