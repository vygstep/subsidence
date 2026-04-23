# SUBSIDENCE

SUBSIDENCE is a local web application for well-log visualization, stratigraphic data management, and 1D subsidence/burial-history workflows.

The current implementation uses:

- FastAPI backend in `app/`
- React + TypeScript frontend in `frontend/`
- SQLite + Parquet project bundles on disk
- Canvas/SVG hybrid rendering for well-log visualization
- WebSocket recalculation for subsidence results

The legacy implementation has been preserved in:

- `subsidence_archive/legacy_reset_2026-04-16/`

## Current Scope

Phase 5 is complete. Current work focuses on maintainability, regression tests, process logging, and developer documentation before the next UX/feature pass.

## Active Documents

- [Documentation Index](docs/documentation-index.md)
- [Architecture](docs/architecture.md)
- [Codebase Map](docs/codebase-map.md)
- [Engineering Maintenance Contract](docs/contracts/engineering-maintenance-contract.md)
- [Historical Compass Strategy](docs/contracts/implemented/app_compass.md)
- [Reference Sources](docs/reference-sources.md)
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

## Backend Run

From the project root:

```powershell
cd d:\github\subsidence
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
& .\.venv\Scripts\Activate.ps1
$env:PYTHONPATH = "d:\github\subsidence\app\src"
python -m uvicorn subsidence.api.main:app --host 127.0.0.1 --port 8000
```

Then open:

```text
http://127.0.0.1:8000/health
http://127.0.0.1:8000/docs
```

Direct API check:

```powershell
curl http://127.0.0.1:8000/api/wells/sample
```
