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
- Register route modules.

Future maintenance:

- Add request ID middleware here.
- Add application-level logging setup here.
- Keep router registration explicit so endpoint ownership stays discoverable.

---

## Project Router

Files:

- `app/src/subsidence/api/projects.py` — project lifecycle
- `app/src/subsidence/api/projects_imports.py` — import endpoints
- `app/src/subsidence/api/projects_config.py` — undo/redo, checkpoints, dictionaries, visual config
- `app/src/subsidence/api/projects_export.py` — LAS/CSV export endpoints

All four routers are registered in `main.py` under the same `/api/projects` prefix. Public API paths are unchanged.

`projects.py` responsibilities:

- Project create/open/save/close/status/recent.
- Native path picking and reveal helpers.
- Well management endpoints.
- Shared helpers and Pydantic models imported by the other three files.

`projects_imports.py` responsibilities:

- Import LAS, logs CSV, tops, unconformities, deviation.

`projects_config.py` responsibilities:

- Undo/redo.
- Checkpoints.
- Dictionary endpoints (curve rules, lithology defaults).
- Visual config save/load.

`projects_export.py` responsibilities:

- LAS and CSV export.

Note:

- Native path picking endpoints remain in `projects.py`; they are platform-blocking and must not be made async.
- Shared Pydantic models and helpers live in `projects.py` and are imported by the split files.

---

## Wells Router

File:

- `app/src/subsidence/api/wells.py`

Responsibilities:

- List wells and inventories.
- Load a well with curves, formations, and deviation summary.
- Load curve LOD data.
- Patch well metadata.
- Load full deviation survey.

Refactor direction:

- Extract response builders for inventory, well detail, curve payloads, and deviation payloads.

High-risk helper:

- `_load_curve_maps` bridges SQLite curve metadata and Parquet payloads. Changes here can make imported curves disappear.

---

## Formations and Strat Charts

Files:

- `app/src/subsidence/api/formations.py`
- `app/src/subsidence/api/strat_chart.py`

Responsibilities:

- Formation CRUD.
- Formation age/type/link operations.
- Strat chart load/list/delete/current operations.
- Strat unit dictionary access.

Common bug areas:

- Active chart mismatch.
- Built-in chart deletion.
- Tops linked to one chart but rendered against another.
- Formation strat links not refreshed after active chart changes.

---

## Subsidence and Compaction

Files:

- `app/src/subsidence/api/subsidence.py`
- `app/src/subsidence/api/compaction.py`

Responsibilities:

- WebSocket recalculation.
- Water depth/display options.
- Compaction and lithology model access.
- Backstrip orchestration.

Common bug areas:

- Blank subsidence panel.
- Stale recalculation after formation edits.
- Slow or blocked recalculation path.
- Stored multi-well results not matching active well recalculation.
