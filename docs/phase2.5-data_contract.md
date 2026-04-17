# Phase 2.5: Data Persistence Layer — Implementation Contract

**Goal**: Implement a project-based data persistence layer so that well data, formation tops,
deviation surveys, visual config, and calculation results survive between sessions. This phase
sits between Phase 2 (read-only multi-curve display) and Phase 3 (formation top dragging — the
first write operation). No new UI panels; all changes are backend + stores + wiring.

---

## Progress
| Step | Status | Verification | Commit |
|---|---|---|---|
| Step 1  | done | `Base.metadata.tables` returns 12 schema tables | `144656e` |
| Step 2  | done | `PRAGMA application_id` returns `0x53554253` on a temp DB | `fbe43df` |
| Step 3  | done | `create_project()` creates bundle dirs + seeded dictionaries; `open_project()` creates `working.db`; `close_project()` removes the session dir | `9d4e7d6` |
| Step 4  | done | write -> save -> close -> reopen persists; close without save reverts; crash recovery is detected | `011cb45` |
| Step 5  | done | `create_project()` seeds 17 curve rows and 9 lithology rows; `resolve_curve_alias("GR_1", rules)` -> `gamma_ray` | `d422901` |
| Step 6  | done | `import_las_file()` writes Parquet + DB rows; `GR` resolves to `gamma_ray`; `load_curves_from_parquet()` returns float32 arrays | `ca4a80c` |
| Step 7  | done | `import_tops_csv()` imports 32 tops for `PLESHET 01`; ICS color lookup works; unconformity age bounds load from `unconformities.csv` | `d3153a3` |
| Step 8  | done | `import_deviation_csv()` detects `MD+INCL_AZIM`, writes Parquet, and `load_deviation_from_parquet()` returns a valid `DeviationSurvey` | `a728620` |
| Step 9  | done | `UndoStack` executes `push/undo/redo`; `ImportWell` undo removes the well and redo restores DB rows + Parquet; `mark_clean()` and undo update `is_clean` correctly | `bbb5d33` |
| Step 10 | done | `create_checkpoint()` writes a DB snapshot + row; `restore_checkpoint()` reverts working state and creates `before-restore`; `delete_checkpoint()` removes file + row | `22af478` |
| Step 11 | done | Full API round trip passes via TestClient: create -> open -> import LAS/tops/unconformities/deviation -> save -> close -> reopen -> data intact; dictionary and checkpoint endpoints respond correctly | `64cce9c` |
| Step 12 | done | Frontend loads well data from project-backed `/api/wells/{id}`; `projectStore` polls `/api/projects/status`; keyboard shortcuts trigger save/undo/redo; build passes and backend well endpoints return DB + Parquet data after reopen | `c9bd17e` |
| Step 13 | pending | - | - |

---

## Architecture Summary

A SUBSIDENCE project is a **folder bundle** — a directory containing one SQLite database
(`project.db`) for metadata and relational data, Parquet sidecars for bulk numeric arrays,
and the original source files as read-only references. Dictionary seed data (curve families,
lithology entries) ships with the app and is written into `project.db` on creation so that
projects are self-contained and portable.

```
MyProject.subsidence/
├── project.db                          # SQLite: wells, tops, config, dicts, results meta
├── manifest.json                       # { app: "SUBSIDENCE", schema_version: 1, created: ... }
├── curves/                             # Parquet files: one per imported curve set
│   └── <well_id>.parquet
├── deviation/                          # Parquet files: one per deviation survey
│   └── <well_id>__deviation.parquet
├── results/                            # Parquet files: burial history, subsidence curves
│   └── <result_uuid>.parquet
├── originals/                          # Imported source files, read-only copies
│   └── sample.las
├── checkpoints/                        # Named VACUUM INTO snapshots
└── .subsidence.lock                    # Advisory lock file (PID + session UUID)
```

### Key design decisions

1. **Folder bundle, not single file** — `project.db` stays small (metadata only); bulk numeric
   data lives in Parquet sidecars. Migrations, checkpoints, and VACUUMs remain fast regardless
   of data volume.

2. **Working-copy pattern** — on `File → Open`, the app copies `project.db` to a session
   directory (`<config_dir>/sessions/<uuid>/working.db`). All writes go to the working copy.
   The canonical `project.db` is updated only on explicit `Ctrl+S` via `VACUUM INTO` + atomic
   rename. If the app crashes, the last explicit save is intact.

3. **Autosave to recovery** — a background task periodically `VACUUM INTO`s a `recovery.db`
   in the session directory. On next launch, if a stale lock + recovery file exist, offer
   to restore.

4. **Undo/redo via command pattern** — an in-memory `UndoStack` on the backend. Each mutating
   endpoint pushes a command with `apply()` / `revert()`. Does not persist across sessions.

5. **Checkpoints via `VACUUM INTO`** — user-triggered snapshots saved as
   `checkpoints/<ts>__<name>.db`. Restore = close working DB, copy checkpoint over working
   DB, reopen.

6. **Visual config in JSON column** — track widths, curve colors, scale settings stored as
   JSON in `project.db`, not normalized tables. Machine-specific settings live in a separate
   user-prefs location, never inside the project.

7. **Dictionaries in DB, seeded from built-ins** — curve alias rules and lithology entries are
   stored in `project.db` tables so they travel with the project. On `create_project` the DB is
   seeded from built-in CSV seed files shipped with the app. Project-scope overrides (extra
   aliases, custom colors) are added as additional rows with `scope='project'`. This gives
   full portability without requiring the app installation to match.

---

## Schema: 12 tables

| Table | Purpose | Key fields |
|---|---|---|
| `project_meta` | Singleton project info | project_name, app_version, schema_version |
| `wells` | Well header data | uuid PK, uwi, name, kb_elev, td_md, lat, lon, crs, source_las_path, extra JSON |
| `curve_metadata` | Curve index (data in Parquet) | well_id FK, mnemonic, standard_mnemonic, family_code, unit, original_unit, curve_type, depth_min/max, n_samples, data_uri, source_hash |
| `deviation_surveys` | Deviation survey index (data in Parquet) | well_id FK, reference, mode, data_uri, source_hash |
| `formation_tops` | Editable formation picks | well_id FK, strat_unit_id FK (nullable), name, kind, depth_md, depth_tvd, age_top_ma, age_base_ma, color, is_locked |
| `strat_units` | Stratigraphic column dictionary | name, rank, parent_id (self-ref), age_top_ma, age_base_ma, lithology, color_hex |
| `curve_dict_entries` | Curve alias + family rules | scope, pattern, is_regex, priority, family_code, canonical_mnemonic, canonical_unit, is_active |
| `lithology_dict_entries` | Lithology display config | lithology_code, display_name, color_hex, pattern_id, sort_order |
| `calculation_results` | Cached burial/subsidence | kind, algorithm, params_json, inputs_hash, data_uri, is_stale |
| `visual_config` | UI layout + styling | scope, scope_id, config JSON |
| `users` | Identity for audit trail | uuid PK, display_name, is_local_default, server_account_id (nullable) |
| `checkpoints` | Named project snapshots | name, description, timestamp, file_path, byte_size, sha256 |

