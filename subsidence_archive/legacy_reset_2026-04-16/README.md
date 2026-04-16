# SUBSIDENCE

SUBSIDENCE is a Python project for loading well data, viewing it, and later calculating burial history and tectonic subsidence.

Right now this is an early working foundation, not a finished scientific package.

## What It Does Right Now

- loads well-log data from LAS and CSV files
- loads stratigraphy dictionaries from CSV
- loads tops and unconformities from CSV
- normalizes selected curve aliases and units
- runs a demo Dash viewer
- runs a minimal FastAPI backend

## What Is Not Ready Yet

- burial-history calculations
- decompaction and backstripping calculations
- a full end-to-end workflow from raw project files to calculated results
- a UI connected to real project data instead of demo data

## Quick Start

### 1. Create a virtual environment

```powershell
cd d:\github\subsidence
python -m venv .venv
```

### 2. Activate it

```powershell
.\.venv\Scripts\Activate.ps1
```

If another environment is already active, deactivate it first if you want to work only inside `.venv`.

### 3. Install the project

```powershell
cd d:\github\subsidence\app
pip install -e ".[dev]"
```

If you do not want test dependencies:

```powershell
pip install -e .
```

## Run The Project

### Run the viewer

From the `app` directory:

```powershell
python -m subsidence.viz.app
```

What you should expect:

- a Dash app opens locally
- the left side shows a demo stratigraphic column
- the right side shows demo log curves
- the data is synthetic for now

### Run the API

From the `app` directory:

```powershell
uvicorn subsidence.api.main:app --reload
```

Then open:

- `http://localhost:8000/docs` for API docs
- `http://localhost:8000/health` for the health check

### Run tests

From the `app` directory:

```powershell
pytest
```

## Minimal Example

```powershell
cd d:\github\subsidence
python -m venv .venv
.\.venv\Scripts\Activate.ps1
cd app
pip install -e ".[dev]"
python -m subsidence.viz.app
```

In another terminal:

```powershell
cd d:\github\subsidence
.\.venv\Scripts\Activate.ps1
cd app
uvicorn subsidence.api.main:app --reload
```

## Built With

- Python 3.10+
- Dash
- Plotly
- FastAPI
- Uvicorn
- lasio
- pandas
- SQLAlchemy
- numpy
- scipy

## Repository Layout

```text
subsidence/
  app/
    src/subsidence/
      api/
      core/
      data/
      viz/
    tests/
    pyproject.toml
  docs/
    decisions/
    modules/
  repos/
  todo.md
```

## More Documentation

- [Architecture Decision Record](docs/decisions/ADR-001-project-architecture.md)
- [Planning TODO](todo.md)
- [Data Module](docs/modules/data.md)
- [Visualization Module](docs/modules/viz.md)
- [API Module](docs/modules/api.md)
- [Core Module](docs/modules/core.md)
- [Test Modules](docs/modules/tests.md)
