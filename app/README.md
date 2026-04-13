# app

Main application package for SUBSIDENCE.

## Package Structure

```
src/subsidence/
  api/       # FastAPI backend — REST endpoints
  core/      # Calculations: burial history, backstripping, decompaction
  data/      # LAS/CSV parsers, SQLite repository
  viz/       # Dash frontend — layout and Plotly components
tests/
```

## Install

```bash
pip install -e .
```

For development dependencies:

```bash
pip install -e ".[dev]"
```

## Run

Dash frontend (well log viewer):
```bash
python -m subsidence.viz.app
```

FastAPI backend:
```bash
uvicorn subsidence.api.main:app --reload
```

API docs available at: http://localhost:8000/docs