---

## Task Checklist

### Step 1 — SQLAlchemy models and database schema

- [x] 1.1  Create `app/src/subsidence/data/schema.py`: `Base` with naming convention,
           `SUBSIDENCE_APP_ID`, `SCHEMA_VERSION`
- [x] 1.2  Define `ProjectMeta` model: singleton row with project_name, app_version,
           schema_version, timestamps
- [x] 1.3  Define `WellModel`: UUID PK, uwi, name, kb_elev, gl_elev, td_md, lat, lon,
           crs, source_las_path, extra JSON, audit columns
- [x] 1.4  Define `CurveMetadata`:
           FK to well, `mnemonic`, `standard_mnemonic` (nullable), `family_code` (nullable),
           `unit`, `original_unit` (nullable), `curve_type` (`continuous` | `discrete`),
           depth_min/max, n_samples, `data_uri`, `source_hash`
- [x] 1.5  Define `DeviationSurveyModel`:
           FK to well, `reference` (MD | TVD | TVDSS), `mode` (INCL_AZIM | X_Y | DX_DY),
           `data_uri`, `source_hash`, audit columns
- [x] 1.6  Define `FormationTopModel`:
           FK to well, FK to strat_unit (nullable), `name`, `kind` (`strat` | `unconformity`),
           `depth_md`, `depth_tvd` (nullable), `age_top_ma` (nullable), `age_base_ma` (nullable),
           `confidence` (nullable), `color`, `is_locked`, `note` (nullable), audit columns
- [x] 1.7  Define `StratUnit`: name, rank, parent_id (self-ref), age_top_ma, age_base_ma,
           lithology, color_hex
- [x] 1.8  Define `CurveDictEntry`:
           `scope` (`base` | `project` | `user`), `pattern`, `is_regex`, `priority`,
           `family_code` (nullable), `canonical_mnemonic` (nullable), `canonical_unit` (nullable),
           `is_active` bool, audit columns
- [x] 1.9  Define `LithologyDictEntry`:
           `lithology_code` (unique), `display_name`, `color_hex`, `pattern_id` (nullable),
           `description` (nullable), `sort_order`
- [x] 1.10 Define `CalculationResult`: kind, algorithm, params_json, inputs_hash, data_uri,
           is_stale, audit columns
- [x] 1.11 Define `VisualConfig`: scope, scope_id, config JSON
- [x] 1.12 Define `UserModel`: UUID PK, display_name, is_local_default,
           server_account_id (nullable)
- [x] 1.13 Define `CheckpointModel`: name, description, timestamp, file_path, byte_size,
           sha256, app_version, schema_version
- [x] 1.✓  Verify: `python -c "from subsidence.data.schema import Base; print(len(Base.metadata.tables))"` prints `12`

### Step 2 — Database engine and connection management

- [x] 2.1 Create `app/src/subsidence/data/engine.py`: `create_engine_for_project(db_path)`
          with PRAGMA block (WAL, foreign_keys, synchronous=NORMAL, application_id,
          user_version, mmap_size, busy_timeout)
- [x] 2.2 Add `get_session` dependency for FastAPI
- [x] 2.3 Add `create_all_tables(engine)` function
- [x] 2.4 Add `validate_project_db(db_path)` function: checks `application_id` and
          `user_version`
- [x] 2.✓ Verify: create a temp DB, call `create_all_tables`, run `PRAGMA application_id`
          → returns `0x53554253`

### Step 3 — Project bundle create / open / close

- [x] 3.1 Create `app/src/subsidence/data/project_manager.py` with `ProjectManager` class
- [x] 3.2 Implement `create_project(name, path)`: create folder structure
          (`curves/`, `deviation/`, `results/`, `originals/`, `checkpoints/`),
          init `project.db`, insert `ProjectMeta` + default `UserModel`,
          call `seed_dictionaries()` (Step 5), write `manifest.json`
- [x] 3.3 Implement `open_project(path)`: validate manifest + application_id,
          acquire advisory lock, copy `project.db` → session working copy, open engine
- [x] 3.4 Implement `close_project()`: checkpoint WAL, optimize, dispose engine,
          release lock, clean up session directory
- [x] 3.5 Implement lock mechanism: `fcntl.flock` (POSIX) / `msvcrt.locking` (Windows)
- [x] 3.6 Store session working directory in
          `platformdirs.user_cache_dir("SUBSIDENCE") / "sessions" / <uuid>`
- [x] 3.✓ Verify: `create_project` → folder with all subdirs + `project.db` + seeded
          dictionaries; `open_project` → `working.db` in session dir; `close_project` →
          session dir cleaned up

### Step 4 — Save and autosave

- [x] 4.1 Implement `save_project()`: WAL checkpoint → `VACUUM INTO` temp → fsync →
          atomic rename → fsync parent dir → `undo_stack.mark_clean()`
- [x] 4.2 Add `is_dirty` property (reads from `UndoStack.is_clean()`)
- [x] 4.3 Implement `autosave()`: `VACUUM INTO recovery.db.new` → `os.replace` →
          `recovery.db`
- [x] 4.4 Add background autosave task: `asyncio.create_task`, default 5 min interval
- [x] 4.5 Implement crash recovery detection: stale lock + newer `recovery.db` →
          return `recovery_available=True`
- [x] 4.✔ Verify: write → save → close → reopen → data persists. Close without save →
          reopen → reverts. Kill process → reopen → recovery offered.

### Step 5 — Dictionary bootstrap

- [x] 5.1 Create `app/src/subsidence/data/dictionaries/` directory with seed files:
          `curve_families.csv` and `lithology_defaults.csv`
- [x] 5.2 `curve_families.csv` columns:
          `scope, pattern, is_regex, priority, family_code, canonical_mnemonic, canonical_unit`
          — include base rules for GR/CALI, ILD/ILM/LLD, RHOB/DRHOB, NPHI/TNPH/CNCF,
          DT/DTC, CALI, SP; mark all as `scope=base`
