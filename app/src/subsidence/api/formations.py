from __future__ import annotations

import logging
import math

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from subsidence.data import (
    CreateFormation,
    ProjectManager,
    RemoveFormation,
    UpdateFormation,
    UpdateFormationDepth,
    UpdateFormationStratLink,
)
from subsidence.data.deviation_transform import compute_tvd_tvdss, tvd_to_md
from subsidence.data.undo import _model_to_dict
from subsidence.data.schema import FormationStratLink, FormationTopModel, StratChart, StratUnit, TopSetHorizon, WellModel
from subsidence.data.strat_link import auto_link_to_active_chart, find_strat_unit_by_name
from subsidence.data.zone_service import (
    _floor_match_horizon,
    aggregate_zone_lithology_from_curve,
    ensure_zone_well_data,
    get_well_active_top_set_id,
    link_picks_to_horizons,
    recalculate_zone_thickness,
)

router = APIRouter(tags=['formations'])

_log = logging.getLogger('subsidence.api.formations')


class FormationTopCreate(BaseModel):
    name: str
    depth_md: float
    color: str = '#808080'
    kind: str = 'strat'
    lithology: str | None = None
    age_ma: float | None = None
    hiatus_duration_ma: float = 0.0
    is_locked: bool = False
    water_depth_m: float = 0.0
    eroded_thickness_m: float = 0.0


class FormationTopPatch(BaseModel):
    name: str | None = None
    depth_md: float | None = None
    depth_tvd: float | None = None
    depth_tvdss: float | None = None
    color: str | None = None
    kind: str | None = None
    lithology: str | None = None
    age_ma: float | None = None
    age_base_ma: float | None = None
    hiatus_duration_ma: float | None = None
    is_locked: bool | None = None
    water_depth_m: float | None = None
    eroded_thickness_m: float | None = None
    sea_level_m_override: float | None = None
    reset_color: bool = False


class FormationStratLinkResponse(BaseModel):
    chart_id: int
    chart_name: str
    strat_unit_id: int
    strat_unit_name: str
    color_hex: str | None


class FormationTopResponse(BaseModel):
    id: str
    name: str
    depth_md: float | None
    depth_tvd: float | None
    depth_tvdss: float | None
    horizon_id: int | None
    horizon_name: str | None
    horizon_color: str | None
    color: str
    color_source: str
    kind: str
    lithology: str | None
    age_ma: float | None
    age_base_ma: float | None
    hiatus_duration_ma: float
    is_locked: bool
    water_depth_m: float
    eroded_thickness_m: float
    sea_level_m_override: float | None
    strat_links: list[FormationStratLinkResponse]
    active_strat_color: str | None
    active_strat_unit_name: str | None
    warnings: list[str] = []


class StratUnitLookupResponse(BaseModel):
    id: int
    name: str
    rank: str | None
    color_hex: str | None


class StratLinkRequest(BaseModel):
    chart_id: int
    strat_unit_id: int | None


def _manager(request: Request) -> ProjectManager:
    return request.app.state.project_manager


def _require_open_project(request: Request) -> ProjectManager:
    manager = _manager(request)
    if not manager.is_open:
        raise HTTPException(status_code=400, detail='No project is currently open')
    return manager


def _require_well(session, well_id: str) -> WellModel:
    well = session.get(WellModel, well_id)
    if well is None:
        raise HTTPException(status_code=404, detail=f'Well not found: {well_id}')
    return well


def _validate_depth_inside_well(well: WellModel, depth_md: float | None) -> None:
    if depth_md is None:
        return
    if not math.isfinite(depth_md):
        raise HTTPException(status_code=400, detail='Top depth must be a finite number')
    td_md = well.td_md
    if depth_md < 0 or (td_md is not None and depth_md > td_md):
        upper = td_md if td_md is not None else 0.0
        raise HTTPException(
            status_code=400,
            detail=f'Top depth {depth_md:.1f} m is outside well interval 0.0-{upper:.1f} m',
        )


def _load_options():
    return [
        selectinload(FormationTopModel.strat_links).options(
            selectinload(FormationStratLink.strat_unit),
            selectinload(FormationStratLink.chart),
        ),
        selectinload(FormationTopModel.horizon),
    ]


