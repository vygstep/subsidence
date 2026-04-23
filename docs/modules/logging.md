# Logging Module

This module defines the planned process logging layer.

---

## Goal

The application should be diagnosable from logs before reading source code.

User-facing error messages are not enough. Maintenance needs operation-level context, timing, project path, well identity, and failure details.

---

## Backend Logging

Backend logs should be structured and grep-friendly. JSON lines are preferred.

Required fields:

- `timestamp`
- `level`
- `request_id`
- `operation`
- `phase`
- `duration_ms`
- `project_path`
- `well_id`
- `well_name`
- `input_path`
- `result_summary`
- `error_type`
- `error_message`

Required operations:

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
- `strat_chart.load`
- `strat_chart.delete`
- `visual_config.patch`
- `undo.run`
- `redo.run`
- `checkpoint.create`
- `checkpoint.restore`
- `subsidence.recalculate`

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

## First Implementation Step

Add backend request ID middleware and operation logging around project lifecycle and imports. These workflows produce the most expensive bugs to diagnose manually.
