import pytest
from sqlalchemy.orm import Session
from subsidence.data.schema import FormationTopModel


def test_add_formation_creates_record(test_db: Session, well_factory):
    """Test that adding a formation creates a database record."""
    # Setup
    well = well_factory(well_id="well-1")
    
    # Act: create formation
    formation = FormationTopModel(
        well_id="well-1",
        name="Austin Chalk",
        depth_md=2000.0,
        color="#8B4513",
        kind="strat",
        is_locked=False,
    )
    test_db.add(formation)
    test_db.commit()
    
    # Assert: record created with ID
    assert formation.id is not None
    
    retrieved = test_db.query(FormationTopModel).filter_by(id=formation.id).first()
    assert retrieved.name == "Austin Chalk"
    assert retrieved.depth_md == 2000.0


def test_delete_formation_removes_record(test_db: Session, well_factory, formation_factory):
    """Test that deleting a formation removes it from database."""
    # Setup
    well = well_factory(well_id="well-1")
    formation = formation_factory(well_id="well-1", name="Cretaceous")
    formation_id = formation.id
    
    # Act: delete
    test_db.delete(formation)
    test_db.commit()
    
    # Assert: record gone
    retrieved = test_db.query(FormationTopModel).filter_by(id=formation_id).first()
    assert retrieved is None


def test_update_formation_fields(test_db: Session, well_factory, formation_factory):
    """Test that updating formation fields persists changes."""
    # Setup
    well = well_factory(well_id="well-1")
    formation = formation_factory(well_id="well-1", name="Original", color="#000000")
    formation_id = formation.id
    
    # Act: update fields
    formation.name = "Updated"
    formation.color = "#FFFFFF"
    formation.age_top_ma = 65.0
    test_db.commit()

    # Assert: all fields updated
    test_db.expire_all()
    updated = test_db.query(FormationTopModel).filter_by(id=formation_id).first()
    assert updated.name == "Updated"
    assert updated.color == "#FFFFFF"
    assert updated.age_top_ma == 65.0


def test_formation_inventory_count_after_add(test_db: Session, well_factory, formation_factory):
    """Test that formation count increases after adding."""
    # Setup
    well = well_factory(well_id="well-1")
    
    # Initial count
    initial_count = test_db.query(FormationTopModel).filter_by(well_id="well-1").count()
    assert initial_count == 0
    
    # Act: add formations
    formation_factory(well_id="well-1", name="F1")
    formation_factory(well_id="well-1", name="F2")
    
    # Assert: count increased
    final_count = test_db.query(FormationTopModel).filter_by(well_id="well-1").count()
    assert final_count == 2


def test_formation_inventory_count_after_delete(test_db: Session, well_factory, formation_factory):
    """Test that formation count decreases after deletion."""
    # Setup
    well = well_factory(well_id="well-1")
    f1 = formation_factory(well_id="well-1", name="F1")
    f2 = formation_factory(well_id="well-1", name="F2")
    
    # Initial count
    assert test_db.query(FormationTopModel).filter_by(well_id="well-1").count() == 2
    
    # Act: delete one
    test_db.delete(f1)
    test_db.commit()
    
    # Assert: count decreased
    assert test_db.query(FormationTopModel).filter_by(well_id="well-1").count() == 1


def test_formations_belong_to_correct_well(test_db: Session, well_factory, formation_factory):
    """Test that formations are correctly associated with wells."""
    # Setup
    well_a = well_factory(well_id="well-a")
    well_b = well_factory(well_id="well-b")
    
    # Create formations for each well
    formation_a1 = formation_factory(well_id="well-a", name="A1")
    formation_a2 = formation_factory(well_id="well-a", name="A2")
    formation_b1 = formation_factory(well_id="well-b", name="B1")
    
    # Act & Assert: retrieve by well_id
    a_formations = test_db.query(FormationTopModel).filter_by(well_id="well-a").all()
    b_formations = test_db.query(FormationTopModel).filter_by(well_id="well-b").all()
    
    assert len(a_formations) == 2
    assert len(b_formations) == 1
    assert {f.name for f in a_formations} == {"A1", "A2"}
    assert b_formations[0].name == "B1"


def test_formation_optional_fields(test_db: Session, well_factory):
    """Test that optional fields can be null."""
    # Setup
    well = well_factory(well_id="well-1")
    
    # Act: create formation with minimal fields
    formation = FormationTopModel(
        well_id="well-1",
        name="Minimal",
        depth_md=1000.0,
        color="#808080",
        kind="strat",
    )
    test_db.add(formation)
    test_db.commit()
    
    # Assert: optional fields are null
    retrieved = test_db.query(FormationTopModel).filter_by(id=formation.id).first()
    assert retrieved.age_top_ma is None
    assert retrieved.is_locked is False


def test_formation_lithology_field_persists(test_db: Session, well_factory):
    well_factory(well_id="well-1")

    formation = FormationTopModel(
        well_id="well-1",
        name="Lithology carrier",
        depth_md=1200.0,
        color="#808080",
        kind="strat",
        lithology="coal",
    )
    test_db.add(formation)
    test_db.commit()

    retrieved = test_db.query(FormationTopModel).filter_by(id=formation.id).first()
    assert retrieved.lithology == "coal"
