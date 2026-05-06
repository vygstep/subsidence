# SUBSIDENCE Project - Codex Operating Contract

This file is the primary instruction file for Codex in this repository. Keep it concise, current, and aligned with the active project workflow.

## Communication

- Chat with the user in Russian.
- Write code, comments, documentation, contracts, ADRs, commit messages, and PR text in English.
- Before any action that changes files, runs tests, starts servers, moves files, commits, pushes, or merges, ask for confirmation.
- Show the intended plan before execution. After execution, report what changed and how it was verified.
- Do not commit or push unless the user explicitly asks for it.

## Branch Workflow

- Bug work happens on a dedicated bug/fix branch.
- Fix the bug on that branch, verify it, then return the work to `main` only after the user confirms.
- Do not merge to `main` automatically.
- Before starting a fix, check the current branch and working tree state.
- Never discard or revert user changes unless the user explicitly asks for that exact operation.

## Planning Workflow

1. Brainstorm and discuss the problem.
2. Record the agreed plan in an active contract under `docs/contracts/`.
3. Execute only after confirmation.
4. Report results and wait for the next confirmation before continuing.

## Planning Files

- `todo.md` contains only active work that still needs to be done.
- Every active `todo.md` item should link to an active contract in `docs/contracts/`.
- Completed items should be removed from `todo.md`; do not keep checked-off history there.
- Completed or superseded contracts go to `docs/contracts/implemented/`.
- Current architecture and navigation docs live under `docs/` and `docs/modules/`.
- `docs/contracts/implemented/` is historical context, not the active plan.

## Context Files To Read First

When resuming work, read these before making assumptions:

- `todo.md` - current active work, but verify it against `docs/contracts/`.
- `docs/contracts/` - active contracts.
- `CLAUDE.md` - technical project context, architecture notes, known pitfalls, and run commands.
- `docs/codebase-map.md` - where to look by symptom.
- Relevant files under `docs/modules/` for API or subsystem details.

If `todo.md` and `docs/contracts/` disagree, stop and ask which source should be treated as current.

## Project Shape

- Local web application for 1D burial history and tectonic subsidence/backstripping.
- Backend: FastAPI, SQLite, Parquet.
- Frontend: React, Zustand, Canvas.
- Reference repositories are cloned under `repos/`.

Main areas:

- `app/src/subsidence/api/` - FastAPI routes.
- `app/src/subsidence/data/` - schema, project manager, zone service, importers, backstrip logic, undo commands.
- `frontend/src/stores/` - Zustand stores.
- `frontend/src/components/` - UI components.
- `docs/` - architecture, contracts, module documentation.

## Technical Guardrails

- There is no Alembic. New schema fields require lightweight migrations in `app/src/subsidence/data/engine.py`.
- Mutating backend operations should normally go through `manager.execute_command(...)` so undo/redo remains coherent.
- `activate_top_set_for_well(...)` is the main entrypoint for setting an active TopSet. It links picks, creates ghost picks, ensures zone rows, recalculates thickness, and aggregates lithology.
- Call `ensure_zone_well_data(...)` before `recalculate_zone_thickness(...)`; the latter does not create missing rows by itself.
- `rebuild_horizon_links(...)` is destructive for pick `horizon_id` links. Use it only when the user explicitly changes horizon ages, not during project open.
- Route changes must be checked against the frontend because some fetch paths silently ignore non-OK responses.
- Avoid native blocking dialogs in async routes such as `pick-file` and `pick-folder`.

## Run Commands

Backend:

```bash
cd app && uvicorn subsidence.api.main:app --reload --port 8000
```

Frontend:

```bash
cd frontend && npm run dev
```

Tests:

```bash
cd app && pytest tests
cd frontend && npm run test -- --run
```

Ask before running these commands.

## Current Project Scope

Level A - Burial History:

- Ages, depths, and layer thicknesses.
- Erosion handling.
- Burial history reconstruction.

Level B - Tectonic Subsidence / Backstripping:

- Decompaction.
- Water and sediment load removal.
- Tectonic subsidence calculation.

## Reference Repositories

| Repo | Priority | Purpose |
|---|---:|---|
| `pyBacktrack` | Critical | Backstripping and decompaction reference |
| `pybasin` | High | Burial history and thermal model reference |
| `py_lopatin` | Medium | Lopatin logic and burial calculation |
| `Stratya2D` | Low | Optional 2D decompaction reference |
