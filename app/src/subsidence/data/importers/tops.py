from __future__ import annotations

import logging
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..schema import FormationTopModel, TopSetHorizon
from ..strat_link import auto_link_to_active_chart

_log = logging.getLogger('subsidence.import.tops')
from .common import (
    _DEFAULT_TOP_COLOR,
    _apply_column_map,
    _ensure_row_targets_well,
    _extract_float,
    _extract_text,
    _extract_user_attributes,
    _group_rows_by_well_name,
    _has_multi_well_rows,
    _load_ics_units,
    _merge_extra_attribute_json,
    _read_csv_rows,
    _resolve_or_create_well_from_rows,
    _resolve_ics_color,
    apply_imported_well_metadata,
    extend_well_td_for_import,
    run_top_qc,
)

_TOPS_KNOWN_FIELDS = {
    'well_name',
    'well',
    'wellname',
    'well_id',
    'uwi',
    'topset_name',
    'top_set_name',
    'zone_set_name',
    'top_name',
    'name',
    'formation',
    'top',
    'horizon',
    'pick',
    'stratigraphic_unit',
    'unit',
    'marker',
    'depth_md',
    'depth',
    'md',
    'dept',
    'depth_m',
    'md_m',
    'measured_depth',
    'boundary_type',
    'kind',
    'type',
    'age_ma',
    'strat_age_ma',
    'age',
    'age_base_ma',
    'hiatus_duration_ma',
    'hiatus_ma',
    'hiatus',
    'eroded_thickness_m',
    'eroded_m',
    'eroded',
    'water_depth_m',
    'paleobathymetry_m',
    'paleobathymetry',
    'sea_level_m_override',
    'sea_level_override_m',
    'sea_level',
    'lithology',
    'lithology_fractions',
    'lithology_source',
    'color',
    'note',
}

_TOPS_COMPUTED_EXPORT_FIELDS = {
    'depth_tvd',
    'depth_tvdss',
    'lower_top_name',
    'zone_thickness_md',
    'zone_thickness_tvd',
}


def _top_name_key(name: str | None) -> str:
    return (name or '').strip().lower()


def _load_or_create_horizon(
    session: Session,
    top_set_id: int,
    *,
    name: str,
    kind: str,
    age_ma: float | None,
    color: str,
    sort_order: int,
    horizon_by_name: dict[str, TopSetHorizon],
) -> TopSetHorizon:
    key = _top_name_key(name)
    horizon = horizon_by_name.get(key)
    if horizon is not None:
        if horizon.age_ma is None and age_ma is not None:
            horizon.age_ma = age_ma
        if not horizon.kind:
            horizon.kind = kind
        if not horizon.color:
            horizon.color = color
        return horizon

    horizon = TopSetHorizon(
        top_set_id=top_set_id,
        name=name.strip(),
        kind=kind,
        age_ma=age_ma,
        color=color,
        sort_order=sort_order,
        note=None,
    )
    session.add(horizon)
    session.flush()
    horizon_by_name[key] = horizon
    return horizon


def _normalize_duplicate_imported_ages(imported: list[FormationTopModel]) -> None:
    by_age: dict[float, list[FormationTopModel]] = {}
    for top in imported:
        if top.age_top_ma is None:
            continue
        by_age.setdefault(top.age_top_ma, []).append(top)

    for tops in by_age.values():
        if len(tops) < 2:
            continue
        ordered = sorted(
            tops,
            key=lambda top: (top.depth_md is None, top.depth_md if top.depth_md is not None else 0.0, top.id or 0),
        )
        for duplicate in ordered[1:]:
            duplicate.age_top_ma = None


