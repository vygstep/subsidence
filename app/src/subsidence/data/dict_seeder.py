from __future__ import annotations

import csv
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .schema import (
    CompactionModel,
    CompactionModelParam,
    CompactionPreset,
    CurveDictEntry,
    CurveMnemonicEntry,
    CurveMnemonicSet,
    LithologyDictEntry,
    LithologyPattern,
    LithologyPatternPalette,
    LithologySet,
    LithologySetEntry,
    MeasurementUnit,
    MeasurementUnitAlias,
    SeaLevelCurve,
    SeaLevelPoint,
    StratChart,
    StratUnit,
    UnitDimension,
)
from .lithology_patterns import sanitize_svg_content
from .unit_registry import normalize_unit_key


_UNIT_DIMENSIONS = [
    {
        'code': 'depth',
        'display_name': 'Depth',
        'description': 'Measured depth and true vertical depth values.',
        'engine_unit_code': 'depth_m',
        'sort_order': 10,
    },
    {
        'code': 'thickness',
        'display_name': 'Thickness',
        'description': 'Layer, erosion, and interval thickness values.',
        'engine_unit_code': 'thickness_m',
        'sort_order': 20,
    },
    {
        'code': 'density',
        'display_name': 'Density',
        'description': 'Bulk, grain, and matrix density values.',
        'engine_unit_code': 'density_kg_m3',
        'sort_order': 30,
    },
    {
        'code': 'fraction',
        'display_name': 'Fraction',
        'description': 'Porosity, lithology shares, and other unitless ratios.',
        'engine_unit_code': 'fraction_vv',
        'sort_order': 40,
    },
    {
        'code': 'compaction_coeff',
        'display_name': 'Compaction coefficient',
        'description': 'Athy compaction coefficient values.',
        'engine_unit_code': 'compaction_km_inv',
        'sort_order': 50,
    },
    {
        'code': 'slowness',
        'display_name': 'Slowness',
        'description': 'Acoustic and sonic slowness curves.',
        'engine_unit_code': 'slowness_us_m',
        'sort_order': 60,
    },
    {
        'code': 'resistivity',
        'display_name': 'Resistivity',
        'description': 'Electrical resistivity curves.',
        'engine_unit_code': 'resistivity_ohm_m',
        'sort_order': 70,
    },
    {
        'code': 'gamma_ray',
        'display_name': 'Gamma ray',
        'description': 'Gamma ray curves.',
        'engine_unit_code': 'gamma_gapi',
        'sort_order': 80,
    },
    {
        'code': 'caliper',
        'display_name': 'Caliper',
        'description': 'Borehole caliper diameter curves.',
        'engine_unit_code': 'caliper_in',
        'sort_order': 90,
    },
]


