# SUBSIDENCE Documentation

This is the main navigation document for development and maintenance.

For current architecture and debugging, start here and follow the module links below.

---

## Current Program State

SUBSIDENCE is a local desktop-style web application for well-log visualization, stratigraphic data management, and 1D subsidence/burial-history workflows.

The current implementation is built around:

- FastAPI backend in `app/src/subsidence`
- React + TypeScript frontend in `frontend/src`
- Zustand stores for frontend state
- Canvas/SVG hybrid rendering for logs and stratigraphy
- SQLite + Parquet project bundles on disk
- WebSocket recalculation path for subsidence results
- Import Wizard with tabular/LAS preview and column mapping
- Export workflows for well info, logs, tops, deviation, StratCharts, and sea-level curves
- Lithology pattern palettes (built-in Equinor SVG set + user uploads)
- Stratigraphic zone system with lithology aggregation from curves
- Active StratChart-driven geological timescale and global model cutoff controls
- Resampled log import/export path with per-well MD reference grids
- Measurement unit registry and normalization engine

Current active work is tracked in `todo.md`. Completed implementation contracts are local maintainer notes and are intentionally not part of the public documentation tree.

---

## Start Here

- [Architecture](architecture.md): application runtime shape, data flow, and project bundle model.
- [Codebase Map](codebase-map.md): compact "where to look" map by bug type.
- [Execution Backlog](../todo.md): active checkpoint list.

---

## Module Documentation

Backend:

- [Backend API](modules/backend-api.md): route modules and API responsibilities.
- [Backend Data Layer](modules/backend-data-layer.md): project manager, schema, importers, undo, dictionaries.
- [Project Format](modules/project-format.md): `.subsidence` project bundle structure.

Frontend:

- [Frontend State](modules/frontend-state.md): Zustand stores and state ownership.
- [Frontend Layout](modules/frontend-layout.md): app shell, toolbar, Data Manager, settings pane, dialogs.
- [Frontend Viewer](modules/frontend-viewer.md): log viewer, track rendering, overlays, and styling risks.
- [Subsidence Panel](modules/subsidence-panel.md): recalculation path, panel rendering, controls, and export.

Quality:

- [Testing](modules/testing.md): current tests, missing coverage, and regression matrix ownership.
- [Regression Test Matrix](regression-test-matrix.md): workflow-level test worklist.
- [Logging](modules/logging.md): planned backend/frontend process logging contract.

Reference:

- [Lithology Pattern Palettes](lithology-pattern-palettes.md): built-in Equinor SVG pattern source, seed snapshot location, and runtime vs checkout separation.
- [Reference Sources](reference-sources.md): external scientific and implementation references.

---

## Audit Snapshots

Audit snapshots are point-in-time analysis notes. They are useful context, but they are not canonical architecture documentation.

- [2026-05 Refactor Map](audits/2026-05-refactor-map/07-reorganization-plan.md): trigger/data/schema/API/settings/risk maps used to prepare `REFACTOR-001`.

---

## Active Contracts

See [Execution Backlog](../todo.md) for active contracts and checkpoint status.

---

## Current Test Commands

Frontend:

```bash
cd frontend
npm run test -- --run
```

Backend:

```bash
cd app
pytest tests
```

Recent baseline from 2026-05-17:

- Frontend: 88 passed.
- Backend: 156 passed.
