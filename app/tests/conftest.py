import pytest
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from subsidence.data import create_all_tables, create_empty_well
from subsidence.data.schema import Base, WellModel, FormationTopModel
from subsidence.api.main import app
from httpx import Client


@pytest.fixture
def test_db():
    """Create an in-memory SQLite database for testing."""
    engine = create_engine("sqlite:///:memory:")
    create_all_tables(engine)
    
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    
    yield session
    
    session.close()
    engine.dispose()


@pytest.fixture
def client(test_db):
    """Create a test client with mocked database."""
    app.state.project_manager.engine = None  # Reset to avoid file I/O
    
    # Override database dependency
    def override_get_db():
        yield test_db
    
    with Client(app=app, base_url="http://test") as client:
        yield client


@pytest.fixture
def well_factory(test_db):
    """Factory to create test wells."""
    def create_well(well_id="well-1", name="Test Well", td_md=3000.0, **kwargs):
        well = WellModel(
            id=well_id,
            name=name,
            kb_elev=100.0,
            gl_elev=95.0,
            td_md=td_md,
            lat=40.0,
            lon=-90.0,
            crs="EPSG:32619",
            source_las_path=None,
            **kwargs,
        )
        test_db.add(well)
        test_db.commit()
        return well
    
    return create_well


@pytest.fixture
def formation_factory(test_db):
    """Factory to create test formations."""
    def create_formation(well_id="well-1", name="Austin Chalk", depth_md=2000.0, color="#8B4513", **kwargs):
        formation = FormationTopModel(
            well_id=well_id,
            name=name,
            depth_md=depth_md,
            color=color,
            kind="strat",
            is_locked=False,
            age_top_ma=78.0,
            **kwargs,
        )
        test_db.add(formation)
        test_db.commit()
        return formation
    
    return create_formation