_MEASUREMENT_UNITS = [
    {'code': 'depth_m', 'dimension_code': 'depth', 'symbol': 'm', 'display_name': 'meter', 'factor': 1.0, 'offset': 0.0, 'sort_order': 10},
    {'code': 'depth_ft', 'dimension_code': 'depth', 'symbol': 'ft', 'display_name': 'foot', 'factor': 0.3048, 'offset': 0.0, 'sort_order': 20},
    {'code': 'depth_km', 'dimension_code': 'depth', 'symbol': 'km', 'display_name': 'kilometer', 'factor': 1000.0, 'offset': 0.0, 'sort_order': 30},
    {'code': 'thickness_m', 'dimension_code': 'thickness', 'symbol': 'm', 'display_name': 'meter', 'factor': 1.0, 'offset': 0.0, 'sort_order': 10},
    {'code': 'thickness_ft', 'dimension_code': 'thickness', 'symbol': 'ft', 'display_name': 'foot', 'factor': 0.3048, 'offset': 0.0, 'sort_order': 20},
    {'code': 'thickness_km', 'dimension_code': 'thickness', 'symbol': 'km', 'display_name': 'kilometer', 'factor': 1000.0, 'offset': 0.0, 'sort_order': 30},
    {'code': 'density_kg_m3', 'dimension_code': 'density', 'symbol': 'kg/m3', 'display_name': 'kilogram per cubic meter', 'factor': 1.0, 'offset': 0.0, 'sort_order': 10},
    {'code': 'density_g_cc', 'dimension_code': 'density', 'symbol': 'g/cc', 'display_name': 'gram per cubic centimeter', 'factor': 1000.0, 'offset': 0.0, 'sort_order': 20},
    {'code': 'fraction_vv', 'dimension_code': 'fraction', 'symbol': 'v/v', 'display_name': 'volume fraction', 'factor': 1.0, 'offset': 0.0, 'sort_order': 10},
    {'code': 'fraction_percent', 'dimension_code': 'fraction', 'symbol': '%', 'display_name': 'percent', 'factor': 0.01, 'offset': 0.0, 'sort_order': 20},
    {'code': 'compaction_km_inv', 'dimension_code': 'compaction_coeff', 'symbol': 'km^-1', 'display_name': 'inverse kilometer', 'factor': 1.0, 'offset': 0.0, 'sort_order': 10},
    {'code': 'compaction_m_inv', 'dimension_code': 'compaction_coeff', 'symbol': 'm^-1', 'display_name': 'inverse meter', 'factor': 1000.0, 'offset': 0.0, 'sort_order': 20},
    {'code': 'slowness_us_m', 'dimension_code': 'slowness', 'symbol': 'us/m', 'display_name': 'microsecond per meter', 'factor': 1.0, 'offset': 0.0, 'sort_order': 10},
    {'code': 'slowness_us_ft', 'dimension_code': 'slowness', 'symbol': 'us/ft', 'display_name': 'microsecond per foot', 'factor': 3.280839895, 'offset': 0.0, 'sort_order': 20},
    {'code': 'resistivity_ohm_m', 'dimension_code': 'resistivity', 'symbol': 'ohm.m', 'display_name': 'ohm meter', 'factor': 1.0, 'offset': 0.0, 'sort_order': 10},
    {'code': 'gamma_gapi', 'dimension_code': 'gamma_ray', 'symbol': 'gAPI', 'display_name': 'gamma API unit', 'factor': 1.0, 'offset': 0.0, 'sort_order': 10},
    {'code': 'caliper_in', 'dimension_code': 'caliper', 'symbol': 'in', 'display_name': 'inch', 'factor': 1.0, 'offset': 0.0, 'sort_order': 10},
    {'code': 'caliper_mm', 'dimension_code': 'caliper', 'symbol': 'mm', 'display_name': 'millimeter', 'factor': 0.03937007874015748, 'offset': 0.0, 'sort_order': 20},
    {'code': 'caliper_cm', 'dimension_code': 'caliper', 'symbol': 'cm', 'display_name': 'centimeter', 'factor': 0.3937007874015748, 'offset': 0.0, 'sort_order': 30},
]


_UNIT_ALIASES = {
    'depth_m': ['m', 'meter', 'meters', 'metre', 'metres'],
    'depth_ft': ['ft', 'foot', 'feet'],
    'depth_km': ['km', 'kilometer', 'kilometers', 'kilometre', 'kilometres'],
    'thickness_m': ['m', 'meter', 'meters', 'metre', 'metres'],
    'thickness_ft': ['ft', 'foot', 'feet'],
    'thickness_km': ['km', 'kilometer', 'kilometers', 'kilometre', 'kilometres'],
    'density_kg_m3': ['kg/m3', 'kg/m^3', 'kg/m\u00b3'],
    'density_g_cc': ['g/cc', 'g/cm3', 'g/cm^3', 'g/cm\u00b3', 'g/c3'],
    'fraction_vv': ['v/v', 'fraction', 'frac', 'ratio'],
    'fraction_percent': ['%', 'percent', 'pct'],
    'compaction_km_inv': ['km^-1', 'km-1', '1/km'],
    'compaction_m_inv': ['m^-1', 'm-1', '1/m'],
    'slowness_us_m': ['us/m', 'usec/m', 'microsecond/m', 'microseconds/m'],
    'slowness_us_ft': ['us/ft', 'usec/ft', 'microsecond/ft', 'microseconds/ft'],
    'resistivity_ohm_m': ['ohm.m', 'ohmm', 'ohm-m', 'ohm m'],
    'gamma_gapi': ['api', 'gapi', 'gAPI'],
    'caliper_in': ['in', 'inch', 'inches'],
    'caliper_mm': ['mm', 'millimeter', 'millimeters', 'millimetre', 'millimetres'],
    'caliper_cm': ['cm', 'centimeter', 'centimeters', 'centimetre', 'centimetres'],
}