- [x] 5.3 `lithology_defaults.csv` columns:
          `lithology_code, display_name, color_hex, pattern_id, sort_order`
          — cover all `LithologyPattern` values from `lithologyRenderer.ts`:
          sandstone, shale, limestone, dolomite, evaporite, igneous, coal,
          conglomerate, metamorphic (pattern_id=null for metamorphic)
- [x] 5.4 Create `app/src/subsidence/data/dict_seeder.py` with
          `seed_dictionaries(session, db_path)`:
          read both CSVs, insert rows only if `CurveDictEntry`/`LithologyDictEntry`
          tables are empty (idempotent)
- [x] 5.5 Create `app/src/subsidence/data/dict_resolver.py` with
          `load_curve_alias_rules(session)` and `resolve_curve_alias(mnemonic, rules)` —
          migrated from legacy `curve_dictionary.py` but reading from the ORM session
          instead of a raw SQLite connection; sort order: scope rank
          (user > project > base) then priority then pattern length (descending)
- [x] 5.6 Create `app/src/subsidence/data/dict_resolver.py` with
          `load_lithology_entries(session)` → dict `{code: LithologyDictEntry}`
- [x] 5.✔ Verify: `create_project` → query `curve_dict_entries` → at least one row
          per family code. Query `lithology_dict_entries` → 9 rows.
          `resolve_curve_alias("GR_1", rules)` → `family_code="gamma_ray"`.

### Step 6 — LAS import into project

- [x] 6.1 Create `app/src/subsidence/data/importers.py` with
          `import_las_file(session, project_path, las_path)`
- [x] 6.2 Implement: copy LAS to `originals/`, compute sha256, parse with `lasio`
- [x] 6.3 Create `WellModel` row from LAS header (WELL, UWI, COMP, FLD, LOC, STRT,
          STOP, NULL, KB, GL)
- [x] 6.4 Apply dictionary: call `load_curve_alias_rules(session)` and
          `resolve_curve_alias(mnemonic, rules)` for each curve; populate
          `standard_mnemonic`, `family_code`, `canonical_unit` in `CurveMetadata`;
          apply unit conversion via legacy `unit_conversion.py` helpers
- [x] 6.5 Build a pandas DataFrame: `DEPT` + one column per curve; write to
          `curves/<well_id>.parquet` with snappy compression
- [x] 6.6 Create one `CurveMetadata` row per curve: mnemonic, standard_mnemonic,
          family_code, unit (post-conversion), original_unit (from LAS), curve_type
          (`continuous`), depth_min, depth_max, n_samples, data_uri, source_hash
- [x] 6.7 Create `app/src/subsidence/data/loaders.py` with
          `load_curves_from_parquet(project_path, data_uri)` → dict
          `{mnemonic: (depths, values)}` as numpy float32
- [x] 6.✔ Verify: import `sample.las` → Parquet exists, `WellModel` + `CurveMetadata`
          rows in DB, `GR` row has `family_code="gamma_ray"`,
          `load_curves_from_parquet` returns correct arrays

### Step 7 — Tops and unconformities CSV import

- [x] 7.1 Add `import_tops_csv(session, well_id, csv_path, depth_ref="MD")`
          to `importers.py`
- [x] 7.2 Required CSV columns: `well_name, top_name, depth_md`
          Optional: `strat_age_ma, boundary_type, unconformity_ref, color, note`
          `boundary_type` values: `conformable` (default) | `unconformity`
          → rows with `boundary_type=conformable` → `kind="strat"`,
          otherwise → `kind="unconformity"`
- [x] 7.3 Insert `FormationTopModel` rows: set `age_top_ma = strat_age_ma` for strat
          rows; set `age_top_ma = NULL, age_base_ma = NULL` initially for unconformity
          rows (age bounds come from the unconformities file, Step 7.5)
- [x] 7.4 Add `import_unconformities_csv(session, well_id, csv_path)` to `importers.py`
- [x] 7.5 Required CSV columns: `well_name, unc_name, depth_md, end_age_ma, start_age_ma`
          → match by name to existing `FormationTopModel` rows with
          `kind="unconformity"` and set `age_top_ma = end_age_ma`,
          `age_base_ma = start_age_ma`; create a new row if no match
- [x] 7.6 Add `link_tops_to_unconformities(session, well_id, depth_tolerance_m=0.1)`:
          for strat tops without an explicit `unconformity_ref`, find the nearest
          unconformity within `depth_tolerance_m` and set `unconformity_ref` via note
          → migrated from legacy `link_strat_tops_to_unconformities()`
- [x] 7.✔ Verify: import tops + unconformities CSV for `PLESHET 01` →
          32 `FormationTopModel` rows, unconformity rows have `kind="unconformity"`,
          `age_top_ma`/`age_base_ma` populated after unconformities CSV import

### Step 8 — Deviation CSV import

- [x] 8.1 Add `import_deviation_csv(session, project_path, well_id, csv_path)` to
          `importers.py`
- [x] 8.2 Auto-detect mode from column headers:
          presence of `incl_deg`/`azim` → `INCL_AZIM`;
          `x`/`y` → `X_Y`; `dx`/`dy` → `DX_DY`
- [x] 8.3 Auto-detect depth reference from column headers:
          `md` → `MD`; `tvd` (no `md`) → `TVD`; `tvdss` → `TVDSS`
- [x] 8.4 Validate strictly increasing depth column; raise on duplicates or
          non-monotone values
- [x] 8.5 Write Parquet to `deviation/<well_id>__deviation.parquet`
- [x] 8.6 Create `DeviationSurveyModel` row: well_id, reference, mode, data_uri,
          source_hash
- [x] 8.7 Add `load_deviation_from_parquet(project_path, data_uri)` to `loaders.py`
          → `DeviationSurvey` domain object (reuse legacy `models.py` dataclass)
- [x] 8.8 Verify: import a CSV with columns `md, incl_deg, azim_deg` ->
          Parquet exists, `DeviationSurveyModel` row with `mode="INCL_AZIM"`,
          `load_deviation_from_parquet` returns a valid `DeviationSurvey`

### Step 9 — Undo/redo stack

- [x] 9.1  Create `app/src/subsidence/data/undo.py` with `Command` ABC:
           `apply(session)`, `revert(session)`, `description: str`
- [x] 9.2  Implement `UndoStack`: `push(cmd, session)`, `undo(session)`, `redo(session)`,
           `mark_clean()`, `is_clean`, `can_undo`, `can_redo`, bounded size (200)
