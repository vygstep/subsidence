# SUBSIDENCE

SUBSIDENCE is being reset around the Compass architecture.

The active direction is:

- `docs/app_compass.md` as the strategic architecture target
- `docs/phase1-contract.md` as the execution contract for the current phase

The legacy implementation has been preserved in:

- `subsidence_archive/legacy_reset_2026-04-16/`

## Current Scope

Current work is limited to Phase 1 foundation:

- create a new React + TypeScript frontend in `frontend/`
- extend the Python backend in `app/`
- render static well log curves from a LAS file in the browser
- establish the project structure and current-truth documents

Out of scope for the current phase:

- burial history calculations
- tectonic subsidence calculations
- formation dragging
- WebSocket recalculation
- migration of legacy Dash UI into the active codepath

## Active Documents

- [Compass Strategy](docs/app_compass.md)
- [Phase 1 Contract](docs/phase1-contract.md)
- [Current Truth](docs/current-truth.md)
- [Reference Sources](docs/reference-sources.md)
- [Decision ADR](docs/decisions/ADR-001-compass-phase1-reset.md)
- [Execution Backlog](todo.md)

## Environment Rule

- The active project environment is local to this repository.
- Python backend work uses the local `.venv`.
- Frontend work uses the local system `node` and `npm`.
- The `ds` environment is not used for SUBSIDENCE.

## Frontend Run

From the project root:

```powershell
cd d:\github\subsidence\frontend
$env:Path = "C:\Program Files\nodejs;" + $env:Path
npm run dev -- --host 127.0.0.1
```

Then open:

```text
http://127.0.0.1:5173
```
