# ADR-001: Project Architecture — SUBSIDENCE

**Status:** Accepted  
**Date:** 2026-04-13

---

## Context

SUBSIDENCE is a tool for calculating and visualizing subsidence curves from well data: well logs (LAS), formation tops, and a stratigraphic column.

Two levels of calculation:
- **Level A (Burial History):** layer burial history accounting for ages, depths, thicknesses, and erosion
- **Level B (Tectonic Subsidence):** backstripping — removing compaction and load effects to obtain a tectonic subsidence curve

---

## Decisions

### 1. Frontend: Dash + Plotly

**Decision:** Dash (Plotly) + dash-bootstrap-components  
**Alternative considered:** Streamlit  
**Rationale:**
- Precise layout control required: vertical stratigraphy column on the left, log curves on the right
- Native hover, zoom, and callbacks without workarounds
- Single Python codebase — easier to reuse calculation logic
- Straightforward path to 2D visualization

### 2. Backend: FastAPI

**Decision:** FastAPI  
**Rationale:**
- REST API for LAS/CSV parsing and burial/subsidence calculation endpoints
- Async-ready, scales well
- Automatic OpenAPI documentation

### 3. Data Storage: File-based + SQLite

**Decision:** Raw files on disk; metadata and results in SQLite  
**Alternatives considered:** files only / PostgreSQL  
**Rationale:**
- LAS files are a standard geophysical format and should be stored as-is
- SQLite requires no server, single `project.db` file, fits a local desktop tool
- PostgreSQL is over-engineered at this stage; can be swapped in later via SQLAlchemy with no business logic changes

**File structure:**
```
data/
  stratigraphy_master.csv       # reference stratigraphic column
  wells/
    <well_name>/
      metadata.json             # name, coordinates, TD, CRS
      logs.las                  # well log (read by lasio)
      tops.csv                  # formation tops: formation, depth_top, depth_bot
```

**SQLite (project.db) tables:**
- `wells` — well metadata
- `tops` — formation tops (linked to well)
- `strat_units` — stratigraphic units (loaded from master CSV)
- `burial_results` — burial history calculation results
- `subsidence_results` — backstripping results

### 4. LAS Parsing: lasio

**Decision:** lasio  
**Rationale:** De-facto standard for reading LAS files in Python, actively maintained

### 5. Reference Repositories

Algorithmic logic is borrowed from open-source repositories; they are not added as package dependencies:

| Repo | What we borrow |
|---|---|
| pyBacktrack | decompaction and backstripping algorithms |
| pybasin | burial history and thermal history |
| py_lopatin | Lopatin maturity logic |
| Stratya2D | 2D decompaction (optional) |

### 6. Project Layout

```
app/
  src/subsidence/
    api/          # FastAPI endpoints
    core/         # calculations: burial history, backstripping, decompaction
    data/         # LAS/CSV parsers, SQLite layer
    viz/          # Dash layout and Plotly components
  tests/
data/
  stratigraphy_master.csv
  wells/
docs/
  decisions/      # Architecture Decision Records (ADR)
repos/            # cloned reference repositories (in .gitignore)
```

---

## Consequences

- Full Python stack — single codebase
- Dash is not a classic SPA (no React-style routing), but sufficient for an analysis tool
- SQLite is not suitable for multi-user scenarios; can be replaced with PostgreSQL via SQLAlchemy without changing business logic

## Related Documentation

- Module reference: `README.md`

