# SUBSIDENCE Architecture

This document describes the current implementation shape at a high level. Detailed ownership lives in the module documents linked from `docs/documentation-index.md`.

---

## Runtime Overview

SUBSIDENCE runs as a local web application:

- The backend is a FastAPI service.
- The frontend is a Vite React application.
- The user opens the frontend in a browser and interacts with project files through backend endpoints.
- Project data is persisted in local `.subsidence` project folders.

Runtime roots:

- Backend package: `app/src/subsidence`
- Frontend source: `frontend/src`
- Sample data: `sample_data`
- Project runtime data: `projects`

---

## Backend Layers

The backend has three practical layers:

1. API routers in `app/src/subsidence/api`
2. Data/project services in `app/src/subsidence/data`
3. Project bundle files on disk

The API layer should stay thin over time. Route handlers should validate input, call services, and return response models.

The data layer owns project open/close/save state, SQLite sessions, import parsing, payload writes, undo/redo, checkpoints, dictionaries, stratigraphic linking, and backstrip calculations.

---

## Frontend Layers

The frontend has four practical layers:

1. Application shell and layout components
2. Zustand stores
3. Renderer/components for log and subsidence visualization
4. API calls and diagnostics

The most important state boundary is store ownership:

- `projectStore`: project lifecycle and visual config persistence.
- `wellDataStore`: active well, curves, formations, inventories.
- `workspaceStore`: per-well viewer templates and track configuration.
- `viewStore`: UI selection, zoom, scroll, active panes.
- `computedStore`: subsidence recalculation state and display toggles.
- `multiWellStore`: multi-well/subsidence workspace state.

---

## Core Data Flows

### Open Project

1. Frontend calls the project open endpoint.
2. Backend opens the project through `ProjectManager`.
3. Frontend loads status, visual config, well inventories, and an active well.
4. The viewer hydrates the active well and its per-well visual state.

### Import Logs

1. User selects LAS or logs CSV.
2. Frontend posts an import request with a target well policy.
3. Backend importer resolves an existing well or creates one.
4. Curve metadata is stored in SQLite.
5. Curve arrays are written as Parquet payloads.
6. Frontend refreshes inventories and the affected well.

### Subsidence Recalculation

1. Formation edits or subsidence controls trigger recalculation.
2. Frontend sends a WebSocket payload.
3. Backend computes using the backstrip/subsidence code path.
4. Frontend receives results and redraws the subsidence panel.

---

## Maintainability Principles

- Preserve API paths unless a migration is explicitly planned.
- Keep project file format compatibility unless a migration is documented.
- Add tests before refactoring large behavior-heavy files.
- Prefer pure helper extraction before moving stateful React or backend service code.
- Keep generated project artifacts out of source commits unless they are explicit fixtures.
- Use logs for process diagnosis, not only user-facing error messages.
