from __future__ import annotations

import csv
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from .schema import CurveDictEntry, LithologyDictEntry


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
                )
            )


def seed_dictionaries(session: Session, db_path: Path) -> None:
    del db_path
    seed_dir = Path(__file__).parent / 'dictionaries'

    has_curve_rows = session.execute(select(CurveDictEntry.id).limit(1)).scalar_one_or_none() is not None
    has_lithology_rows = session.execute(select(LithologyDictEntry.id).limit(1)).scalar_one_or_none() is not None

    if not has_curve_rows:
        _seed_curve_entries(session, seed_dir / 'curve_families.csv')
    if not has_lithology_rows:
        _seed_lithology_entries(session, seed_dir / 'lithology_defaults.csv')