def _seed_curve_entries(session: Session, csv_path: Path) -> None:
    with csv_path.open('r', encoding='utf-8', newline='') as handle:
        for row in csv.DictReader(handle):
            session.add(
                CurveDictEntry(
                    scope=row['scope'],
                    pattern=row['pattern'],
                    is_regex=bool(int(row['is_regex'])),
                    priority=int(row['priority']),
                    family_code=row['family_code'] or None,
                    canonical_mnemonic=row['canonical_mnemonic'] or None,
                    canonical_unit=row['canonical_unit'] or None,
                    is_active=True,
                )
            )


def _compaction_preset_seed_rows(csv_path: Path) -> list[dict[str, str]]:
    if not csv_path.exists():
        return []
    rows: list[dict[str, str]] = []
    with csv_path.open('r', encoding='utf-8', newline='') as handle:
        for row in csv.DictReader(handle):
            source_code = (
                row.get('source_lithology_code')
                or row.get('lithology_code')
                or row.get('preset_code')
                or ''
            ).strip()
            if not source_code:
                continue
            rows.append({
                'preset_code': (row.get('preset_code') or source_code).strip(),
                'source_lithology_code': source_code,
                'name': (row.get('name') or row.get('display_name') or source_code).strip(),
                'density': row.get('density') or '2650.0',
                'porosity_surface': row.get('porosity_surface') or '0.50',
                'compaction_coeff': row.get('compaction_coeff') or '0.30',
                'description': row.get('description') or '',
                'sort_order': row.get('sort_order') or '0',
            })
    return sorted(rows, key=lambda item: (int(item['sort_order'] or 0), item['source_lithology_code']))


def _compaction_defaults_by_lithology(csv_path: Path) -> dict[str, dict[str, str]]:
    return {row['source_lithology_code']: row for row in _compaction_preset_seed_rows(csv_path)}


def _seed_lithology_entries(session: Session, csv_path: Path, compaction_csv_path: Path) -> None:
    compaction_defaults = _compaction_defaults_by_lithology(compaction_csv_path)
    with csv_path.open('r', encoding='utf-8', newline='') as handle:
        for row in csv.DictReader(handle):
            compaction_row = compaction_defaults.get(row['lithology_code'], row)
            session.add(
                LithologyDictEntry(
                    lithology_code=row['lithology_code'],
                    display_name=row['display_name'],
                    color_hex=row['color_hex'],
                    pattern_id=row['pattern_id'] or None,
                    description=row.get('description') or None,
                    sort_order=int(row['sort_order']),
                    density=float(compaction_row.get('density') or 2650.0),
                    porosity_surface=float(compaction_row.get('porosity_surface') or 0.50),
                    compaction_coeff=float(compaction_row.get('compaction_coeff') or 0.30),
                )
            )


def _migrate_lithology_compaction_params(session: Session, csv_path: Path) -> None:
    """Back-fill compaction columns for rows seeded before Phase 4."""
    defaults = _compaction_defaults_by_lithology(csv_path)

    rows = session.scalars(select(LithologyDictEntry)).all()
    for entry in rows:
        d = defaults.get(entry.lithology_code)
        if d is None:
            continue
        if entry.density == 2650.0 and entry.porosity_surface == 0.50 and entry.compaction_coeff == 0.30:
            # still at schema defaults — replace with literature values
            entry.density = float(d.get('density') or 2650.0)
            entry.porosity_surface = float(d.get('porosity_surface') or 0.50)
            entry.compaction_coeff = float(d.get('compaction_coeff') or 0.30)


def _seed_strat_units(session: Session, csv_path: Path, chart: StratChart) -> None:
    pending: dict[int, dict[str, str]] = {}
    with csv_path.open('r', encoding='utf-8-sig', newline='') as handle:
        for row in csv.DictReader(handle):
            unit_id_raw = (row.get('unit_id') or '').strip()
            name = (row.get('unit_name') or '').strip()
            if not unit_id_raw or not name:
                continue
            pending[int(unit_id_raw)] = row

    inserted_ids: set[int] = set()
    while pending:
        inserted_in_pass = False
        for unit_id in list(pending):
            row = pending[unit_id]
            parent_id_raw = (row.get('parent_unit_id') or '').strip()
            parent_id = int(parent_id_raw) if parent_id_raw else None
            if parent_id is not None and parent_id not in inserted_ids:
                continue

            session.add(
                StratUnit(
                    id=unit_id,
                    name=(row.get('unit_name') or '').strip(),
                    rank=(row.get('rank_name') or '').strip() or None,
                    parent_id=parent_id,
                    age_top_ma=float(row['start_age_ma']) if (row.get('start_age_ma') or '').strip() else None,
                    age_base_ma=float(row['end_age_ma']) if (row.get('end_age_ma') or '').strip() else None,
                    lithology=None,
                    color_hex=(row.get('html_rgb_hash') or '').strip() or None,
                    chart_id=chart.id,
                )
            )
            inserted_ids.add(unit_id)
            pending.pop(unit_id)
            inserted_in_pass = True

        if not inserted_in_pass:
            raise ValueError('Unable to seed strat_units due to unresolved parent references')


