from __future__ import annotations

import csv
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .schema import CurveDictEntry, LithologyDictEntry, StratChart, StratUnit


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


def _seed_lithology_entries(session: Session, csv_path: Path) -> None:
    with csv_path.open('r', encoding='utf-8', newline='') as handle:
        for row in csv.DictReader(handle):
            session.add(
                LithologyDictEntry(
                    lithology_code=row['lithology_code'],
                    display_name=row['display_name'],
                    color_hex=row['color_hex'],
                    pattern_id=row['pattern_id'] or None,
                    sort_order=int(row['sort_order']),
                    density=float(row.get('density') or 2650.0),
                    porosity_surface=float(row.get('porosity_surface') or 0.50),
                    compaction_coeff=float(row.get('compaction_coeff') or 0.30),
                )
            )


def _migrate_lithology_compaction_params(session: Session, csv_path: Path) -> None:
    """Back-fill compaction columns for rows seeded before Phase 4."""
    with csv_path.open('r', encoding='utf-8', newline='') as handle:
        defaults = {row['lithology_code']: row for row in csv.DictReader(handle)}

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


def _repo_sample_data_dir() -> Path:
    return Path(__file__).resolve().parents[4] / 'sample_data'


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


def seed_dictionaries(session: Session, db_path: Path) -> None:
    del db_path
    seed_dir = Path(__file__).parent / 'dictionaries'
    sample_dir = _repo_sample_data_dir()

    has_curve_rows = session.execute(select(CurveDictEntry.id).limit(1)).scalar_one_or_none() is not None
    has_lithology_rows = session.execute(select(LithologyDictEntry.id).limit(1)).scalar_one_or_none() is not None
    has_strat_rows = session.execute(select(StratUnit.id).limit(1)).scalar_one_or_none() is not None
    builtin_chart_path = sample_dir / 'ics_chart2023.csv'

    if not has_curve_rows:
        _seed_curve_entries(session, seed_dir / 'curve_families.csv')
    if not has_lithology_rows:
        _seed_lithology_entries(session, seed_dir / 'lithology_defaults.csv')
    else:
        _migrate_lithology_compaction_params(session, seed_dir / 'lithology_defaults.csv')
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
