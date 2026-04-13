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