def _migrate_orphan_strat_units(session: Session, csv_path: Path) -> None:
    orphan_count = session.scalar(
        select(func.count()).select_from(StratUnit).where(StratUnit.chart_id.is_(None))
    ) or 0
    if orphan_count == 0:
        return

    default_chart = session.scalar(select(StratChart).where(StratChart.name == 'ICS 2023'))
    if default_chart is None:
        no_charts = session.scalar(select(func.count()).select_from(StratChart)) == 0
        default_chart = StratChart(name='ICS 2023', source_path=str(csv_path), is_active=no_charts)
        session.add(default_chart)
        session.flush()
    elif default_chart.source_path != str(csv_path):
        default_chart.source_path = str(csv_path)

    session.execute(
        StratUnit.__table__.update()
        .where(StratUnit.chart_id.is_(None))
        .values(chart_id=default_chart.id)
    )


def _normalize_builtin_chart(session: Session, csv_path: Path) -> None:
    charts = session.scalars(select(StratChart).order_by(StratChart.id.asc())).all()
    for chart in charts:
        source_name = Path(chart.source_path).name.lower() if chart.source_path else ''
        if chart.name == 'ICS 2023' or source_name in {'ics_chart2023.csv', 'ics_chart2023_units.csv'}:
            chart.name = 'ICS 2023'
            chart.source_path = str(csv_path)


def _seed_builtin_compaction_model(session: Session) -> None:
    """Create the built-in (read-only) compaction model from LithologyDictEntry values."""
    existing = session.scalar(select(CompactionModel).where(CompactionModel.is_builtin.is_(True)))
    if existing is not None:
        return

    litho_rows = session.scalars(select(LithologyDictEntry)).all()
    if not litho_rows:
        return

    model = CompactionModel(name='Default (built-in)', is_builtin=True, is_active=True)
    session.add(model)
    session.flush()

    for row in litho_rows:
        session.add(CompactionModelParam(
            model_id=model.id,
            lithology_code=row.lithology_code,
            density=row.density,
            porosity_surface=row.porosity_surface,
            compaction_coeff=row.compaction_coeff,
        ))


def _seed_builtin_compaction_presets(session: Session, csv_path: Path) -> None:
    """Create one built-in compaction preset per computational lithology."""
    seed_rows = _compaction_preset_seed_rows(csv_path)
    if not seed_rows:
        return

    existing = {
        row.source_lithology_code: row
        for row in session.scalars(
            select(CompactionPreset).where(CompactionPreset.is_builtin.is_(True))
        ).all()
        if row.source_lithology_code
    }

    for row in seed_rows:
        source_code = row['source_lithology_code']
        density = float(row.get('density') or 2650.0)
        porosity = float(row.get('porosity_surface') or 0.50)
        coeff = float(row.get('compaction_coeff') or 0.30)
        if source_code in existing:
            existing[source_code].name = row['name']
            existing[source_code].density = density
            existing[source_code].porosity_surface = porosity
            existing[source_code].compaction_coeff = coeff
            existing[source_code].description = row.get('description') or None
            continue
        session.add(
            CompactionPreset(
                name=row['name'],
                origin='builtin',
                is_builtin=True,
                source_lithology_code=source_code,
                density=density,
                porosity_surface=porosity,
                compaction_coeff=coeff,
                description=row.get('description') or None,
            )
        )


