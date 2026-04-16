# Current Truth

This document defines what is currently treated as true for the active project.

## Active Scope

- The project is now oriented around `docs/app_compass.md`.
- The current build scope is defined by `docs/phase2-contract.md`.
- The active goal is to complete Phase 2 before any Phase 3 persistence or editing work.

## Active Architecture

- Frontend: React + TypeScript + Vite in `frontend/`
- Visualization: Canvas-first log rendering
- State management: Zustand
- Backend: FastAPI in `app/`
- Well data loading: Python loaders under `app/src/subsidence/data/`

## Active Working Rules

- Build the new version as the primary product path.
- Keep the legacy version only as a knowledge source in `subsidence_archive/`.
- Make decisions based on the current strategy and current phase contract.
- Prefer small checkpoints with explicit review before moving to the next implementation slice.
- Use only the repository-local environment for active work: local `.venv` for Python and local system `node`/`npm` for frontend work.
- Do not use the `ds` environment for SUBSIDENCE.

## Active Repository Landmarks

- `docs/app_compass.md` is the strategy document.
- `docs/phase2-contract.md` is the implementation contract.
- `docs/data-contract-questions.md` defines the persistence questions that must be resolved after Phase 2 and before Phase 3.
- `docs/reference-sources.md` defines the active knowledge sources.
- `docs/decisions/` holds current architectural decisions.
- `todo.md` holds the ordered execution backlog.
- `subsidence_archive/` holds legacy reference material.
