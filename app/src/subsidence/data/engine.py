from __future__ import annotations

from collections.abc import Generator
from pathlib import Path
from sqlite3 import Connection as SQLiteConnection

from sqlalchemy import Engine, create_engine, event, text
from sqlalchemy.orm import Session, sessionmaker

from .schema import Base, SCHEMA_VERSION, SUBSIDENCE_APP_ID
from .well_colors import default_well_color

_HEADER_USER_VERSION_OFFSET = 60
_HEADER_APPLICATION_ID_OFFSET = 68
_SQLITE_HEADER_SIZE = 100
_MMAP_SIZE = 268_435_456
_BUSY_TIMEOUT_MS = 5_000

_session_factory: sessionmaker[Session] | None = None


def _read_uint32_be(header: bytes, offset: int) -> int:
    return int.from_bytes(header[offset:offset + 4], byteorder="big", signed=False)


def _configure_sqlite_connection(dbapi_connection: SQLiteConnection, _: object) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute(f"PRAGMA application_id = {SUBSIDENCE_APP_ID};")
    cursor.execute(f"PRAGMA user_version = {SCHEMA_VERSION};")
    cursor.execute("PRAGMA journal_mode = WAL;")
    cursor.execute("PRAGMA foreign_keys = ON;")
    cursor.execute("PRAGMA synchronous = NORMAL;")
    cursor.execute(f"PRAGMA busy_timeout = {_BUSY_TIMEOUT_MS};")
    cursor.execute(f"PRAGMA mmap_size = {_MMAP_SIZE};")
    cursor.execute("PRAGMA temp_store = MEMORY;")
    cursor.close()


def create_engine_for_project(db_path: Path | str) -> Engine:
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    engine = create_engine(f"sqlite+pysqlite:///{path}", future=True)
    event.listen(engine, "connect", _configure_sqlite_connection)

    global _session_factory
    _session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

    return engine


def create_all_tables(engine: Engine) -> None:
    Base.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    if _session_factory is None:
        raise RuntimeError("Session factory is not configured. Call create_engine_for_project() first.")

    session = _session_factory()
    try:
        yield session
    finally:
        session.close()