def _seed_builtin_lithology_set(session: Session, csv_path: Path) -> None:
    """Create the built-in Default Lithologies set from an explicit set seed file."""
    default_set = session.scalar(
        select(LithologySet).where(LithologySet.is_builtin.is_(True)).order_by(LithologySet.id.asc())
    )
    if default_set is None:
        default_set = LithologySet(name='Default Lithologies', is_builtin=True)
        session.add(default_set)
        session.flush()
    elif default_set.name != 'Default Lithologies':
        default_set.name = 'Default Lithologies'

    existing_by_code = {
        row.lithology_code: row
        for row in session.scalars(
            select(LithologySetEntry).where(LithologySetEntry.set_id == default_set.id)
        ).all()
    }
    preset_by_code = {
        row.source_lithology_code: row.id
        for row in session.scalars(
            select(CompactionPreset).where(
                CompactionPreset.is_builtin.is_(True),
                CompactionPreset.source_lithology_code.is_not(None),
            )
        ).all()
        if row.source_lithology_code
    }

    if csv_path.exists():
        with csv_path.open('r', encoding='utf-8', newline='') as handle:
            seed_rows = list(csv.DictReader(handle))
    else:
        seed_rows = [
            {
                'lithology_code': row.lithology_code,
                'display_name': row.display_name,
                'color_hex': row.color_hex,
                'pattern_id': row.pattern_id or '',
                'sort_order': str(row.sort_order),
                'compaction_preset_code': row.lithology_code,
            }
            for row in session.scalars(
                select(LithologyDictEntry).order_by(LithologyDictEntry.sort_order.asc(), LithologyDictEntry.id.asc())
            ).all()
        ]

    for row in seed_rows:
        lithology_code = row['lithology_code']
        preset_code = row.get('compaction_preset_code') or lithology_code
        preset_id = preset_by_code.get(preset_code)
        existing = existing_by_code.get(lithology_code)
        if existing is None:
            session.add(
                LithologySetEntry(
                    set_id=default_set.id,
                    lithology_code=lithology_code,
                    display_name=row['display_name'],
                    color_hex=row['color_hex'],
                    pattern_id=row.get('pattern_id') or None,
                    sort_order=int(row.get('sort_order') or 0),
                    compaction_preset_id=preset_id,
                )
            )
            continue
        existing.display_name = row['display_name']
        existing.color_hex = row['color_hex']
        existing.pattern_id = row.get('pattern_id') or None
        existing.sort_order = int(row.get('sort_order') or 0)
        existing.compaction_preset_id = preset_id


def _seed_builtin_lithology_patterns(session: Session, palette_dir: Path) -> None:
    manifest_path = palette_dir / 'manifest.csv'
    if not manifest_path.exists():
        return

    palette = session.scalar(
        select(LithologyPatternPalette)
        .where(LithologyPatternPalette.is_builtin.is_(True), LithologyPatternPalette.origin == 'equinor')
        .order_by(LithologyPatternPalette.id.asc())
    )
    if palette is None:
        palette = LithologyPatternPalette(
            name='Equinor Lithology Patterns',
            origin='equinor',
            is_builtin=True,
            source_url='https://github.com/equinor/lithology-patterns',
            license_name='MIT',
            description='Built-in SVG lithology patterns sourced from equinor/lithology-patterns assets/svg.',
            sort_order=0,
        )
        session.add(palette)
        session.flush()
    else:
        palette.name = 'Equinor Lithology Patterns'
        palette.source_url = 'https://github.com/equinor/lithology-patterns'
        palette.license_name = 'MIT'
        palette.description = 'Built-in SVG lithology patterns sourced from equinor/lithology-patterns assets/svg.'
        palette.sort_order = 0

    existing_by_code = {
        row.code: row
        for row in session.scalars(select(LithologyPattern).where(LithologyPattern.palette_id == palette.id)).all()
    }

    with manifest_path.open('r', encoding='utf-8', newline='') as handle:
        for row in csv.DictReader(handle):
            code = row['code']
            svg_path = palette_dir / row['svg_path']
            if not svg_path.exists():
                continue
            svg_content, inferred_width, inferred_height = sanitize_svg_content(svg_path.read_text(encoding='utf-8'))
            tile_width = int(row.get('tile_width') or inferred_width)
            tile_height = int(row.get('tile_height') or inferred_height)
            existing = existing_by_code.get(code)
            if existing is None:
                session.add(
                    LithologyPattern(
                        palette_id=palette.id,
                        code=code,
                        display_name=row['display_name'],
                        svg_content=svg_content,
                        source_code=row.get('source_code') or None,
                        source_name=row.get('source_name') or None,
                        source_path=row.get('svg_path') or None,
                        tile_width=tile_width,
                        tile_height=tile_height,
                        sort_order=int(row.get('sort_order') or 0),
                    )
                )
                continue
            existing.display_name = row['display_name']
            existing.svg_content = svg_content
            existing.source_code = row.get('source_code') or None
            existing.source_name = row.get('source_name') or None
            existing.source_path = row.get('svg_path') or None
            existing.tile_width = tile_width
            existing.tile_height = tile_height
            existing.sort_order = int(row.get('sort_order') or 0)