def _load_formation(session, formation_id: int) -> FormationTopModel | None:
    return session.scalar(
        select(FormationTopModel)
        .where(FormationTopModel.id == formation_id)
        .options(*_load_options())
    )


def _to_response(row: FormationTopModel, warnings: list[str] | None = None) -> FormationTopResponse:
    links = [
        FormationStratLinkResponse(
            chart_id=link.chart_id,
            chart_name=link.chart.name,
            strat_unit_id=link.strat_unit_id,
            strat_unit_name=link.strat_unit.name,
            color_hex=link.strat_unit.color_hex,
        )
        for link in row.strat_links
    ]
    active_link = next((link for link in row.strat_links if link.chart.is_active), None)
    return FormationTopResponse(
        id=str(row.id),
        name=row.name,
        depth_md=row.depth_md,
        depth_tvd=row.depth_tvd,
        depth_tvdss=row.depth_tvdss,
        horizon_id=row.horizon_id,
        horizon_name=row.horizon.name if row.horizon else None,
        horizon_color=row.horizon.color if row.horizon else None,
        color=row.color,
        color_source=row.color_source,
        kind=row.kind,
        lithology=row.lithology,
        age_ma=row.age_top_ma,
        age_base_ma=row.age_base_ma,
        hiatus_duration_ma=row.hiatus_duration_ma,
        is_locked=row.is_locked,
        water_depth_m=row.water_depth_m,
        eroded_thickness_m=row.eroded_thickness_m,
        sea_level_m_override=row.sea_level_m_override,
        strat_links=links,
        active_strat_color=active_link.strat_unit.color_hex if active_link else None,
        active_strat_unit_name=active_link.strat_unit.name if active_link else None,
        warnings=warnings or [],
    )


@router.get('/strat-units', response_model=list[StratUnitLookupResponse])
def list_strat_units(request: Request, q: str = '', limit: int = 20, chart_id: int | None = None) -> list[StratUnitLookupResponse]:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        stmt = select(StratUnit).order_by(StratUnit.name.asc()).limit(max(1, min(limit, 100)))
        query = q.strip()
        if query:
            stmt = stmt.where(StratUnit.name.ilike(f'%{query}%'))
        if chart_id is not None:
            stmt = stmt.where(StratUnit.chart_id == chart_id)

        rows = session.scalars(stmt).all()
        return [
            StratUnitLookupResponse(
                id=row.id,
                name=row.name,
                rank=row.rank,
                color_hex=row.color_hex,
            )
            for row in rows
        ]


@router.get('/wells/{well_id}/formations', response_model=list[FormationTopResponse])
def list_formations(well_id: str, request: Request) -> list[FormationTopResponse]:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        _require_well(session, well_id)
        rows = session.scalars(
            select(FormationTopModel)
            .where(FormationTopModel.well_id == well_id)
            .order_by(FormationTopModel.depth_md.asc(), FormationTopModel.id.asc())
            .options(*_load_options())
        ).all()
        responses = [_to_response(row) for row in rows]
        _log.info('list_formations.response', extra={'event': {
            'operation': 'list_formations',
            'well_id': well_id,
            'count': len(responses),
            'picks': [
                {
                    'name': r.name,
                    'color': r.color,
                    'color_source': r.color_source,
                    'active_strat_color': r.active_strat_color,
                    'horizon_id': r.horizon_id,
                }
                for r in responses
            ],
        }})
        return responses


@router.post('/wells/{well_id}/formations', response_model=FormationTopResponse, status_code=201)
def create_formation(well_id: str, body: FormationTopCreate, request: Request) -> FormationTopResponse:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        well = _require_well(session, well_id)
        _validate_depth_inside_well(well, body.depth_md)
        tvd, tvdss = compute_tvd_tvdss(manager.project_path, well, body.depth_md)
        row = FormationTopModel(
            well_id=well_id,
            name=body.name,
            depth_md=body.depth_md,
            depth_tvd=tvd,
            depth_tvdss=tvdss,
            age_top_ma=body.age_ma,
            color=body.color,
            kind=body.kind,
            lithology=body.lithology,
            is_locked=body.is_locked,
            water_depth_m=body.water_depth_m,
            hiatus_duration_ma=body.hiatus_duration_ma if body.kind == 'unconformity' else 0.0,
            eroded_thickness_m=body.eroded_thickness_m,
        )
        session.add(row)
        session.flush()
        auto_link_to_active_chart(session, row)
        session.flush()
        manager.undo_stack.push(CreateFormation(_model_to_dict(row)), session)
        session.commit()
        created = _load_formation(session, row.id)
        if created is None:
            raise HTTPException(status_code=500, detail='Failed to create formation')
        return _to_response(created)


