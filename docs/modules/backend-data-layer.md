# Backend Data Layer Module

This module covers project persistence, importers, schema, undo/redo, and dictionaries.

---

## Project Manager

File:

- `app/src/subsidence/data/project_manager.py`

Responsibilities:

- Track open project state.
- Create/open/close project folders.
- Manage SQLite engine/session lifecycle.
- Maintain recent project list.
- Save and checkpoint project state.

Risk:

- This is the backend state center. A bug here can affect every workflow.

Tests required before refactor:

- project create/open/save/close/reopen
- recent projects
- checkpoint create/restore/delete
- session lifecycle after close/open

---

## Schema and Models

Files:

- `app/src/subsidence/data/schema.py`
- `app/src/subsidence/data/models.py`

Responsibilities:

- SQLAlchemy table definitions.
- Domain/Pydantic-style data models.
- Persisted object identity and metadata.

Rule:

- Any schema change must include compatibility notes or a migration plan.

Migration owner:

- `app/src/subsidence/data/engine.py` handles lightweight project DB migrations and validation.

---

## Importers

Files:

- `app/src/subsidence/data/importers/__init__.py` — re-exports all public symbols
- `app/src/subsidence/data/importers/common.py` — shared helpers and well resolution
- `app/src/subsidence/data/importers/las.py` — LAS import
- `app/src/subsidence/data/importers/logs_csv.py` — logs CSV import
- `app/src/subsidence/data/importers/tops.py` — tops and unconformities import
- `app/src/subsidence/data/importers/deviation.py` — deviation survey import
- `app/src/subsidence/data/loaders.py` — read curve/deviation payloads from Parquet

All callers import from `data.importers` (package); public function signatures are unchanged.

`common.py` owns:

- CSV reading helpers, numeric parsing, well identity resolution.
- `create_empty_well`, `apply_imported_well_metadata`.
- Curve payload writing.
- ICS utility functions.

`loaders.py` owns reading curve and deviation payload files back from disk. Import tests must verify not only SQLite rows but also payload reopen.

Important import behaviors:

- If target well is explicitly selected, source data without well identity should import into that active target well.
- If source data has a matching existing well name/identity, import should reuse that well unless user intentionally creates a new one.
- Tops, logs, and deviation imports must be independent.
- Imported logs deeper than current TD may update well TD.

---

## Undo and Checkpoints

File:

- `app/src/subsidence/data/undo.py`

Responsibilities:

- Record reversible operations.
- Apply undo/redo.
- Support project checkpoint operations through API.

Common bug areas:

- Operation changes data but does not record undo.
- Undo restores metadata but not payload files.
- Checkpoint restore leaves frontend with stale state.

---

## Dictionaries and Linking

Files:

- `app/src/subsidence/data/dict_seeder.py`
- `app/src/subsidence/data/dict_resolver.py`
- `app/src/subsidence/data/strat_link.py`
- `app/src/subsidence/data/unit_conversion.py`

Responsibilities:

- Seed built-in curve, lithology, and stratigraphy dictionaries.
- Resolve curve mnemonic defaults.
- Link tops to strat chart units.
- Normalize units.

Dictionary payload files:

- `app/src/subsidence/data/dictionaries/curve_families.csv`
- `app/src/subsidence/data/dictionaries/lithology_defaults.csv`

Related frontend defaults:

- `frontend/src/utils/curvePresets.ts`

Common bug areas:

- Missing mnemonic defaults.
- Incorrect unit normalization.
- Tops not linked to the active chart.
- Backend mnemonic dictionary and frontend visual presets diverge.

---

## LOD and Calculations

Files:

- `app/src/subsidence/data/lttb.py`
- `app/src/subsidence/data/backstrip.py`

Responsibilities:

- `lttb.py`: curve downsampling for visible-window endpoints.
- `backstrip.py`: Athy decompaction and Airy backstripping.

Rule:

- Treat `backstrip.py` as scientific logic. Changes need unit tests.
- Treat `lttb.py` as performance/display logic. Changes need endpoint and viewer checks.