- [x] 9.3  Implement `UpdateFormationDepth(top_id, old_depth, new_depth)` command
- [x] 9.4  Implement `UpdateVisualConfig(scope, scope_id, old_config, new_config)` command
- [x] 9.5  Implement `ImportWell(well_id)` command - revert deletes well + curves + Parquet
- [x] 9.6  Wire `UndoStack` into `ProjectManager`; `save_project()` calls
           `undo_stack.mark_clean()`
- [x] 9.7  Verify: push 3 commands -> undo twice -> redo once preserves indexed state; `mark_clean()` -> `is_clean=True` -> undo -> `is_clean=False`

### Step 10 — Checkpoints

- [x] 10.1 Implement `create_checkpoint(name, description)`: `VACUUM INTO
           checkpoints/<ts>__<slug>.db`, compute sha256, insert `CheckpointModel` row
- [x] 10.2 Implement `list_checkpoints()`: query `CheckpointModel`
- [x] 10.3 Implement `restore_checkpoint(checkpoint_id)`: auto-create `before-restore`
           checkpoint first, then close working DB, copy checkpoint → working DB, reopen,
           reset undo stack, mark dirty
- [x] 10.4 Implement `delete_checkpoint(checkpoint_id)`: remove file + DB row
- [x] 10.5 Verify: create checkpoint -> listed. Modify data -> restore -> reverted. `before-restore` checkpoint exists.

### Step 11 — API endpoints

- [x] 11.1  Create `app/src/subsidence/api/projects.py` router
- [x] 11.2  Project lifecycle: `POST /api/projects`, `POST /api/projects/open`,
            `POST /api/projects/close`, `POST /api/projects/save`,
            `GET /api/projects/status`
- [x] 11.3  Import: `POST /api/projects/import-las` (LAS file)
- [x] 11.4  Import: `POST /api/projects/import-tops` (tops CSV, body: well_id + file)
- [x] 11.5  Import: `POST /api/projects/import-unconformities` (body: well_id + file)
- [x] 11.6  Import: `POST /api/projects/import-deviation` (body: well_id + file)
- [x] 11.7  Undo/redo: `POST /api/projects/undo`, `POST /api/projects/redo`
            → `{ description, can_undo, can_redo, is_dirty }`
- [x] 11.8  Checkpoints: `POST /api/projects/checkpoints`,
            `GET /api/projects/checkpoints`,
            `POST /api/projects/checkpoints/{id}/restore`,
            `DELETE /api/projects/checkpoints/{id}`
- [x] 11.9  Dictionary: `GET /api/projects/dictionary/curves` - list all active rules
            `POST /api/projects/dictionary/curves` — add project-scope rule
            `GET /api/projects/dictionary/lithology` — list lithology entries
            `PUT /api/projects/dictionary/lithology/{code}` — update color/display name
- [x] 11.10 Verify: full round trip via TestClient: create -> open -> import LAS -> check `curve_metadata.family_code` -> import tops CSV -> check `formation_tops` rows -> save -> close -> reopen -> data intact
            `curve_metadata` has `family_code` populated → import tops CSV → check
            `formation_tops` rows → save → close → reopen → data intact

### Step 12 — Rewire frontend stores to project-aware API

- [x] 12.1 Update `wellDataStore.loadWell()`: fetch from `/api/wells/{id}` which now
           reads from `project.db` + Parquet
- [x] 12.2 Update `GET /api/wells/{id}` endpoint: read `WellModel` + `CurveMetadata`
           from DB, load arrays from Parquet, return same JSON shape as Phase 1
- [x] 12.3 Add `useProjectStore` Zustand store: `projectName`, `projectPath`,
           `isDirty`, `isOpen`, `canUndo`, `canRedo`
- [x] 12.4 Wire `useProjectStore` to poll `/api/projects/status` on 2s interval
- [x] 12.5 Add `Ctrl+S` -> `POST /api/projects/save`
- [x] 12.6 Add `Ctrl+Z` / `Ctrl+Shift+Z` -> `POST /api/projects/undo` / `redo`
- [x] 12.7 Title bar dirty indicator: show `dirty-dot` before project name when `isDirty=true`
- [x] 12.8 Verify: frontend build passes; project-backed `/api/wells` and `/api/wells/{id}` return data after save/close/reopen; hotkeys and dirty indicator are wired in `App.tsx`


### Step 13 — Visual config persistence + export stubs

- [ ] 13.1 Add `GET /api/projects/config/{scope}` and `PUT /api/projects/config/{scope}`
           endpoints
- [ ] 13.2 On `LogViewPanel` mount: load visual config → apply track widths, zoom level
- [ ] 13.3 On track resize / zoom change (debounced 1s): write config back
- [ ] 13.4 Add `POST /api/projects/export/las` stub: build `lasio.LASFile` from Parquet
- [ ] 13.5 Add `POST /api/projects/export/csv` stub: result Parquet → CSV with metadata
           header lines
- [ ] 13.✓ Verify: resize track → save → close → reopen → width preserved.
           Export LAS returns valid file.

---

## Detailed Step Specifications

### Step 1 — SQLAlchemy models and database schema

Status: done
Verification: `python -c "from subsidence.data.schema import Base; print(len(Base.metadata.tables))"` prints `12`
Commit: `144656e`

Create `app/src/subsidence/data/schema.py`.

All models inherit from a common `Base` with naming convention:

```python
from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

NAMING = {
    "ix": "ix_%(table_name)s_%(column_0_name)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
}

SUBSIDENCE_APP_ID = 0x53554253  # "SUBS"
SCHEMA_VERSION = 1

class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING)
```

Every editable table carries an `AuditMixin`:

```python
class AuditMixin:
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    modified_at: Mapped[datetime] = mapped_column(default=datetime.utcnow,
                                                   onupdate=datetime.utcnow)
    created_by: Mapped[str] = mapped_column(default="local")
    modified_by: Mapped[str] = mapped_column(default="local")
```

`created_by` / `modified_by` are plain strings so a project opened on another machine
doesn't break on unknown user UUIDs.

**`CurveMetadata`** — new fields vs Phase 1:

```python
class CurveMetadata(Base, AuditMixin):
    __tablename__ = "curve_metadata"
    id: Mapped[int] = mapped_column(primary_key=True)
    well_id: Mapped[str] = mapped_column(ForeignKey("wells.id"))
    mnemonic: Mapped[str]
    standard_mnemonic: Mapped[str | None]  # canonical after alias resolution
    family_code: Mapped[str | None]        # "gamma_ray", "resistivity", etc.
    unit: Mapped[str]                      # unit after conversion
    original_unit: Mapped[str | None]      # unit as read from source file
    curve_type: Mapped[str] = mapped_column(default="continuous")
    # "continuous" = float values (GR, ILD, RHOB)
    # "discrete"   = integer codes (lithofacies, zone flags) — import in later phase
    depth_min: Mapped[float]
    depth_max: Mapped[float]
    n_samples: Mapped[int]
    data_uri: Mapped[str]                  # relative path to Parquet
    source_hash: Mapped[str]               # sha256 of original source file
```

