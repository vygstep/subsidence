# Current Truth

This document defines what is currently treated as true for the active project.

## Active Scope

- The project is now oriented around `docs/app_compass.md`.
- The current build scope is defined by `docs/phase1-contract.md`.
- The active goal is to complete Phase 1 foundation before any later-phase feature work.

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

## Active Repository Landmarks

- `docs/app_compass.md` is the strategy document.
- `docs/phase1-contract.md` is the implementation contract.
- `docs/decisions/` holds current architectural decisions.
- `todo.md` holds the ordered execution backlog.
- `subsidence_archive/` holds legacy reference material.
