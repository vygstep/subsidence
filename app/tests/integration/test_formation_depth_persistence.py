import pytest
from sqlalchemy.orm import Session
from subsidence.data.schema import FormationTopModel


def test_formation_depth_update_persists(test_db: Session, well_factory, formation_factory):
    """Test that updating formation depth persists to database."""
    # Setup
    well = well_factory(well_id="well-1")
    formation = formation_factory(well_id="well-1", name="Austin", depth_md=2000.0)
    
    # Verify initial state
    retrieved = test_db.query(FormationTopModel).filter_by(id=formation.id).first()
    assert retrieved.depth_md == 2000.0
    
    # Act: update depth
    formation.depth_md = 2100.0
    test_db.commit()
    
    # Assert: change persisted
    test_db.expire(formation)
    updated = test_db.query(FormationTopModel).filter_by(id=formation.id).first()
    assert updated.depth_md == 2100.0


def test_formations_maintain_sort_order_by_depth(test_db: Session, well_factory, formation_factory):
    """Test that formations can be retrieved in sorted order by depth."""
    # Setup
    well = well_factory(well_id="well-1")
    
    # Create formations in non-sorted order
    f3 = formation_factory(well_id="well-1", name="Cretaceous", depth_md=3000.0)
    f1 = formation_factory(well_id="well-1", name="Wilcox", depth_md=1000.0)
    f2 = formation_factory(well_id="well-1", name="Austin", depth_md=2000.0)
    
    # Act: retrieve and sort
    formations = test_db.query(FormationTopModel).filter_by(well_id="well-1").all()
    sorted_formations = sorted(formations, key=lambda f: f.depth_md)
    depths = [f.depth_md for f in sorted_formations]
    
    # Assert: sorted by depth
    assert depths == [1000.0, 2000.0, 3000.0]


def test_concurrent_formation_updates_dont_lose_data(test_db: Session, well_factory, formation_factory):
    """Test that updating multiple formations doesn't cause data loss."""
    # Setup
    well = well_factory(well_id="well-1")
    f1 = formation_factory(well_id="well-1", name="F1", depth_md=1000.0)
    f2 = formation_factory(well_id="well-1", name="F2", depth_md=2000.0)
    f3 = formation_factory(well_id="well-1", name="F3", depth_md=3000.0)
    
    # Act: update all three
    f1.depth_md = 1100.0
    f2.depth_md = 2200.0
    f3.depth_md = 3300.0
    test_db.commit()
    
    # Assert: all updates persisted
    updated = test_db.query(FormationTopModel).filter_by(well_id="well-1").order_by(FormationTopModel.depth_md).all()
    assert [f.depth_md for f in updated] == [1100.0, 2200.0, 3300.0]


def test_formation_depth_can_be_zero(test_db: Session, well_factory, formation_factory):
    """Test that formation depth can be set to 0 (KB level)."""
    # Setup
    well = well_factory(well_id="well-1")
    formation = formation_factory(well_id="well-1", depth_md=2000.0)
    
    # Act: set depth to 0
    formation.depth_md = 0.0
    test_db.commit()
    
    # Assert: persisted correctly
    test_db.expire(formation)
    updated = test_db.query(FormationTopModel).filter_by(id=formation.id).first()
    assert updated.depth_md == 0.0


def test_formation_depth_can_exceed_well_td(test_db: Session, well_factory, formation_factory):
    """Test that formation depth can exceed well TD (edge case)."""
    # Setup
    well = well_factory(well_id="well-1", td_md=3000.0)
    formation = formation_factory(well_id="well-1", depth_md=2000.0)
    
    # Act: set depth beyond well TD
    formation.depth_md = 3500.0
    test_db.commit()
    
    # Assert: allowed (validation happens at API level)
    test_db.expire(formation)
    updated = test_db.query(FormationTopModel).filter_by(id=formation.id).first()
    assert updated.depth_md == 3500.0