def _import_tops_rows(
    session: Session,
    well_id: str | None,
    path: Path,
    fieldnames: list[str],
    rows: list[dict[str, str]],
    depth_ref: str = 'MD',
    *,
    strat_units_path: Path | str | None = None,
    strat_ranks_path: Path | str | None = None,
    create_new_well: bool = False,
    top_set_id: int | None = None,
) -> tuple[list[FormationTopModel], list[str]]:
    depth_ref_upper = depth_ref.upper()
    if depth_ref_upper not in ('MD', 'TVD', 'TVDSS'):
        raise ValueError(
            f'depth_ref={depth_ref!r} is not supported; valid values: MD, TVD, TVDSS'
        )
    required = {'top_name', 'depth_md'}
    missing = required.difference(set(fieldnames))
    if missing:
        raise ValueError(f'{path}: missing required columns: {sorted(missing)}')

    _log.info('csv_parsed', extra={'event': {
        'operation': 'import_tops', 'phase': 'csv_parsed',
        'path': str(path), 'row_count': len(rows),
        'columns': fieldnames,
        'has_age_column': any(c in fieldnames for c in ('age_ma', 'strat_age_ma', 'age')),
        'top_set_id': top_set_id,
        'well_id': well_id,
    }})

    well = _resolve_or_create_well_from_rows(session, rows, well_id=well_id, create_new_well=create_new_well)
    max_depth = max((_extract_float(row, 'depth_md', 'depth') or 0.0) for row in rows) if rows else None
    td_before_import = well.td_md
    if max_depth is not None:
        apply_imported_well_metadata(well, td=max_depth)
    td_warning = extend_well_td_for_import(well, max_depth, previous_td=td_before_import)

    _log.info('well_resolved', extra={'event': {
        'operation': 'import_tops', 'phase': 'well_resolved',
        'well_id': well.id, 'well_name': well.name, 'kb_elev': well.kb_elev,
    }})

    ics_units = _load_ics_units(Path(strat_units_path) if strat_units_path else None, Path(strat_ranks_path) if strat_ranks_path else None)
    horizon_by_name: dict[str, TopSetHorizon] = {}
    next_horizon_sort = 0
    picks_by_horizon_id: dict[int, FormationTopModel] = {}
    unlinked_picks_by_name: dict[str, FormationTopModel] = {}
    if top_set_id is not None:
        existing_horizons = session.scalars(
            select(TopSetHorizon).where(TopSetHorizon.top_set_id == top_set_id)
        ).all()
        horizon_by_name = {_top_name_key(horizon.name): horizon for horizon in existing_horizons}
        horizon_ids = {horizon.id for horizon in existing_horizons}
        next_horizon_sort = max((horizon.sort_order for horizon in existing_horizons), default=-1) + 1
        existing_picks = session.scalars(
            select(FormationTopModel).where(FormationTopModel.well_id == well.id)
        ).all()
        picks_by_horizon_id = {
            pick.horizon_id: pick
            for pick in existing_picks
            if pick.horizon_id in horizon_ids
        }
        unlinked_picks_by_name = {
            _top_name_key(pick.name): pick
            for pick in existing_picks
            if pick.horizon_id is None and _top_name_key(pick.name)
        }
        _log.info('topset_context', extra={'event': {
            'operation': 'import_tops', 'phase': 'topset_context',
            'top_set_id': top_set_id,
            'existing_horizon_count': len(existing_horizons),
            'existing_horizon_names': [h.name for h in existing_horizons],
            'existing_horizon_ages': [h.age_ma for h in existing_horizons],
            'existing_picks_count': len(existing_picks),
        }})
    else:
        _log.info('topset_context', extra={'event': {
            'operation': 'import_tops', 'phase': 'topset_context',
            'top_set_id': None,
            'note': 'no top_set_id — picks will not be linked to horizons',
        }})

    imported: list[FormationTopModel] = []
    explicit_water_depth_objects: set[int] = set()
    for row_index, row in enumerate(rows):
        _ensure_row_targets_well(row, well, path)
        top_name = _extract_text(row, 'top_name')
        depth_md = _extract_float(row, 'depth_md', 'depth')
        if top_name is None or depth_md is None:
            raise ValueError(f'{path}: top_name and depth_md are required')

        boundary_type = (_extract_text(row, 'boundary_type', 'kind', 'type') or 'conformable').strip().lower()
        is_unconformity = boundary_type == 'unconformity'
        age_ma = _extract_float(row, 'age_ma', 'strat_age_ma', 'age')
        hiatus_ma = _extract_float(row, 'hiatus_duration_ma', 'hiatus_ma', 'hiatus') or 0.0
        eroded_m = _extract_float(row, 'eroded_thickness_m', 'eroded_m', 'eroded') or 0.0
        water_depth_text = _extract_text(row, 'water_depth_m', 'paleobathymetry_m', 'paleobathymetry')
        water_depth_m = _extract_float(row, 'water_depth_m', 'paleobathymetry_m', 'paleobathymetry') if water_depth_text is not None else None
        sea_level_m_override = _extract_float(row, 'sea_level_m_override', 'sea_level_override_m', 'sea_level')
        age_base_ma = _extract_float(row, 'age_base_ma')
        lithology = _extract_text(row, 'lithology')
        lithology_fractions = _extract_text(row, 'lithology_fractions')
        lithology_source = (_extract_text(row, 'lithology_source') or '').strip().lower()
        explicit_color = _extract_text(row, 'color')
        has_explicit_color = explicit_color is not None
        color = explicit_color or _resolve_ics_color(age_ma, ics_units) or _DEFAULT_TOP_COLOR
        color_source = 'user' if has_explicit_color else 'auto'
        note = _extract_text(row, 'note')
        extra = _extract_user_attributes(
            row,
            _TOPS_KNOWN_FIELDS,
            excluded_fields=_TOPS_COMPUTED_EXPORT_FIELDS,
        )

        qc = run_top_qc(top_name, depth_md, well.td_md)
        kind = 'unconformity' if is_unconformity else 'strat'
        horizon = None
        if top_set_id is not None:
            horizon = _load_or_create_horizon(
                session,
                top_set_id,
                name=top_name,
                kind=kind,
                age_ma=age_ma,
                color=color,
                sort_order=next_horizon_sort + row_index,
                horizon_by_name=horizon_by_name,
            )
            top = picks_by_horizon_id.get(horizon.id) or unlinked_picks_by_name.get(_top_name_key(top_name))
        else:
            top = None

        if top is None:
            top = FormationTopModel(
                well_id=well.id,
                name=top_name,
                kind=kind,
                depth_md=depth_md,
                depth_tvd=None,
                age_top_ma=age_ma,
                age_base_ma=None,
                confidence=None,
                color=color,
                color_source=color_source,
                is_locked=False,
            )
            session.add(top)

        top.horizon_id = horizon.id if horizon is not None else top.horizon_id
        top.name = top_name
        top.kind = kind
        top.depth_md = depth_md
        top.depth_tvd = None
        top.age_top_ma = age_ma
        top.age_base_ma = age_base_ma
        top.confidence = None
        if water_depth_m is not None:
            top.water_depth_m = water_depth_m
            explicit_water_depth_objects.add(id(top))
        top.sea_level_m_override = sea_level_m_override
        top.lithology = lithology
        if has_explicit_color or top.color_source != 'user':
            top.color = color
            top.color_source = color_source
        top.hiatus_duration_ma = hiatus_ma if is_unconformity else 0.0
        top.eroded_thickness_m = eroded_m if is_unconformity else 0.0
        top.note = note
        top.qc_status = str(qc['qc_status'])
        top.qc_summary = str(qc['qc_summary']) if qc.get('qc_summary') else None
        top.extra = _merge_extra_attribute_json(top.extra, extra)
        setattr(top, '_import_lithology_fractions', lithology_fractions)
        setattr(top, '_import_lithology_source', lithology_source if lithology_source in {'manual', 'auto'} else None)
        _log.debug('pick_row', extra={'event': {
            'operation': 'import_tops', 'phase': 'pick_row',
            'name': top_name, 'depth_md': depth_md, 'age_ma': age_ma,
            'horizon_id': top.horizon_id,
            'qc_status': qc['qc_status'],
        }})
        auto_link_to_active_chart(session, top)
        imported.append(top)

    session.flush()
    _normalize_duplicate_imported_ages(imported)

    water_depth_set: list[dict] = []
    for top in imported:
        if top.age_top_ma == 0.0 and top.depth_md is not None and id(top) not in explicit_water_depth_objects:
            wd = top.depth_md - (well.kb_elev or 0.0)
            top.water_depth_m = wd
            water_depth_set.append({'name': top.name, 'depth_md': top.depth_md, 'kb_elev': well.kb_elev, 'water_depth_m': wd})
    if water_depth_set:
        _log.info('water_depth_auto_set', extra={'event': {
            'operation': 'import_tops', 'phase': 'water_depth_auto_set',
            'picks': water_depth_set,
        }})

    ages_present = sum(1 for t in imported if t.age_top_ma is not None)
    ages_null = len(imported) - ages_present
    _log.info('picks_imported', extra={'event': {
        'operation': 'import_tops', 'phase': 'picks_imported',
        'total': len(imported),
        'with_age': ages_present,
        'without_age': ages_null,
        'with_horizon_id': sum(1 for t in imported if t.horizon_id is not None),
        'without_horizon_id': sum(1 for t in imported if t.horizon_id is None),
        'names': [t.name for t in imported],
        'ages': [t.age_top_ma for t in imported],
        'horizon_ids': [t.horizon_id for t in imported],
    }})

    # Collect QC warning messages
    import json as _json
    qc_warnings: list[str] = []
    if td_warning is not None:
        qc_warnings.append(td_warning)
    for top in imported:
        if top.qc_summary:
            summary = _json.loads(top.qc_summary)
            qc_warnings.extend(summary.get('messages', []))

    if qc_warnings:
        _log.warning('qc_warnings', extra={'event': {
            'operation': 'import_tops', 'phase': 'qc_warnings',
            'warnings': qc_warnings,
        }})

    return imported, qc_warnings