**`DeviationSurveyModel`** — new table:

```python
class DeviationSurveyModel(Base, AuditMixin):
    __tablename__ = "deviation_surveys"
    id: Mapped[int] = mapped_column(primary_key=True)
    well_id: Mapped[str] = mapped_column(ForeignKey("wells.id"), unique=True)
    reference: Mapped[str]   # "MD" | "TVD" | "TVDSS"
    mode: Mapped[str]        # "INCL_AZIM" | "X_Y" | "DX_DY"
    data_uri: Mapped[str]    # relative path to Parquet
    source_hash: Mapped[str]
```

One well has at most one active deviation survey (`unique=True` on `well_id`). Re-importing
overwrites the existing row and Parquet file.

**`FormationTopModel`** — extended vs app_compass.md:

```python
class FormationTopModel(Base, AuditMixin):
    __tablename__ = "formation_tops"
    id: Mapped[int] = mapped_column(primary_key=True)
    well_id: Mapped[str] = mapped_column(ForeignKey("wells.id"))
    strat_unit_id: Mapped[int | None] = mapped_column(ForeignKey("strat_units.id"))
    name: Mapped[str]
    kind: Mapped[str] = mapped_column(default="strat")
    # "strat"         — conformable formation top
    # "unconformity"  — erosional/non-depositional boundary (has hiatus age bounds)
    depth_md: Mapped[float]
    depth_tvd: Mapped[float | None]
    age_top_ma: Mapped[float | None]
    # strat tops:       age of the pick (from StratUnit or CSV)
    # unconformities:   start of the hiatus (younger boundary, e.g. 23.0 Ma)
    age_base_ma: Mapped[float | None]
    # unconformities only: base of the hiatus (older boundary, e.g. 30.0 Ma)
    # gap = age_base_ma - age_top_ma (must be > 0 if both are set)
    confidence: Mapped[float | None]  # 0.0–1.0
    color: Mapped[str]
    is_locked: Mapped[bool] = mapped_column(default=False)
    note: Mapped[str | None]
```

**Why `age_top_ma` + `age_base_ma` on `FormationTopModel`**: the `StratUnit` dictionary stores
ages for a *type section* of a stratigraphic unit globally. For backstripping, we need the
*local* age of each pick on *this specific well*, which may differ from the dictionary value.
An unconformity also needs its own hiatus duration independent of any unit in the dictionary.

**`CurveDictEntry`** — new table:

```python
class CurveDictEntry(Base, AuditMixin):
    __tablename__ = "curve_dict_entries"
    id: Mapped[int] = mapped_column(primary_key=True)
    scope: Mapped[str]              # "base" | "project" | "user"
    pattern: Mapped[str]            # glob or regex string (uppercase to match)
    is_regex: Mapped[bool] = mapped_column(default=False)
    priority: Mapped[int] = mapped_column(default=0)
    family_code: Mapped[str | None]
    canonical_mnemonic: Mapped[str | None]
    canonical_unit: Mapped[str | None]
    is_active: Mapped[bool] = mapped_column(default=True)
```

Sort order when resolving: `scope_rank DESC, priority DESC, len(pattern) DESC`.
`scope_rank`: user=3, project=2, base=1.

**`LithologyDictEntry`** — new table:

```python
class LithologyDictEntry(Base):
    __tablename__ = "lithology_dict_entries"
    id: Mapped[int] = mapped_column(primary_key=True)
    lithology_code: Mapped[str] = mapped_column(unique=True)
    # must match the string literal used in lithologyRenderer.ts pattern switch
    display_name: Mapped[str]
    color_hex: Mapped[str]          # default fill color for blocks
    pattern_id: Mapped[str | None]  # null if no canvas pattern (solid fill)
    description: Mapped[str | None]
    sort_order: Mapped[int] = mapped_column(default=0)
```

`pattern_id` is the same string as `lithology_code` for entries that have a renderer pattern
(sandstone, shale, limestone, dolomite). For entries without a dedicated pattern (evaporite,
igneous, coal, conglomerate, metamorphic) it is `null` — the renderer falls back to solid fill
using `color_hex`.

---

### Step 2 — Database engine and connection management

Status: done
Verification: create a temp DB, run `create_all_tables`, then `PRAGMA application_id` returns `0x53554253` and `validate_project_db()` passes
Commit: `fbe43df`

Create `app/src/subsidence/data/engine.py`.

```python
from sqlalchemy import event, Engine

@event.listens_for(Engine, "connect")
def _set_sqlite_pragmas(dbapi_conn, _):
    cur = dbapi_conn.cursor()
    cur.execute(f"PRAGMA application_id = {SUBSIDENCE_APP_ID};")
    cur.execute(f"PRAGMA user_version   = {SCHEMA_VERSION};")
    cur.execute("PRAGMA journal_mode    = WAL;")
    cur.execute("PRAGMA foreign_keys    = ON;")
    cur.execute("PRAGMA synchronous     = NORMAL;")
    cur.execute("PRAGMA busy_timeout    = 5000;")
    cur.execute("PRAGMA mmap_size       = 268435456;")
    cur.execute("PRAGMA temp_store      = MEMORY;")
    cur.close()
```

`validate_project_db(path)` reads `application_id` at byte-offset 68 and `user_version` at
offset 60 from the raw SQLite file header. Rejects non-SUBSIDENCE files and files with
schema version newer than the running app.

---

### Step 3 — Project bundle create / open / close

Status: done
Verification: `create_project()` creates bundle dirs + `project.db` + seeded dictionaries; `open_project()` creates `working.db`; `close_project()` removes the session dir
Commit: `9d4e7d6`

`ProjectManager` is a singleton held in `app.state`. Only one project open at a time.

**`create_project(name, path)`:**
1. Create `<path>/<name>.subsidence/` + subdirs: `curves/`, `deviation/`, `results/`,
   `originals/`, `checkpoints/`
2. Init `project.db` with `create_all_tables` + `ProjectMeta` + default `UserModel`
3. Call `seed_dictionaries(session, project_db_path)` (Step 5)
4. Write `manifest.json`: `{ "app": "SUBSIDENCE", "schema_version": 1, "uuid": "<uuid4>" }`
5. `PRAGMA wal_checkpoint(TRUNCATE)`

