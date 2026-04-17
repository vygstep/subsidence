# Current Truth

This document defines what is currently treated as true for the active project.

## Active Scope

- The project is now oriented around `docs/app_compass.md`.
- `Phase 2` is complete.
- The active implementation scope is now `docs/phase2.5-data_contract.md`.
- `Phase 2.5 Step 1` and `Step 2` are complete.
- The active goal is to finish the data persistence layer before starting `Phase 3` interaction work.

## Active Architecture

- Frontend: React + TypeScript + Vite in `frontend/`
- Visualization: Canvas-first log rendering
- State management: Zustand
- Backend: FastAPI in `app/`
- Persistence target: project bundle with SQLite metadata plus sidecar Parquet files
- Well data loading: Python loaders under `app/src/subsidence/data/`

## Active Working Rules

- Build the new version as the primary product path.
- Keep the legacy version only as a knowledge source in `subsidence_archive/`.
- Make decisions based on the current strategy and current active contract documents.
- Prefer small checkpoints with explicit review before moving to the next implementation slice.
- Use only the repository-local environment for active work: local `.venv` for Python and local system `node`/`npm` for frontend work.
- Do not use the `ds` environment for SUBSIDENCE.

## Active Repository Landmarks

- `docs/app_compass.md` is the strategy document.
- `docs/phase2-contract.md` is the completed implementation contract for the current viewer baseline.
- `docs/phase2.5-data_contract.md` is the active implementation contract for the persistence layer.
- `docs/reference-sources.md` defines the active knowledge sources.
- `docs/decisions/` holds current architectural decisions.
- `todo.md` holds the ordered execution backlog.
- `subsidence_archive/` holds legacy reference material.