@router.patch('/wells/{well_id}/formations/{formation_id}', response_model=FormationTopResponse)
def update_formation(well_id: str, formation_id: int, body: FormationTopPatch, request: Request) -> FormationTopResponse:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        _require_well(session, well_id)
        row = _load_formation(session, formation_id)
        if row is None or row.well_id != well_id:
            raise HTTPException(status_code=404, detail=f'Formation not found: {formation_id}')

        # Resolve depth_md from TVD or TVDSS inputs when depth_md not explicitly set
        resolved_depth_md = body.depth_md
        if resolved_depth_md is None and (body.depth_tvd is not None or body.depth_tvdss is not None):
            well = session.get(WellModel, well_id)
            if well is None:
                raise HTTPException(status_code=404, detail=f'Well not found: {well_id}')
            if body.depth_tvdss is not None:
                tvd_for_calc = body.depth_tvdss + well.kb_elev
            else:
                tvd_for_calc = body.depth_tvd
            md_result = tvd_to_md(tvd_for_calc, manager.project_path, well)
            if md_result is None:
                raise HTTPException(status_code=400, detail='No deviation survey available for TVD/TVDSS-to-MD back-calculation')
            resolved_depth_md = md_result
        if resolved_depth_md is not None:
            well = session.get(WellModel, well_id)
            if well is None:
                raise HTTPException(status_code=404, detail=f'Well not found: {well_id}')
            _validate_depth_inside_well(well, resolved_depth_md)

        old_values: dict[str, object] = {}
        new_values: dict[str, object] = {}
        validation_warnings: list[str] = []

        patch_map = {
            'name': ('name', body.name),
            'depth_md': ('depth_md', resolved_depth_md),
            'color': ('color', body.color),
            'kind': ('kind', body.kind),
            'lithology': ('lithology', body.lithology),
            'age_top_ma': ('age_top_ma', body.age_ma),
            'age_base_ma': ('age_base_ma', body.age_base_ma),
            'hiatus_duration_ma': ('hiatus_duration_ma', body.hiatus_duration_ma),
            'is_locked': ('is_locked', body.is_locked),
            'water_depth_m': ('water_depth_m', body.water_depth_m),
            'eroded_thickness_m': ('eroded_thickness_m', body.eroded_thickness_m),
        }

        for model_field, (_, value) in patch_map.items():
            if value is None:
                continue
            current_value = getattr(row, model_field)
            if current_value == value:
                continue
            old_values[model_field] = current_value
            new_values[model_field] = value

        if 'sea_level_m_override' in body.model_fields_set:
            current = row.sea_level_m_override
            next_val = body.sea_level_m_override
            if current != next_val:
                old_values['sea_level_m_override'] = current
                new_values['sea_level_m_override'] = next_val

        # color → mark as user-overridden
        if 'color' in new_values:
            old_values['color_source'] = row.color_source
            new_values['color_source'] = 'user'

        # reset_color: compute from linked horizon or use grey, mark auto
        if body.reset_color:
            horizons = list(session.scalars(
                select(TopSetHorizon).where(
                    TopSetHorizon.top_set_id == (
                        select(TopSetHorizon.top_set_id)
                        .where(TopSetHorizon.id == row.horizon_id)
                        .scalar_subquery()
                    )
                )
            ).all()) if row.horizon_id else []
            matched = _floor_match_horizon(horizons, row.age_top_ma) if horizons else None
            reset_color_val = matched.color if matched else (row.horizon.color if row.horizon else '#9ca3af')
            old_values['color'] = row.color
            new_values['color'] = reset_color_val
            old_values['color_source'] = row.color_source
            new_values['color_source'] = 'auto'

        # age_top_ma: validate depth-order constraint
        if 'age_top_ma' in new_values:
            new_age = new_values['age_top_ma']
            if new_age is not None:
                ordered = session.scalars(
                    select(FormationTopModel)
                    .where(FormationTopModel.well_id == well_id)
                    .order_by(FormationTopModel.depth_md.asc().nulls_last(), FormationTopModel.id.asc())
                ).all()
                idx = next((i for i, p in enumerate(ordered) if p.id == formation_id), None)
                if idx is not None:
                    above_age = next((p.age_top_ma for p in reversed(ordered[:idx]) if p.age_top_ma is not None), None)
                    below_age = next((p.age_top_ma for p in ordered[idx + 1:] if p.age_top_ma is not None), None)
                    invalid = (above_age is not None and new_age < above_age) or \
                              (below_age is not None and new_age > below_age)
                    if invalid:
                        new_values['age_top_ma'] = None
                        msg = f'Age {new_age} Ma violates depth order — cleared'
                        validation_warnings.append(msg)
                        _log.warning('age_validation_failed', extra={'event': {
                            'operation': 'update_formation', 'phase': 'age_validation_failed',
                            'formation_id': formation_id, 'name': row.name,
                            'new_age': new_age, 'above_age': above_age, 'below_age': below_age,
                        }})

        # age=0: auto-set water_depth_m = TVDSS (depth_md - kb_elev) if not explicitly provided
        if new_values.get('age_top_ma') == 0.0 and 'water_depth_m' not in new_values:
            tvdss = row.depth_tvdss
            effective_depth = new_values.get('depth_md', row.depth_md)
            if tvdss is None and effective_depth is not None:
                well_obj = session.get(WellModel, well_id)
                tvdss = effective_depth - (well_obj.kb_elev or 0.0) if well_obj else None
            if tvdss is not None:
                old_values['water_depth_m'] = row.water_depth_m
                new_values['water_depth_m'] = tvdss
                _log.info('water_depth_auto_set', extra={'event': {
                    'operation': 'update_formation', 'phase': 'water_depth_auto_set',
                    'formation_id': formation_id, 'name': row.name,
                    'depth_md': effective_depth, 'tvdss': tvdss,
                    'old_water_depth_m': row.water_depth_m, 'new_water_depth_m': tvdss,
                }})

    if not new_values:
        with manager.get_session() as session:
            existing = _load_formation(session, formation_id)
            if existing is None:
                raise HTTPException(status_code=404, detail=f'Formation not found: {formation_id}')
            return _to_response(existing)

    if set(new_values) == {'depth_md'}:
        # UpdateFormationDepth handles zone recalculation internally via _set_depth
        old_depth = old_values['depth_md']
        new_depth = new_values['depth_md']
        manager.execute_command(UpdateFormationDepth(
            formation_id,
            float(old_depth) if old_depth is not None else None,
            float(new_depth) if new_depth is not None else None,
            project_path=manager.project_path,
        ))
    else:
        manager.execute_command(UpdateFormation(formation_id, old_values, new_values))
        needs_relink = 'age_top_ma' in new_values
        needs_thickness = 'depth_md' in new_values or needs_relink
        needs_horizon_name_sync = 'name' in new_values
        if needs_thickness or needs_relink or needs_horizon_name_sync:
            with manager.get_session() as session:
                top = session.get(FormationTopModel, formation_id)
                if top is not None:
                    # Sync horizon name when pick is renamed so the pick stays name-matched.
                    if needs_horizon_name_sync and top.horizon_id is not None:
                        horizon = session.get(TopSetHorizon, top.horizon_id)
                        if horizon is not None and horizon.name != top.name:
                            old_horizon_name = horizon.name
                            horizon.name = top.name
                            linked_picks = session.scalars(
                                select(FormationTopModel).where(
                                    FormationTopModel.horizon_id == top.horizon_id,
                                    FormationTopModel.id != top.id,
                                )
                            ).all()
                            for linked_pick in linked_picks:
                                linked_pick.name = top.name
                            session.flush()
                            _log.info('horizon_name_synced', extra={'event': {
                                'operation': 'update_formation', 'phase': 'horizon_name_synced',
                                'formation_id': formation_id, 'new_name': top.name,
                                'horizon_id': top.horizon_id, 'old_horizon_name': old_horizon_name,
                                'linked_pick_count': len(linked_picks),
                            }})
                    top_set_id = get_well_active_top_set_id(session, top.well_id)
                    if top_set_id is not None:
                        if needs_relink or needs_horizon_name_sync:
                            link_picks_to_horizons(session, top.well_id, top_set_id)
                            auto_link_to_active_chart(session, top)
                            if top.horizon_id is not None and top.age_top_ma is not None:
                                horizon = session.get(TopSetHorizon, top.horizon_id)
                                if horizon is not None and horizon.age_ma != top.age_top_ma:
                                    old_horizon_age = horizon.age_ma
                                    horizon.age_ma = top.age_top_ma
                                    _log.info('horizon_age_synced', extra={'event': {
                                        'operation': 'update_formation', 'phase': 'horizon_age_synced',
                                        'formation_id': formation_id, 'name': top.name,
                                        'horizon_id': top.horizon_id, 'horizon_name': horizon.name,
                                        'old_age_ma': old_horizon_age, 'new_age_ma': top.age_top_ma,
                                    }})
                        if needs_thickness:
                            ensure_zone_well_data(session, top_set_id, top.well_id)
                            recalculate_zone_thickness(session, top_set_id, top.well_id)
                            aggregate_zone_lithology_from_curve(session, manager.project_path, top.well_id)
                        session.commit()

    with manager.get_session() as session:
        updated = _load_formation(session, formation_id)
        if updated is None:
            raise HTTPException(status_code=404, detail=f'Formation not found: {formation_id}')
        return _to_response(updated, warnings=validation_warnings)


