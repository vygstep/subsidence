"""Unit tests for create_ghost_picks — idempotency and coverage logic."""
from __future__ import annotations

from sqlalchemy.orm import Session

from subsidence.data.schema import FormationTopModel, TopSet, TopSetHorizon, WellModel
from subsidence.data.zone_service import create_ghost_picks


def _well(session: Session, well_id: str = 'w1') -> None:
    session.add(WellModel(id=well_id, name='Test', kb_elev=0.0, td_md=5000.0))
    session.flush()


def _make_top_set(session: Session) -> TopSet:
    ts = TopSet(name='TS')
    session.add(ts)
    session.flush()
    return ts


def _make_horizon(session: Session, ts_id: int, name: str, age: float | None, sort: int) -> TopSetHorizon:
    h = TopSetHorizon(top_set_id=ts_id, name=name, age_ma=age, sort_order=sort)
    session.add(h)
    session.flush()
    return h


def _make_pick(session: Session, well_id: str, name: str, depth: float | None,
               age: float | None = None, horizon_id: int | None = None) -> FormationTopModel:
    p = FormationTopModel(
        well_id=well_id, name=name, depth_md=depth, age_top_ma=age,
        horizon_id=horizon_id, color='#aaaaaa', color_source='auto',
    )
    session.add(p)
    session.flush()
    return p


def test_no_ghost_for_directly_linked_pick(test_db: Session):
    """Pick with age=None but horizon_id already set must prevent ghost creation."""
    _well(test_db)
    ts = _make_top_set(test_db)
    h = _make_horizon(test_db, ts.id, 'Alpha', age=None, sort=0)
    _make_pick(test_db, 'w1', 'Alpha', depth=100.0, age=None, horizon_id=h.id)

    count = create_ghost_picks(test_db, 'w1', ts.id)

    assert count == 0


def test_no_ghost_for_age_matched_pick(test_db: Session):
    """Pick whose age floor-matches a horizon must not trigger a ghost."""
    _well(test_db)
    ts = _make_top_set(test_db)
    _make_horizon(test_db, ts.id, 'Cretaceous', age=66.0, sort=0)
    _make_pick(test_db, 'w1', 'Some Top', depth=500.0, age=70.0)

    count = create_ghost_picks(test_db, 'w1', ts.id)

    assert count == 0


def test_ghost_created_for_uncovered_horizon(test_db: Session):
    """Horizon with no matching pick must get exactly one ghost."""
    _well(test_db)
    ts = _make_top_set(test_db)
    h_a = _make_horizon(test_db, ts.id, 'Alpha', age=10.0, sort=0)
    h_b = _make_horizon(test_db, ts.id, 'Beta', age=45.0, sort=1)
    _make_pick(test_db, 'w1', 'Alpha', depth=100.0, age=10.0)

    count = create_ghost_picks(test_db, 'w1', ts.id)

    assert count == 1
    ghosts = [p for p in test_db.query(FormationTopModel).filter_by(well_id='w1').all()
              if p.depth_md is None]
    assert len(ghosts) == 1
    assert ghosts[0].horizon_id == h_b.id


def test_ghost_idempotent(test_db: Session):
    """Second call to create_ghost_picks must not create duplicate ghosts."""
    _well(test_db)
    ts = _make_top_set(test_db)
    _make_horizon(test_db, ts.id, 'Alpha', age=10.0, sort=0)

    first = create_ghost_picks(test_db, 'w1', ts.id)
    second = create_ghost_picks(test_db, 'w1', ts.id)

    assert first == 1
    assert second == 0
    ghosts = [p for p in test_db.query(FormationTopModel).filter_by(well_id='w1').all()
              if p.depth_md is None]
    assert len(ghosts) == 1