**`open_project(path)`:**
1. Read + verify `manifest.json`
2. `validate_project_db(project.db)`
3. Check for stale lock + crash recovery
4. Acquire advisory lock
5. Copy `project.db` → `<cache_dir>/sessions/<uuid>/working.db`
6. Create engine against `working.db`; return project info + `recovery_available`

---

### Step 4 — Save and autosave

Status: done
Verification: write -> save -> close -> reopen persists; close without save reverts; autosave writes `recovery.db`; stale lock + recovery re-open reports `recovery_available=True`
Commit: `bbb5d33`

```python
def save_project(self):
    self._execute("PRAGMA wal_checkpoint(TRUNCATE)")
    tmp = self.project_path / "project.db.tmp"
    self._execute(f"VACUUM INTO '{tmp}'")
    fd = os.open(str(tmp), os.O_RDONLY)
    os.fsync(fd); os.close(fd)
    os.replace(tmp, self.project_path / "project.db")
    self._fsync_dir(self.project_path)
    self.undo_stack.mark_clean()
```

Autosave (every 5 min if dirty): `VACUUM INTO recovery.db.new` → `os.replace` →
`recovery.db` in session directory.

---

### Step 5 — Dictionary bootstrap

Status: done
Verification: `create_project()` seeds 17 curve rows and 9 lithology rows; `load_lithology_entries(session)` returns 9 entries; `resolve_curve_alias("GR_1", rules)` returns `family_code="gamma_ray"`
Commit: `bbb5d33`

Create `app/src/subsidence/data/dictionaries/`.


**`curve_families.csv`** — minimum required entries (extend before Phase 4):

```
scope,pattern,is_regex,priority,family_code,canonical_mnemonic,canonical_unit
base,GR,0,10,gamma_ray,GR,API
base,GR*,0,5,gamma_ray,GR,API
base,SGR,0,10,gamma_ray,SGR,API
base,CALI,0,10,caliper,CALI,in
base,BS,0,10,caliper,BS,in
base,ILD,0,10,resistivity_deep,ILD,ohm.m
base,LLD,0,10,resistivity_deep,ILD,ohm.m
base,ILM,0,10,resistivity_medium,ILM,ohm.m
base,RHOB,0,10,bulk_density,RHOB,g/cc
base,DRHOB,0,10,density_correction,DRHOB,g/cc
base,NPHI,0,10,neutron_porosity,NPHI,v/v
base,TNPH,0,10,neutron_porosity,NPHI,v/v
base,CNCF,0,10,neutron_porosity,NPHI,v/v
base,DT,0,10,sonic_p,DT,us/ft
base,DTC,0,10,sonic_p,DT,us/ft
base,DTS,0,10,sonic_s,DTS,us/ft
base,SP,0,10,sp,SP,mV
```

**`lithology_defaults.csv`**:

```
lithology_code,display_name,color_hex,pattern_id,sort_order
sandstone,Sandstone,#F2C98A,sandstone,10
shale,Shale,#A8B8C8,shale,20
limestone,Limestone,#A8D5B0,limestone,30
dolomite,Dolomite,#D0A8D8,dolomite,40
evaporite,Evaporite,#F7E6A0,,50
coal,Coal,#3A3A3A,,60
igneous,Igneous,#C87060,,70
conglomerate,Conglomerate,#D4AA70,,80
metamorphic,Metamorphic,#9090A8,,90
```

`color_hex` here are starting defaults — fully editable per-project via
`PUT /api/projects/dictionary/lithology/{code}`.

**`seed_dictionaries(session, project_db_path)`** — idempotent:

```python
def seed_dictionaries(session: Session, project_db_path: Path) -> None:
    if session.query(CurveDictEntry).count() == 0:
        seed_dir = Path(__file__).parent / "dictionaries"
        _seed_csv(session, CurveDictEntry, seed_dir / "curve_families.csv")
    if session.query(LithologyDictEntry).count() == 0:
        _seed_csv(session, LithologyDictEntry, seed_dir / "lithology_defaults.csv")
    session.commit()
```

The idempotency check means calling `seed_dictionaries` on an existing project (e.g. after
crash recovery) is safe — it will not insert duplicate base rows.

**`load_curve_alias_rules(session)`** — replacement for legacy `curve_dictionary.py`:

```python
SCOPE_RANK = {"user": 3, "project": 2, "base": 1}

def load_curve_alias_rules(session: Session) -> list[CurveDictEntry]:
    rows = session.query(CurveDictEntry).filter_by(is_active=True).all()
    return sorted(rows, key=lambda r: (
        SCOPE_RANK.get(r.scope, 0), r.priority, len(r.pattern)
    ), reverse=True)
```

**`resolve_curve_alias(mnemonic, rules)`** — same algorithm as legacy:

```python
def resolve_curve_alias(mnemonic: str, rules: list[CurveDictEntry]) -> CurveMatchResult:
    name = mnemonic.upper()
    for rule in rules:
        pattern = rule.pattern.upper()
        matched = bool(re.match(pattern, name)) if rule.is_regex \
                  else fnmatch.fnmatch(name, pattern)
        if matched:
            return CurveMatchResult(
                family_code=rule.family_code,
                canonical_mnemonic=rule.canonical_mnemonic,
                canonical_unit=rule.canonical_unit,
                matched=True,
            )
    return CurveMatchResult(None, None, None, False)
```

---

### Step 6 — LAS import into project

```python
def import_las_file(session: Session, project_path: Path, las_path: Path) -> WellModel:
    # 1. Copy to originals/
    dest = project_path / "originals" / las_path.name
    shutil.copy2(las_path, dest)
    source_hash = _sha256(las_path)

    # 2. Parse
    las = lasio.read(str(las_path))
    well = _create_well_from_las(session, las)

    # 3. Load alias rules from DB (already seeded in Step 5)
    rules = load_curve_alias_rules(session)

    # 4. Build DataFrame + create metadata rows
    depth_unit = (las.curves[0].unit or "m").strip()
    depths = convert_depth_to_meters([float(v) for v in las.index], depth_unit)
    data: dict[str, list[float]] = {"DEPT": depths}

    for curve in las.curves:
        mnemonic = curve.mnemonic.strip()
        if mnemonic.upper() in _DEPTH_CANDIDATES:
            continue
        raw_values = [float(v) for v in las[mnemonic]]
        clean_depths, clean_values = _pairwise_clean(depths, raw_values)
        match = resolve_curve_alias(mnemonic, rules)
        source_unit = (curve.unit or "").strip()
        target_unit = match.canonical_unit or source_unit
        if source_unit and target_unit and normalize_unit_name(source_unit) != normalize_unit_name(target_unit):
            try:
                clean_values = convert_curve_units(clean_values, source_unit, target_unit,
                                                   match.family_code)
            except ValueError:
                target_unit = source_unit
        data[mnemonic] = clean_values
        session.add(CurveMetadata(
            well_id=well.id, mnemonic=mnemonic,
            standard_mnemonic=match.canonical_mnemonic,
            family_code=match.family_code,
            unit=target_unit, original_unit=source_unit,
            curve_type="continuous",
            depth_min=min(clean_depths), depth_max=max(clean_depths),
            n_samples=len(clean_depths),
            data_uri=f"curves/{well.id}.parquet",
            source_hash=source_hash,
        ))

    # 5. Write Parquet
    parquet_path = project_path / "curves" / f"{well.id}.parquet"
    df = pd.DataFrame(data)
    pq.write_table(pa.Table.from_pandas(df), parquet_path, compression="snappy")
    session.commit()
    return well
```

