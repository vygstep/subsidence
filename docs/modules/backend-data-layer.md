# Backend Data Layer Module

This module covers project persistence, importers, schema, undo/redo, dictionaries, and calculation services.

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
- `app/src/subsidence/data/engine.py`

Responsibilities:

- SQLAlchemy table definitions.
- Domain/Pydantic-style data models.
- Persisted object identity and metadata.
- SQLite table creation, pragmas, validation, and lightweight migrations.

Rule:

- Any schema change must include compatibility notes or a migration plan unless the project format is intentionally reset during development.

---

## Importers

Files:

- `app/src/subsidence/data/importers/__init__.py` - public importer re-exports.
- `app/src/subsidence/data/importers/common.py` - shared helpers and well resolution.
- `app/src/subsidence/data/importers/las.py` - LAS import.
- `app/src/subsidence/data/importers/logs_csv.py` - logs CSV import.
- `app/src/subsidence/data/importers/tops.py` - tops and unconformities import.
- `app/src/subsidence/data/importers/deviation.py` - deviation survey import.
- `app/src/subsidence/data/importers/wells.py` - wells CSV import.
- `app/src/subsidence/data/importers/log_resampling.py` - shared log curve resampling helpers.
- `app/src/subsidence/data/importers/preview.py` - LAS/tabular preview.
- `app/src/subsidence/data/loaders.py` - read curve/deviation payloads from Parquet.

`common.py` owns:

- CSV reading helpers, numeric parsing, and well identity resolution.
- `create_empty_well`, `apply_imported_well_metadata`.
- Curve payload writing.
- Null-value parsing and target-well fallback defaults.

Important import behaviors:

- If target well is explicitly selected, source data without well identity imports into that target well.
- If source data has a matching existing well name/identity, import should reuse that well unless the user intentionally creates a new one.
- Tops, logs, deviation, and wells imports must be independent.
- Imported logs deeper than current TD may update well TD and warn the user.
- LAS and logs CSV imports resample curves onto a per-well MD reference grid.
- Continuous curves use linear interpolation.
- Discrete curves use down-step blocking with null gaps preserved.
- LAS export uses the same resampling semantics so exported files are project-compatible.

---

## Export Assembly

File:

- `app/src/subsidence/api/export.py`

Although this is an API module, most export assembly currently lives inside the router file.

Export responsibilities:

- Read SQLite metadata and Parquet payloads.
- Export well info, logs, tops, deviation, StratCharts, and sea-level curves.
- Write files to a user-selected folder.
- Optionally package per-well outputs into zip files.
- Preserve project metadata rather than original source-file metadata.

Refactor direction:

- If export logic grows further, extract pure file builders into `app/src/subsidence/data/exporters/`.

---

## Undo and Checkpoints

File:

- `app/src/subsidence/data/undo.py`

Responsibilities:

- Record reversible operations.
- Apply undo/redo.
- Support project checkpoint operations through API.

Checkpoint behavior:

- Checkpoints store recoverable project state.
- The create-checkpoint UI collects a user comment and shows compact project statistics.
- Restore warns that current project state can be replaced.

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
- `app/src/subsidence/data/unit_registry.py`

Dictionary payload files:

- `app/src/subsidence/data/dictionaries/curve_families.csv`
- `app/src/subsidence/data/dictionaries/lithology/lithology_core.csv`
- `app/src/subsidence/data/dictionaries/lithology_sets/default_lithologies.csv`
- `app/src/subsidence/data/dictionaries/strat_charts/ics_2023.csv`
- `app/src/subsidence/data/dictionaries/sea_level/sea_level_binned_models.csv`
- `app/src/subsidence/data/dictionaries/compaction/compaction_presets.csv`

Responsibilities:

- Seed built-in curve, lithology, StratChart, sea-level, unit, and compaction defaults.
- Resolve curve mnemonic defaults.
- Link tops to active StratChart units.
- Normalize units and unit aliases.

Common bug areas:

- Missing mnemonic defaults.
- Incorrect unit normalization.
- Tops not linked to the active chart.
- Backend mnemonic dictionary and frontend visual presets diverge.
- Built-in dictionaries missing from a new project after project open.

---

## Calculations and Derived Data

Files:

- `app/src/subsidence/data/lttb.py`
- `app/src/subsidence/data/backstrip.py`
- `app/src/subsidence/data/deviation_transform.py`
- `app/src/subsidence/data/zone_service.py`

Responsibilities:

- `lttb.py`: curve downsampling for visible-window endpoints.
- `backstrip.py`: Athy decompaction and Airy backstripping.
- `deviation_transform.py`: MD/TVD/TVDSS conversion from deviation surveys.
- `zone_service.py`: rebuild zones and lithology fractions from top sets and log curves.

Rule:

- Treat `backstrip.py` and `deviation_transform.py` as scientific logic. Changes need focused tests.
- Treat `zone_service.py` as shared derived-data logic. Changes need cross-well/topset checks.
- Treat `lttb.py` as performance/display logic. Changes need endpoint and viewer checks.
