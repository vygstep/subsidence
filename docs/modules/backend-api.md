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

---

## Project Router

File:

- `app/src/subsidence/api/projects.py`

Responsibilities:

- Project create/open/save/close/status/recent.
- Native path picking and reveal helpers.
- Import endpoints for LAS, logs CSV, tops, unconformities, and deviation.
- Undo/redo.
- Checkpoints.
- Dictionary endpoints.
- Visual config endpoints.
- LAS/CSV export endpoints.

Known risk:

- This router is too large and mixes unrelated responsibilities.

Refactor direction:

- Keep public paths stable.
- Extract service functions first.
- Split route groups only after tests cover project lifecycle and imports.

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