def _seed_builtin_mnemonic_set(session: Session, csv_path: Path) -> None:
    """Create the built-in Default Mnemonics set from the flat curve_families.csv."""
    default_set = session.scalar(
        select(CurveMnemonicSet).where(CurveMnemonicSet.is_builtin.is_(True)).order_by(CurveMnemonicSet.id.asc())
    )
    if default_set is None:
        default_set = CurveMnemonicSet(name='Default Mnemonics', is_builtin=True, sort_order=0)
        session.add(default_set)
        session.flush()
    elif default_set.name != 'Default Mnemonics':
        default_set.name = 'Default Mnemonics'

    existing_by_pattern = {
        row.pattern: row
        for row in session.scalars(
            select(CurveMnemonicEntry).where(CurveMnemonicEntry.set_id == default_set.id)
        ).all()
    }

    with csv_path.open('r', encoding='utf-8', newline='') as handle:
        for row in csv.DictReader(handle):
            pattern = row['pattern']
            existing = existing_by_pattern.get(pattern)
            if existing is None:
                session.add(
                    CurveMnemonicEntry(
                        set_id=default_set.id,
                        pattern=pattern,
                        is_regex=bool(int(row['is_regex'])),
                        priority=int(row['priority']),
                        family_code=row['family_code'] or None,
                        canonical_mnemonic=row['canonical_mnemonic'] or None,
                        canonical_unit=row['canonical_unit'] or None,
                        is_active=True,
                    )
                )
                continue
            existing.is_regex = bool(int(row['is_regex']))
            existing.priority = int(row['priority'])
            existing.family_code = row['family_code'] or None
            existing.canonical_mnemonic = row['canonical_mnemonic'] or None
            existing.canonical_unit = row['canonical_unit'] or None


def _seed_measurement_units(session: Session) -> None:
    """Create the built-in measurement unit dictionary used by importers and calculations."""
    dimensions_by_code = {
        row.code: row
        for row in session.scalars(select(UnitDimension)).all()
    }
    for seed in _UNIT_DIMENSIONS:
        existing = dimensions_by_code.get(seed['code'])
        if existing is None:
            session.add(
                UnitDimension(
                    code=seed['code'],
                    display_name=seed['display_name'],
                    description=seed['description'],
                    engine_unit_code=seed['engine_unit_code'],
                    is_builtin=True,
                    sort_order=seed['sort_order'],
                )
            )
            continue
        existing.display_name = seed['display_name']
        existing.description = seed['description']
        existing.engine_unit_code = seed['engine_unit_code']
        existing.is_builtin = True
        existing.sort_order = seed['sort_order']

    session.flush()

    units_by_code = {
        row.code: row
        for row in session.scalars(select(MeasurementUnit)).all()
    }
    unit_dimension_by_code = {seed['code']: seed['dimension_code'] for seed in _MEASUREMENT_UNITS}

    for seed in _MEASUREMENT_UNITS:
        existing = units_by_code.get(seed['code'])
        if existing is None:
            session.add(
                MeasurementUnit(
                    code=seed['code'],
                    dimension_code=seed['dimension_code'],
                    symbol=seed['symbol'],
                    display_name=seed['display_name'],
                    to_engine_factor=seed['factor'],
                    to_engine_offset=seed['offset'],
                    is_builtin=True,
                    is_active=True,
                    sort_order=seed['sort_order'],
                )
            )
            continue
        existing.dimension_code = seed['dimension_code']
        existing.symbol = seed['symbol']
        existing.display_name = seed['display_name']
        existing.to_engine_factor = seed['factor']
        existing.to_engine_offset = seed['offset']
        existing.is_builtin = True
        existing.is_active = True
        existing.sort_order = seed['sort_order']

    session.flush()

    aliases_by_key = {
        (row.dimension_code, row.normalized_alias): row
        for row in session.scalars(select(MeasurementUnitAlias)).all()
    }
    for unit_code, aliases in _UNIT_ALIASES.items():
        dimension_code = unit_dimension_by_code[unit_code]
        for alias in aliases:
            normalized = normalize_unit_key(alias)
            existing = aliases_by_key.get((dimension_code, normalized))
            if existing is None:
                existing = MeasurementUnitAlias(
                    dimension_code=dimension_code,
                    unit_code=unit_code,
                    alias=alias,
                    normalized_alias=normalized,
                    is_builtin=True,
                    is_active=True,
                )
                session.add(existing)
                aliases_by_key[(dimension_code, normalized)] = existing
            existing.unit_code = unit_code
            existing.is_builtin = True
            existing.is_active = True