---

### Step 7 — Tops and unconformities CSV import

Status: done
Verification: `sample_data/tops.csv` imports 32 rows for `PLESHET 01`; `sample_data/unconformities.csv` updates age bounds on the matching unconformity rows; ICS color lookup resolves `K2m_GHAREB` to `#F2FA8C`
Commit: `22af478`

**CSV format for `import_tops_csv`:**

```
well_name,top_name,depth_md,strat_age_ma,boundary_type,color,note
PLESHET 01,Wilcox,2450.0,55.8,conformable,#F2C98A,
PLESHET 01,Top Paleocene Unconformity,2230.0,,unconformity,#E0E0E0,
```

- `well_name` must match the target well being imported
- `depth_md` is measured depth in metres
- `boundary_type`: `conformable` → `kind="strat"` | anything else → `kind="unconformity"`
- Color priority: explicit `color` in CSV → ICS color by `strat_age_ma` using `ics_chart2023_units.csv` and `ics_chart2023_ranks.csv` → dark gray fallback

**CSV format for `import_unconformities_csv`:**

```
well_name,unc_name,depth_md,end_age_ma,start_age_ma
PLESHET 01,Top Paleocene Unconformity,2230.0,55.8,66.0
```

`import_unconformities_csv` matches by `unc_name` to existing `FormationTopModel` rows
(case-insensitive, stripped). If a match is found, updates `age_top_ma = end_age_ma`
(younger, stratigraphically above) and `age_base_ma = start_age_ma`
(older, stratigraphically below). If no match, creates a new row with `kind="unconformity"`.

This two-file approach keeps tops and unconformity age bounds separate while still letting
the importer assign project-ready colors and update the same `formation_tops` table.

---


---

### Step 8 — Deviation CSV import

Supported column sets (auto-detected):

| Mode | Required columns |
|---|---|
| INCL_AZIM | `md, incl_deg, azim_deg` or `tvd, incl_deg, azim_deg` |
| X_Y | `md, x, y` or `tvd, x, y` |
| DX_DY | `md, dx, dy` |

The importer:
1. Reads column headers (case-insensitive)
2. Determines `reference` and `mode`
3. Validates strictly increasing depth column (raises `ValueError` with row number on failure)
4. Writes Parquet with original column names preserved
5. Creates `DeviationSurveyModel` row

The Parquet schema for deviation:
```
DEPT  float32
COL1  float32   (incl_deg | x | dx)
COL2  float32   (azim_deg | y | dy)
```

MD-to-TVD calculation using the deviation survey is out of scope for Phase 2.5 (Phase 5,
see Out of Scope table). This step only imports and stores the raw survey data.

---

### Step 9 — Undo/redo stack

Status: done
Verification: `UpdateFormationDepth`, `UpdateVisualConfig`, and `ImportWell` execute through `ProjectManager`; push 3 commands -> undo twice -> redo once preserves expected indexed state; `save_project()` marks clean and a later undo flips `is_clean` back to false
Commit: `64cce9c`


```python
class Command(ABC):
    @abstractmethod
    def apply(self, session: Session) -> None: ...
    @abstractmethod
    def revert(self, session: Session) -> None: ...
    @property
    @abstractmethod
    def description(self) -> str: ...

class UndoStack:
    _stack: list[Command]
    _index: int
    _clean_index: int
    _max_size: int = 200
```

Initial command classes:

| Command | `apply()` | `revert()` |
|---|---|---|
| `UpdateFormationDepth` | set `depth_md` to `new_depth` | set `depth_md` to `old_depth` |
| `UpdateVisualConfig` | write `new_config` JSON | write `old_config` JSON |
| `ImportWell` | insert well + curves + Parquet | delete well + curves + Parquet file |

Granularity rule: one command per user-meaningful action. Formation top drag compresses many
intermediate positions into a single `UpdateFormationDepth` on drag-end.

---

### Step 10 — Checkpoints

Status: done
Verification: `create_checkpoint()` writes a snapshot into `checkpoints/`; `list_checkpoints()` returns it; restoring a modified working DB reverts state and auto-creates `before-restore`; `delete_checkpoint()` removes both the file and the DB row
Commit: `c9bd17e`


```python
def create_checkpoint(self, name: str, description: str = ""):
    slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"{ts}__{slug}.db"
    dest = self.project_path / "checkpoints" / filename
    self._execute(f"VACUUM INTO '{dest}'")
    sha = self._sha256(dest)
    with self._session() as s:
        s.add(CheckpointModel(name=name, description=description,
                              timestamp=datetime.utcnow(),
                              file_path=f"checkpoints/{filename}",
                              byte_size=dest.stat().st_size, sha256=sha,
                              app_version=APP_VERSION, schema_version=SCHEMA_VERSION))
        s.commit()
```

`restore_checkpoint`: auto-creates a `before-restore-<id>` checkpoint first (rollback is
itself undoable), then disposes engine, copies checkpoint → working DB, recreates engine,
resets undo stack, marks session dirty.

---

### Step 11 — API endpoints

Status: done
Verification: `projects` router is mounted in FastAPI; lifecycle/import/undo/checkpoint/dictionary endpoints respond over HTTP; round trip `create -> open -> import LAS/tops/unconformities/deviation -> save -> close -> reopen` preserves data and `curve_metadata.family_code` stays populated
Commit: pending


All endpoints access `ProjectManager` via `request.app.state.project_manager`.

