# SUBSIDENCE

A tool for calculating and visualizing subsidence curves from well data:
well logs (LAS), formation tops, and a stratigraphic column.

## Project Structure

```
app/                            # main application
  src/subsidence/
    api/                        # FastAPI backend
    core/                       # burial history, backstripping, decompaction
    data/                       # LAS/CSV parsers, SQLite layer
    viz/                        # Dash frontend
  tests/
data/
  stratigraphy_master.csv       # reference stratigraphic column
  wells/<well_name>/
    metadata.json
    logs.las
    tops.csv
docs/
  decisions/                    # Architecture Decision Records
repos/                          # reference repositories (git-ignored)
```

## Quick Start

```bash
cd app
pip install -e .
```

Run the Dash frontend:
```bash
python -m subsidence.viz.app
```

Run the FastAPI backend:
```bash
uvicorn subsidence.api.main:app --reload
```

See [docs/decisions/ADR-001-project-architecture.md](docs/decisions/ADR-001-project-architecture.md) for full architecture decisions.

## Module Reference

This section describes the current Python modules in `app/src/subsidence` and the test suite in `app/tests`.

### Scope

- `data` — domain models, CSV/LAS loaders, curve dictionary matching, and unit normalization
- `viz` — Dash application and Plotly figure builders for well log display
- `api` — FastAPI application entrypoint
- `core` — reserved package for burial history, decompaction, and backstripping logic
- `tests` — current automated coverage for the data layer

### Current Status

- `data` is the most complete package in the current MVP
- `viz` provides a working demo viewer based on synthetic in-memory data
- `api` exposes only a health-check endpoint
- `core` is intentionally empty and still awaits implementation
- `tests` currently validate CSV parsing, stratigraphy loading, dictionary matching, and unconformity linking

### Detailed Pages

- [Data Module](docs/modules/data.md)
- [Visualization Module](docs/modules/viz.md)
- [API Module](docs/modules/api.md)
- [Core Module](docs/modules/core.md)
- [Test Modules](docs/modules/tests.md)
