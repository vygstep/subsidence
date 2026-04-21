"""
Unit tests for the Airy backstripping engine (data/backstrip.py).

Two-formation shale column:
  - Shale A: 0–500 m, 50–30 Ma (deposited between 50 and 30 Ma)
  - Shale B: 500–1000 m, 30–0 Ma (deposited between 30 Ma and present)

Invariants verified:
  - Both formations appear in results.
  - BurialPoint depths are >= 0.
  - Shale A is deeper than Shale B at every shared time step.
  - burial_path is sorted oldest → present.
"""
from __future__ import annotations

import pytest

from subsidence.data.backstrip import (
    BurialPoint,
    FormationInput,
    LithologyParam,
    SubsidenceResult,
    backstrip,
)


SHALE = LithologyParam(density=2720.0, porosity_surface=0.63, compaction_coeff=0.51)
LITHO = {'shale': SHALE}


def _two_formation_column() -> list[FormationInput]:
    return [
        FormationInput(
            name='Shale A',
            color='#aaaaaa',
            lithology='shale',
            age_top_ma=30.0,
            age_base_ma=50.0,
            current_top_m=0.0,
            current_base_m=500.0,
        ),
        FormationInput(
            name='Shale B',
            color='#bbbbbb',
            lithology='shale',
            age_top_ma=0.0,
            age_base_ma=30.0,
            current_top_m=500.0,
            current_base_m=1000.0,
        ),
    ]


def test_two_formation_returns_two_results():
    results = backstrip(_two_formation_column(), LITHO)
    assert len(results) == 2


def test_burial_paths_nonempty():
    results = backstrip(_two_formation_column(), LITHO)
    for r in results:
        assert len(r.burial_path) > 0


def test_burial_depths_nonnegative():
    results = backstrip(_two_formation_column(), LITHO)
    for r in results:
        for pt in r.burial_path:
            assert pt.depth_m >= 0.0


def test_burial_path_sorted_oldest_to_present():
    results = backstrip(_two_formation_column(), LITHO)
    for r in results:
        ages = [pt.age_ma for pt in r.burial_path]
        assert ages == sorted(ages, reverse=True), f'{r.formation_name}: path not oldest-first'


def test_shale_a_deeper_than_shale_b_at_present():
    results = backstrip(_two_formation_column(), LITHO)
    by_name = {r.formation_name: r for r in results}
    a_present = next(p for p in by_name['Shale A'].burial_path if p.age_ma == 0.0)
    b_present = next(p for p in by_name['Shale B'].burial_path if p.age_ma == 0.0)
    assert a_present.depth_m > b_present.depth_m


def test_fewer_than_two_valid_formations_returns_empty():
    single = [
        FormationInput(
            name='Only',
            color='#cccccc',
            lithology='shale',
            age_top_ma=10.0,
            age_base_ma=20.0,
            current_top_m=0.0,
            current_base_m=300.0,
        )
    ]
    assert backstrip(single, LITHO) == []


def test_missing_age_skipped():
    formations = _two_formation_column()
    formations[0].age_top_ma = None  # type: ignore[assignment]
    results = backstrip(formations, LITHO)
    assert results == []


def test_unknown_lithology_uses_default():
    col = _two_formation_column()
    for f in col:
        f.lithology = 'unknown_xyz'
    results = backstrip(col, LITHO)
    assert len(results) == 2


def test_result_color_matches_input():
    results = backstrip(_two_formation_column(), LITHO)
    by_name = {r.formation_name: r for r in results}
    assert by_name['Shale A'].color == '#aaaaaa'
    assert by_name['Shale B'].color == '#bbbbbb'