def import_tops_csv(
    session: Session,
    well_id: str | None,
    csv_path: Path | str,
    depth_ref: str = 'MD',
    *,
    column_map: dict[str, str] | None = None,
    ignored_columns: list[str] | None = None,
    strat_units_path: Path | str | None = None,
    strat_ranks_path: Path | str | None = None,
    create_new_well: bool = False,
    top_set_id: int | None = None,
) -> tuple[list[FormationTopModel], list[str]]:
    path = Path(csv_path)
    fieldnames, rows = _read_csv_rows(path)
    if column_map or ignored_columns:
        fieldnames, rows = _apply_column_map(fieldnames, rows, column_map or {}, ignored_columns)
    return _import_tops_rows(
        session,
        well_id,
        path,
        fieldnames,
        rows,
        depth_ref,
        strat_units_path=strat_units_path,
        strat_ranks_path=strat_ranks_path,
        create_new_well=create_new_well,
        top_set_id=top_set_id,
    )


def import_tops_rows(
    session: Session,
    well_id: str | None,
    source_path: Path | str,
    fieldnames: list[str],
    rows: list[dict[str, str]],
    depth_ref: str = 'MD',
    *,
    strat_units_path: Path | str | None = None,
    strat_ranks_path: Path | str | None = None,
    create_new_well: bool = False,
    top_set_id: int | None = None,
) -> tuple[list[FormationTopModel], list[str]]:
    return _import_tops_rows(
        session,
        well_id,
        Path(source_path),
        fieldnames,
        rows,
        depth_ref,
        strat_units_path=strat_units_path,
        strat_ranks_path=strat_ranks_path,
        create_new_well=create_new_well,
        top_set_id=top_set_id,
    )


