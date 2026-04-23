# Logging Module

This module describes the current process logging layer.

---

## Goal

The application should be diagnosable from logs before reading source code.

User-facing error messages are not enough. Maintenance needs operation-level context, timing, project path, well identity, and failure details.

---

## Backend Logging

Backend logging is implemented in `app/src/subsidence/observability.py`.

The backend writes structured JSON lines through the `subsidence` logger. Logging is configured once during FastAPI startup in `app/src/subsidence/api/main.py`.

Set `SUBSIDENCE_LOG_LEVEL` to change verbosity. Default is `INFO`.

Required fields:

- `timestamp`
- `level`
- `request_id`
- `operation`
- `phase`
- `duration_ms` on success/failure events
- `project_path` when available
- `well_id` / `well_name` when available
- `input_path` for import operations when available
- `error_type` / `error_message` on failures

HTTP requests are logged by middleware as `http.request` and receive an `x-request-id` response header. If the client supplies `x-request-id`, the backend preserves it.

Covered operations:

- `project.create`
- `project.open`
- `project.save`
- `project.close`
- `well.create`
- `well.delete`
- `import.las`
- `import.logs_csv`
- `import.tops`
- `import.deviation`
- `strat_chart.import`
- `strat_chart.activate`
- `strat_chart.delete`
- `visual_config.patch`
- `undo.run`
- `redo.run`
- `checkpoint.create`
- `checkpoint.restore`
- `checkpoint.delete`
- `export.las`
- `export.csv`
- `subsidence.calculate`
- `subsidence.recalculate`
- `subsidence.stored_results`

Example:

```json
{"timestamp":"2026-04-23T10:00:00+00:00","level":"info","logger":"subsidence","message":"import.las.success","request_id":"...","operation":"import.las","phase":"success","project_path":"D:\\github\\subsidence\\projects\\demo.subsidence","input_path":"D:\\logs\\well.las","well_id":"...","duration_ms":83.42}
```

## Backend Implementation Files

- `app/src/subsidence/observability.py`: JSON formatter, request ID context, `log_event`, and `operation_log`.
- `app/src/subsidence/api/main.py`: request ID middleware and HTTP request logs.
- `app/src/subsidence/api/projects.py`: project lifecycle, imports, undo/redo, checkpoints, visual config, and export logs.
- `app/src/subsidence/api/strat_chart.py`: strat chart import/activate/delete logs.
- `app/src/subsidence/api/subsidence.py`: calculation and websocket recalculation logs.

---

## Frontend Diagnostics

Frontend should keep a bounded in-memory event buffer.

Required fields:

- `timestamp`
- `level`
- `operation`
- `phase`
- `durationMs`
- `projectPath`
- `activeWellId`
- `selectedObject`
- `message`
- `error`

Required behavior:

- Record start/success/failure for user-triggered workflows.
- Expose a diagnostic export/copy action later.
- Do not log large curve arrays.
- Do not log secrets or unnecessary local filesystem contents beyond paths needed for debugging.

---

## Next Implementation Step

Frontend diagnostics are still pending under `M4 Add frontend diagnostics` in `docs/contracts/engineering-maintenance-contract.md`.