def migrate_schema(engine: Engine) -> None:
    with engine.connect() as conn:
        well_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(wells)"))}
        if 'color_hex' not in well_cols:
            conn.execute(text("ALTER TABLE wells ADD COLUMN color_hex VARCHAR(9)"))
            conn.commit()
        if 'depth_unit' not in well_cols:
            conn.execute(text("ALTER TABLE wells ADD COLUMN depth_unit TEXT NOT NULL DEFAULT 'm'"))
            conn.commit()
        rows = conn.execute(text("SELECT id FROM wells WHERE color_hex IS NULL OR color_hex = '' ORDER BY name, id")).fetchall()
        for index, row in enumerate(rows):
            conn.execute(
                text("UPDATE wells SET color_hex = :color_hex WHERE id = :id"),
                {'color_hex': default_well_color(str(row[0]), index), 'id': row[0]},
            )
        if rows:
            conn.commit()
        deviation_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(deviation_surveys)"))}
        if 'depth_unit' not in deviation_cols:
            conn.execute(text("ALTER TABLE deviation_surveys ADD COLUMN depth_unit TEXT NOT NULL DEFAULT 'm'"))
            conn.commit()
        strat_unit_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(strat_units)"))}
        if 'chart_id' not in strat_unit_cols:
            conn.execute(text("ALTER TABLE strat_units ADD COLUMN chart_id INTEGER REFERENCES strat_charts(id)"))
            conn.commit()
        formation_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(formation_tops)"))}
        if 'water_depth_m' not in formation_cols:
            conn.execute(text("ALTER TABLE formation_tops ADD COLUMN water_depth_m REAL NOT NULL DEFAULT 0.0"))
            conn.commit()
        if 'eroded_thickness_m' not in formation_cols:
            conn.execute(text("ALTER TABLE formation_tops ADD COLUMN eroded_thickness_m REAL NOT NULL DEFAULT 0.0"))
            conn.commit()
        if 'hiatus_duration_ma' not in formation_cols:
            conn.execute(text("ALTER TABLE formation_tops ADD COLUMN hiatus_duration_ma REAL NOT NULL DEFAULT 0.0"))
            conn.execute(text("""
                UPDATE formation_tops
                SET    hiatus_duration_ma = COALESCE(age_base_ma, age_top_ma) - COALESCE(age_top_ma, 0),
                       age_top_ma = COALESCE(age_base_ma, age_top_ma),
                       age_base_ma = NULL
                WHERE  kind = 'unconformity'
                  AND  age_top_ma IS NOT NULL
                  AND  age_base_ma IS NOT NULL
                  AND  age_base_ma > age_top_ma
            """))
            conn.commit()
        if 'lithology' not in formation_cols:
            conn.execute(text("ALTER TABLE formation_tops ADD COLUMN lithology TEXT"))
            conn.commit()
        if 'strat_unit_id' in formation_cols:
            # SQLite < 3.35 cannot DROP COLUMN; leave it as an orphan column (ORM ignores it)
            pass
        litho_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(lithology_dict_entries)"))}
        if 'density' not in litho_cols:
            conn.execute(text("ALTER TABLE lithology_dict_entries ADD COLUMN density REAL NOT NULL DEFAULT 2650.0"))
            conn.commit()
        if 'porosity_surface' not in litho_cols:
            conn.execute(text("ALTER TABLE lithology_dict_entries ADD COLUMN porosity_surface REAL NOT NULL DEFAULT 0.50"))
            conn.commit()
        if 'compaction_coeff' not in litho_cols:
            conn.execute(text("ALTER TABLE lithology_dict_entries ADD COLUMN compaction_coeff REAL NOT NULL DEFAULT 0.30"))
            conn.commit()
        curve_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(curve_metadata)"))}
        if 'discrete_code_map' not in curve_cols:
            conn.execute(text("ALTER TABLE curve_metadata ADD COLUMN discrete_code_map TEXT"))
            conn.commit()
        if 'lithology_set_id' not in curve_cols:
            conn.execute(text("ALTER TABLE curve_metadata ADD COLUMN lithology_set_id INTEGER REFERENCES lithology_sets(id)"))
            conn.commit()
        table_names = {row[0] for row in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))}
        pattern_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(lithology_patterns)"))}
        if 'group_name' not in pattern_cols:
            conn.execute(text("ALTER TABLE lithology_patterns ADD COLUMN group_name VARCHAR(128)"))
            conn.commit()
        if 'base_lithology_code' not in pattern_cols:
            conn.execute(text("ALTER TABLE lithology_patterns ADD COLUMN base_lithology_code VARCHAR(64)"))
            conn.commit()
        if 'sea_level_curves' not in table_names:
            conn.execute(text(
                "CREATE TABLE sea_level_curves ("
                "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                "name VARCHAR(256) NOT NULL, "
                "source VARCHAR(256), "
                "is_builtin BOOLEAN NOT NULL DEFAULT 0, "
                "created_at DATETIME, "
                "modified_at DATETIME)"
            ))
            conn.execute(text(
                "CREATE TABLE sea_level_points ("
                "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                "curve_id INTEGER NOT NULL REFERENCES sea_level_curves(id) ON DELETE CASCADE, "
                "age_ma REAL NOT NULL, "
                "sea_level_m REAL NOT NULL)"
            ))
            conn.execute(text(
                "CREATE TABLE well_active_sea_level_curves ("
                "well_id VARCHAR(36) PRIMARY KEY REFERENCES wells(id) ON DELETE CASCADE, "
                "curve_id INTEGER NOT NULL REFERENCES sea_level_curves(id) ON DELETE RESTRICT)"
            ))
            conn.commit()


def validate_project_db(db_path: Path | str) -> tuple[int, int]:
    path = Path(db_path)
    if not path.exists():
        raise FileNotFoundError(f"Project database does not exist: {path}")

    with path.open("rb") as handle:
        header = handle.read(_SQLITE_HEADER_SIZE)

    if len(header) < _SQLITE_HEADER_SIZE or not header.startswith(b"SQLite format 3\x00"):
        raise ValueError(f"Not a valid SQLite database: {path}")

    user_version = _read_uint32_be(header, _HEADER_USER_VERSION_OFFSET)
    application_id = _read_uint32_be(header, _HEADER_APPLICATION_ID_OFFSET)

    if application_id != SUBSIDENCE_APP_ID:
        raise ValueError(
            f"Unexpected application_id for project DB: {application_id} != {SUBSIDENCE_APP_ID}"
        )

    if user_version > SCHEMA_VERSION:
        raise ValueError(
            f"Project schema version {user_version} is newer than supported {SCHEMA_VERSION}"
        )

    return application_id, user_version