def import_tops_rows_multi(
    session: Session,
    source_path: Path | str,
    fieldnames: list[str],
    rows: list[dict[str, str]],
    depth_ref: str = 'MD',
    *,
    strat_units_path: Path | str | None = None,
    strat_ranks_path: Path | str | None = None,
    create_new_well: bool = False,
    top_set_id: int | None = None,
) -> tuple[list[FormationTopModel], list[str], list[str], int]:
    path = Path(source_path)
    if not _has_multi_well_rows(rows):
        imported, warnings = _import_tops_rows(
            session,
            None,
            path,
            fieldnames,
            rows,
            depth_ref,
            strat_units_path=strat_units_path,
            strat_ranks_path=strat_ranks_path,
            create_new_well=create_new_well,
            top_set_id=top_set_id,
        )
        well_ids = sorted({top.well_id for top in imported})
        return imported, warnings, well_ids, len(rows)

    imported_all: list[FormationTopModel] = []
    qc_warnings: list[str] = []
    for _name, group_rows in _group_rows_by_well_name(rows):
        imported, warnings = _import_tops_rows(
            session,
            None,
            path,
            fieldnames,
            group_rows,
            depth_ref,
            strat_units_path=strat_units_path,
            strat_ranks_path=strat_ranks_path,
            create_new_well=create_new_well,
            top_set_id=top_set_id,
        )
        imported_all.extend(imported)
        qc_warnings.extend(warnings)
    well_ids = sorted({top.well_id for top in imported_all})
    return imported_all, qc_warnings, well_ids, len(rows)


def import_tops_csv_multi(
    session: Session,
    csv_path: Path | str,
    depth_ref: str = 'MD',
    *,
    column_map: dict[str, str] | None = None,
    ignored_columns: list[str] | None = None,
    strat_units_path: Path | str | None = None,
    strat_ranks_path: Path | str | None = None,
    create_new_well: bool = False,
    top_set_id: int | None = None,
) -> tuple[list[FormationTopModel], list[str], list[str], int]:
    path = Path(csv_path)
    fieldnames, rows = _read_csv_rows(path)
    if column_map or ignored_columns:
        fieldnames, rows = _apply_column_map(fieldnames, rows, column_map or {}, ignored_columns)
    return import_tops_rows_multi(
        session,
        path,
        fieldnames,
        rows,
        depth_ref,
        strat_units_path=strat_units_path,
        strat_ranks_path=strat_ranks_path,
        create_new_well=create_new_well,
        top_set_id=top_set_id,
    )