_SEA_LEVEL_SOURCE = 'Kocsis & Scotese (2022), PALAEO3, doi:10.1016/j.palaeo.2022.111176, binned models supplement'


def _seed_builtin_sea_level_curves(session: Session, csv_path: Path) -> None:
    if not csv_path.exists():
        return
    by_name: dict[str, list[tuple[float, float]]] = {}
    with csv_path.open(newline='', encoding='utf-8') as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            name = row['curve_name'].strip()
            age = float(row['age_ma'])
            level = float(row['sea_level_m'])
            by_name.setdefault(name, []).append((age, level))

    existing: dict[str, SeaLevelCurve] = {
        c.name: c
        for c in session.scalars(select(SeaLevelCurve).where(SeaLevelCurve.is_builtin.is_(True))).all()
    }

    for name, points in by_name.items():
        curve = existing.get(name)
        if curve is None:
            curve = SeaLevelCurve(name=name, source=_SEA_LEVEL_SOURCE, is_builtin=True)
            session.add(curve)
            session.flush()
        else:
            curve.source = _SEA_LEVEL_SOURCE

        existing_pt_count = session.scalar(
            select(func.count()).select_from(SeaLevelPoint).where(SeaLevelPoint.curve_id == curve.id)
        ) or 0
        if existing_pt_count != len(points):
            session.execute(
                SeaLevelPoint.__table__.delete().where(SeaLevelPoint.curve_id == curve.id)
            )
            session.flush()
            for age, level in points:
                session.add(SeaLevelPoint(curve_id=curve.id, age_ma=age, sea_level_m=level))


def seed_dictionaries(session: Session, db_path: Path) -> None:
    del db_path
    seed_dir = Path(__file__).parent / 'dictionaries'

    has_curve_rows = session.execute(select(CurveDictEntry.id).limit(1)).scalar_one_or_none() is not None
    has_lithology_rows = session.execute(select(LithologyDictEntry.id).limit(1)).scalar_one_or_none() is not None
    has_strat_rows = session.execute(select(StratUnit.id).limit(1)).scalar_one_or_none() is not None
    lithology_core_path = seed_dir / 'lithology' / 'lithology_core.csv'
    compaction_presets_path = seed_dir / 'compaction' / 'compaction_presets.csv'
    default_lithologies_path = seed_dir / 'lithology_sets' / 'default_lithologies.csv'
    builtin_chart_path = seed_dir / 'strat_charts' / 'ics_2023.csv'

    if not has_curve_rows:
        _seed_curve_entries(session, seed_dir / 'curve_families.csv')
    if not has_lithology_rows:
        _seed_lithology_entries(session, lithology_core_path, compaction_presets_path)
    else:
        _migrate_lithology_compaction_params(session, compaction_presets_path)
    if not has_strat_rows:
        if builtin_chart_path.exists():
            default_chart = StratChart(name='ICS 2023', source_path=str(builtin_chart_path), is_active=True)
            session.add(default_chart)
            session.flush()
            _seed_strat_units(session, builtin_chart_path, default_chart)
    else:
        _migrate_orphan_strat_units(session, builtin_chart_path)

    if builtin_chart_path.exists():
        _normalize_builtin_chart(session, builtin_chart_path)

    _seed_builtin_compaction_model(session)
    _seed_builtin_compaction_presets(session, compaction_presets_path)
    _seed_builtin_lithology_patterns(session, seed_dir / 'lithology_patterns' / 'equinor')
    _seed_builtin_lithology_set(session, default_lithologies_path)
    _seed_builtin_mnemonic_set(session, seed_dir / 'curve_families.csv')
    _seed_measurement_units(session)
    _seed_builtin_sea_level_curves(session, seed_dir / 'sea_level' / 'sea_level_binned_models.csv')
