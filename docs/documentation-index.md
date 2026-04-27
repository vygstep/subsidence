# SUBSIDENCE Documentation

This is the main navigation document for development and maintenance.

Phase contracts are historical execution records. For current architecture and debugging, start here and follow the module links below.

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
- Lithology pattern palettes (built-in equinor SVG set + user uploads)
- Stratigraphic zone system with lithology aggregation from curves
- Measurement unit registry and normalization engine

All contracts through bugs-and-features (Phases A–F) are complete. Current future work is tracked in `todo.md`.

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

- [Lithology Pattern Palettes](lithology-pattern-palettes.md): built-in equinor SVG pattern source, seed snapshot location, and runtime vs checkout separation.

---

## Active Contracts

No active contracts. Start a new contract file in `docs/contracts/` to continue development.

---

## Implemented Contracts

Implemented or superseded contracts are archived in `contracts/implemented/`. They are useful for understanding why features exist, but they are not the primary current architecture map:

- [Bugs and Features (Phases A–F)](contracts/implemented/bugs_and_features.md)
- [1D Well Model Architecture](contracts/implemented/well_1d_model_architecture.md)
- [1D Well Model Summary](contracts/implemented/well_1d_model_summary.md)
- [Engineering Maintenance Contract](contracts/implemented/engineering-maintenance-contract.md)
- [Phase 5 Contract](contracts/implemented/phase5-contract.md)
- [Phase 4 Contract](contracts/implemented/phase4-contract.md)
- [Phase 3 Cleanup 2 Contract](contracts/implemented/phase3-cleanup2-contract.md)
- [Phase 3 Cleanup Contract](contracts/implemented/phase3-cleanup-contract.md)
- [Phase 3 Contract](contracts/implemented/phase3-contract.md)
- [Phase 2.5 Data Contract](contracts/implemented/phase2.5-data_contract.md)
- [Phase 2 Contract](contracts/implemented/phase2-contract.md)
- [Phase 1 Contract](contracts/implemented/phase1-contract.md)

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

Baseline from 2026-04-23:

- Frontend: 34 passed.
- Backend: 30 passed.