**Project lifecycle:**
```
POST   /api/projects                           create_project
POST   /api/projects/open                      open_project
POST   /api/projects/close                     close_project
POST   /api/projects/save                      save_project
GET    /api/projects/status                    { is_dirty, is_open, project_name, ... }
```

**Import:**
```
POST   /api/projects/import-las                body: { las_path: str }
POST   /api/projects/import-tops               body: { well_id, csv_path, depth_ref? }
POST   /api/projects/import-unconformities     body: { well_id, csv_path }
POST   /api/projects/import-deviation          body: { well_id, csv_path }
```

**Undo/redo:**
```
POST   /api/projects/undo
POST   /api/projects/redo
```

**Checkpoints:**
```
POST   /api/projects/checkpoints
GET    /api/projects/checkpoints
POST   /api/projects/checkpoints/{id}/restore
DELETE /api/projects/checkpoints/{id}
```

**Dictionary:**
```
GET    /api/projects/dictionary/curves         list active CurveDictEntry rows
POST   /api/projects/dictionary/curves         add project-scope rule (no undo, admin op)
GET    /api/projects/dictionary/lithology      list LithologyDictEntry rows
PUT    /api/projects/dictionary/lithology/{code}  update color_hex / display_name
```

---

### Steps 12 + 13 — Frontend wiring and visual config

*(Specifications unchanged from original contract — reproduced for completeness.)*

**`useProjectStore`** (`src/stores/projectStore.ts`):
```typescript
interface ProjectStore {
  isOpen: boolean;
  projectName: string | null;
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  openProject: (path: string) => Promise<void>;
  saveProject: () => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  pollStatus: () => Promise<void>;
}
```

Keyboard shortcuts in `App.tsx`: `Ctrl+S` → save, `Ctrl+Z` → undo, `Ctrl+Shift+Z` → redo.
Title bar: `●` prefix when `isDirty=true`.

Visual config scopes:
- `project` — track widths, curve colors, scale settings (scope_id = project UUID)
- `well` — per-well overrides (scope_id = well UUID)
- `session` — last scroll position, split ratio (scope_id = session UUID)

Export stubs: `POST /api/projects/export/las` and `POST /api/projects/export/csv`
return valid files but have no frontend UI until Phase 5.

---

## New and Modified Files

```
app/src/subsidence/
├── data/
│   ├── schema.py              NEW — Base, 12 models, AuditMixin
│   ├── engine.py              NEW — create_engine_for_project, PRAGMA block
│   ├── project_manager.py     NEW — ProjectManager
│   ├── dict_seeder.py         NEW — seed_dictionaries (idempotent)
│   ├── dict_resolver.py       NEW — load_curve_alias_rules, resolve_curve_alias,
│   │                                load_lithology_entries
│   ├── importers.py           NEW — import_las_file, import_tops_csv,
│   │                                import_unconformities_csv, import_deviation_csv
│   ├── loaders.py             MODIFIED — add load_curves_from_parquet,
│   │                                     load_deviation_from_parquet
│   ├── undo.py                NEW — Command ABC, UndoStack, initial commands
│   ├── dictionaries/          NEW directory
│   │   ├── curve_families.csv     base curve alias seed data
│   │   └── lithology_defaults.csv base lithology display seed data
│   └── models.py              KEEP — domain dataclasses reused by loaders
│                                      (DeviationSurvey, LogCurve, etc.)
├── api/
│   ├── main.py                MODIFIED — register projects router, hold ProjectManager
│   ├── projects.py            NEW — all /api/projects/* endpoints
│   └── wells.py               MODIFIED — read from DB + Parquet
│
frontend/src/
├── stores/
│   └── projectStore.ts        NEW
└── App.tsx                    MODIFIED — shortcuts, dirty indicator
```

Dependencies added to `app/pyproject.toml`:
```
pyarrow >= 15.0
platformdirs >= 4.0
```

---

## Execution Order

```
Step 1 (schema)
Step 2 (engine)           ← parallel with Step 1
        ↓
Step 3 (project manager)
        ↓
Step 4 (save/autosave)
Step 5 (dictionaries)     ← parallel with Step 4
        ↓
Step 6 (LAS import)
Step 7 (tops CSV import)  ← parallel with Step 6
Step 8 (deviation import) ← parallel with Step 6 and 7
        ↓
Step 9 (undo stack)
        ↓
Step 10 (checkpoints)
        ↓
Step 11 (API endpoints)
        ↓
Step 12 (rewire frontend)
        ↓
Step 13 (visual config + export)
```

---

## Out of Scope for Phase 2.5

| Feature | Phase | Notes |
|---|---|---|
| Formation top dragging (first write) | 3 | Requires undo commands from Step 9 |
| Discrete curves import and rendering | 3 | `curve_type="discrete"` field is in schema; importer + renderer deferred |
| CSV continuous curves import | 5 | Legacy `load_csv_log_curves()` exists; adapt to new ORM |
| MD→TVD calculation from deviation | 5 | Deviation data stored in Step 8; calculation needs minimum curvature or B-spline |
| Multi-well project UI (well selector) | 3 | Schema supports N wells; UI shows one at a time for now |
| Subsidence calculation + result caching | 4 | `CalculationResult` model is in schema; calculation deferred |
| File→Open / New Project dialogs | 3 | API endpoints exist; no frontend file picker |
| Alembic migrations | 3+ | Not needed until schema changes post-v1 |
| Tauri/Electron desktop packaging | 5 | |
| Cloud sync / collaboration | 6+ | |
| Dictionary UI (add/edit rules in-app) | 3 | API endpoints exist in Step 11; no frontend panel |
| DLIS, LAS 3.0 import | 5 | |

---

## Definition of Done for Phase 2.5

- `create_project("Test", ...)` → `.subsidence/` with all subdirs, `project.db`, seeded
  `curve_dict_entries` (≥15 rows) and `lithology_dict_entries` (9 rows)
- `import_las_file` → Parquet + DB rows; `CurveMetadata.family_code` populated for GR,
  ILD, RHOB, NPHI
- `import_tops_csv` → `FormationTopModel` rows with correct `kind`; after
  `import_unconformities_csv` → `age_top_ma` + `age_base_ma` populated on unconformity rows
- `import_deviation_csv` → Parquet + `DeviationSurveyModel` row with correct mode/reference
- Open → save → close → reopen round-trip preserves all data
- Close without save → reopen → data reverts to last save
- Autosave writes `recovery.db`; kill process → reopen → recovery offered
- Undo/redo works for `UpdateFormationDepth` and `UpdateVisualConfig`
- Checkpoint → restore → data matches checkpoint state
- `npx tsc --noEmit` → zero errors
