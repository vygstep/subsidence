"""Integration tests for tops CSV importer — deduplication and water_depth auto-set."""
from __future__ import annotations

import csv
from pathlib import Path

import pytest
from sqlalchemy.orm import Session

from subsidence.data.importers.tops import import_tops_csv
from subsidence.data.schema import WellModel


def _well(session: Session, well_id: str = 'w1', kb_elev: float = 0.0) -> WellModel:
    w = WellModel(id=well_id, name='Test', kb_elev=kb_elev, td_md=5000.0)
    session.add(w)
    session.flush()
    return w


def _write_csv(tmp_path: Path, rows: list[dict]) -> Path:
    p = tmp_path / 'tops.csv'
    with p.open('w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    return p


# ---------------------------------------------------------------------------
# age deduplication
# ---------------------------------------------------------------------------

def test_duplicate_ages_shallower_keeps_age(test_db: Session, tmp_path):
    _well(test_db, kb_elev=0.0)
    csv_path = _write_csv(tmp_path, [
        {'top_name': 'A', 'depth_md': '500',  'age_ma': '66'},
        {'top_name': 'B', 'depth_md': '1000', 'age_ma': '66'},
        {'top_name': 'C', 'depth_md': '1500', 'age_ma': '100'},
    ])
    picks, _ = import_tops_csv(test_db, 'w1', csv_path)
    by_name = {p.name: p for p in picks}

    assert by_name['A'].age_top_ma == 66.0   # shallowest keeps age
    assert by_name['B'].age_top_ma is None   # deeper duplicate → None
    assert by_name['C'].age_top_ma == 100.0  # unique age unchanged


def test_three_same_ages_only_shallowest_keeps(test_db: Session, tmp_path):
    _well(test_db, kb_elev=0.0)
    csv_path = _write_csv(tmp_path, [
        {'top_name': 'A', 'depth_md': '100', 'age_ma': '45'},
        {'top_name': 'B', 'depth_md': '200', 'age_ma': '45'},
        {'top_name': 'C', 'depth_md': '300', 'age_ma': '45'},
    ])
    picks, _ = import_tops_csv(test_db, 'w1', csv_path)
    by_name = {p.name: p for p in picks}

    assert by_name['A'].age_top_ma == 45.0
    assert by_name['B'].age_top_ma is None
    assert by_name['C'].age_top_ma is None


def test_unique_ages_untouched(test_db: Session, tmp_path):
    _well(test_db, kb_elev=0.0)
    csv_path = _write_csv(tmp_path, [
        {'top_name': 'A', 'depth_md': '100', 'age_ma': '10'},
        {'top_name': 'B', 'depth_md': '200', 'age_ma': '45'},
        {'top_name': 'C', 'depth_md': '300', 'age_ma': '66'},
    ])
    picks, _ = import_tops_csv(test_db, 'w1', csv_path)
    by_name = {p.name: p for p in picks}

    assert by_name['A'].age_top_ma == 10.0
    assert by_name['B'].age_top_ma == 45.0
    assert by_name['C'].age_top_ma == 66.0


# ---------------------------------------------------------------------------
# water_depth_m auto-set from TVDSS — only for age=0 picks
# ---------------------------------------------------------------------------

def test_water_depth_set_for_age_zero_offshore(test_db: Session, tmp_path):
    """kb_elev=30, age=0 pick at depth_md=1530 → TVDSS=1500 → water_depth_m=1500."""
    _well(test_db, kb_elev=30.0)
    csv_path = _write_csv(tmp_path, [
        {'top_name': 'Seabed', 'depth_md': '1530', 'age_ma': '0'},
        {'top_name': 'Bot',    'depth_md': '2000', 'age_ma': '66'},
    ])
    picks, _ = import_tops_csv(test_db, 'w1', csv_path)
    by_name = {p.name: p for p in picks}

    assert by_name['Seabed'].water_depth_m == pytest.approx(1500.0)
    assert by_name['Bot'].water_depth_m == 0.0


def test_water_depth_set_age_zero_land(test_db: Session, tmp_path):
    """kb_elev=200, age=0 pick at depth_md=250 → TVDSS=50 → water_depth_m=50."""
    _well(test_db, kb_elev=200.0)
    csv_path = _write_csv(tmp_path, [
        {'top_name': 'Surface', 'depth_md': '250', 'age_ma': '0'},
        {'top_name': 'Deep',    'depth_md': '800', 'age_ma': '66'},
    ])
    picks, _ = import_tops_csv(test_db, 'w1', csv_path)
    by_name = {p.name: p for p in picks}

    assert by_name['Surface'].water_depth_m == pytest.approx(50.0)


def test_water_depth_not_set_for_nonzero_age(test_db: Session, tmp_path):
    """Picks with age != 0 must not get water_depth auto-set."""
    _well(test_db, kb_elev=30.0)
    csv_path = _write_csv(tmp_path, [
        {'top_name': 'A', 'depth_md': '1530', 'age_ma': '10'},
        {'top_name': 'B', 'depth_md': '2000', 'age_ma': '66'},
    ])
    picks, _ = import_tops_csv(test_db, 'w1', csv_path)

    for p in picks:
        assert p.water_depth_m == 0.0


def test_water_depth_negative_age_zero_above_msl(test_db: Session, tmp_path):
    """kb_elev=500, age=0 pick at depth_md=100 → TVDSS=-400 → water_depth_m=-400."""
    _well(test_db, kb_elev=500.0)
    csv_path = _write_csv(tmp_path, [
        {'top_name': 'Surface', 'depth_md': '100', 'age_ma': '0'},
        {'top_name': 'Deep',    'depth_md': '600', 'age_ma': '66'},
    ])
    picks, _ = import_tops_csv(test_db, 'w1', csv_path)
    by_name = {p.name: p for p in picks}

    assert by_name['Surface'].water_depth_m == pytest.approx(-400.0)