@router.put('/wells/{well_id}/formations/{formation_id}/strat-link', response_model=FormationTopResponse)
def upsert_formation_strat_link(well_id: str, formation_id: int, body: StratLinkRequest, request: Request) -> FormationTopResponse:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        _require_well(session, well_id)
        formation = _load_formation(session, formation_id)
        if formation is None or formation.well_id != well_id:
            raise HTTPException(status_code=404, detail=f'Formation not found: {formation_id}')

        chart = session.get(StratChart, body.chart_id)
        if chart is None:
            raise HTTPException(status_code=404, detail=f'Strat chart not found: {body.chart_id}')
        if body.strat_unit_id is not None:
            strat_unit = session.get(StratUnit, body.strat_unit_id)
            if strat_unit is None:
                raise HTTPException(status_code=404, detail=f'Strat unit not found: {body.strat_unit_id}')
            if strat_unit.chart_id != body.chart_id:
                raise HTTPException(status_code=400, detail='Strat unit does not belong to the selected chart')

        existing_link = session.scalar(
            select(FormationStratLink).where(
                FormationStratLink.formation_id == formation_id,
                FormationStratLink.chart_id == body.chart_id,
            )
        )
        old_strat_unit_id = existing_link.strat_unit_id if existing_link is not None else None

    if old_strat_unit_id != body.strat_unit_id:
        manager.execute_command(
            UpdateFormationStratLink(
                formation_id=formation_id,
                chart_id=body.chart_id,
                old_strat_unit_id=old_strat_unit_id,
                new_strat_unit_id=body.strat_unit_id,
            )
        )

    with manager.get_session() as session:
        updated = _load_formation(session, formation_id)
        if updated is None:
            raise HTTPException(status_code=404, detail=f'Formation not found: {formation_id}')
        return _to_response(updated)


@router.delete('/wells/{well_id}/formations/{formation_id}', status_code=204)
def delete_formation(well_id: str, formation_id: int, request: Request) -> None:
    manager = _require_open_project(request)
    with manager.get_session() as session:
        _require_well(session, well_id)
        row = _load_formation(session, formation_id)
        if row is None or row.well_id != well_id:
            raise HTTPException(status_code=404, detail=f'Formation not found: {formation_id}')
        snapshot = _model_to_dict(row)

    manager.execute_command(RemoveFormation(snapshot))

    with manager.get_session() as session:
        top_set_id = get_well_active_top_set_id(session, well_id)
        if top_set_id is not None:
            recalculate_zone_thickness(session, top_set_id, well_id)
            aggregate_zone_lithology_from_curve(session, manager.project_path, well_id)
            session.commit()

    manager.save_project()
