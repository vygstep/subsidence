# Backend API Module

This module covers FastAPI route ownership.

---

## Entry Point

File:

- `app/src/subsidence/api/main.py`

Responsibilities:

- Create the FastAPI app.
- Configure CORS.
- Attach `ProjectManager` to `app.state`.
- Register route modules explicitly.
- Add request IDs and HTTP request logging through `subsidence.observability`.

Registered router roots:

- `/api/wells...`
- `/api/wells/{well_id}/formations...`
- `/api/top-sets...`
- `/api/strat-charts...`
- `/api/compaction...` and dictionary-style model endpoints
- `/api/export...`
- `/api/lithology-pattern-palettes...`
- `/api/subsidence...` and `/api/ws/recalculate`
- `/api/sea-level-curves...`
- `/api/import-preview...`
- `/api/projects...`

---

## Project Routers

Files:

- `app/src/subsidence/api/projects.py` - project lifecycle, path helpers, shared request/response models.
- `app/src/subsidence/api/projects_imports.py` - import endpoints.
- `app/src/subsidence/api/projects_config.py` - undo/redo, checkpoints, dictionaries, visual config.

All project routers are registered in `main.py` under the same `/api/projects` prefix. Public API paths are unchanged.

`projects.py` responsibilities:

- Project create/open/save/close/status/recent.
- Native path picking and reveal helpers.
- Well management endpoints.
- Shared helpers and Pydantic models imported by the other project router files.

`projects_imports.py` responsibilities:

- Import LAS, logs CSV, wells CSV, tops, and deviation.
- Apply target-well policy, null-value handling, and importer-specific mapping payloads.
- Delegate parsing and payload writes to `data/importers/*`.

`projects_config.py` responsibilities:

- Undo/redo.
- Checkpoint create/list/restore/delete with user comments.
- Dictionary endpoints for curve and lithology defaults.
- Visual config save/load.

Note:

- Native path picking endpoints remain in `projects.py`, but `tkinter` runs in a short subprocess so Tcl/Tk cannot crash the FastAPI server process.
- Keep picker endpoints synchronous from the API caller's perspective; do not import `tkinter` at module scope or create Tk roots in the backend worker process.
- Shared Pydantic models and helpers live in `projects.py` and are imported by the split files.

---

## Export Router

File:

- `app/src/subsidence/api/export.py`

Responsibilities:

- Export well info, logs, tops, deviation, StratCharts, and sea-level curves.
- Support current-well/all-wells scopes where the data type allows it.
- Support per-well files and zip output.
- Use project metadata, current curve mnemonics, and well metadata rather than original imported-file metadata.
- Keep exported CSV/LAS shapes compatible with automatic import workflows where possible.

Common bug areas:

- Exported CSV cannot be imported automatically.
- LAS export uses stale source-file metadata instead of project metadata.
- Per-well export writes unexpected empty columns.
- Destination-folder and zip behavior differ between Windows and macOS.

---

## Wells Router

File:

- `app/src/subsidence/api/wells.py`

Responsibilities:

- List wells and inventories.
- Load a well with curves, formations, zones, and deviation summary.
- Load curve LOD data and full curve data.
- Patch well metadata.
- Delete curves/deviation and clean dependent visual settings.
- Trigger zone lithology recalculation.

High-risk helpers:

- Curve map loading bridges SQLite curve metadata and Parquet payloads. Changes here can make imported curves disappear.
- Delete endpoints must clean dependent settings so removed objects do not remain in visual config.

---

## Formations, Top Sets, and Strat Charts

Files:

- `app/src/subsidence/api/formations.py`
- `app/src/subsidence/api/top_sets.py`
- `app/src/subsidence/api/strat_chart.py`

Responsibilities:

- Formation CRUD, age/type/link operations, and top deletion.
- Top set and horizon CRUD.
- Per-well active top set assignment.
- Pick creation/update/delete behavior.
- TVD recalculation trigger after deviation updates.
- Zone rebuild support through the data layer.
- Strat chart load/list/delete/current operations.
- Strat unit dictionary access.
- Built-in StratChart seeding/hydration through project reference data flows.
- Active StratChart hierarchy validation and unit-code/rank metadata for frontend timescale rendering.

Common bug areas:

- Active chart mismatch.
- Built-in chart not hydrated after project open.
- Tops linked to one chart but rendered against another.
- Formation strat links not refreshed after active chart changes.
- Top set changes leaking between wells.

Strat chart CSV convention:

- `start_age_ma` means the older/base age and should be larger Ma.
- `end_age_ma` means the younger/top age and should be smaller Ma.
- Do not swap these fields back; this convention is used by the ICS import path.

---

## Subsidence and Compaction

Files:

- `app/src/subsidence/api/subsidence.py`
- `app/src/subsidence/api/compaction.py`

Responsibilities:

- WebSocket recalculation.
- Water depth/display options.
- Global model cutoff inputs.
- Compaction, lithology, measurement-unit, curve mnemonic, and model dictionary access.
- Backstrip orchestration.

Common bug areas:

- Blank subsidence panel.
- Stale recalculation after formation edits.
- Slow or blocked recalculation path.
- Stored multi-well results not matching active well recalculation.

---

## Import Preview

File:

- `app/src/subsidence/api/import_preview.py`

Responsibilities:

- Preview LAS and tabular files without committing data.
- Return detected delimiter, column names, sample rows, LAS null values, and warnings for the import wizard.

---

## Sea Level

File:

- `app/src/subsidence/api/sea_level.py`

Responsibilities:

- Sea-level curve CRUD and import.
- Point list access for named curves.
- Per-well active sea-level curve assignment.

---

## Lithology Patterns

File:

- `app/src/subsidence/api/lithology_patterns.py`

Responsibilities:

- Lithology pattern palette CRUD.
- Built-in Equinor SVG palette access.
- User SVG upload/import with sanitization.

Security rule:

- User SVG content must be sanitized before storage or serving.
