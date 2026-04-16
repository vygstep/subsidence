# Data Persistence — Open Questions Before Phase 3

## When to address this

**After Phase 2, before Phase 3.**

Phases 1 and 2 are read-only — the app only reads a LAS file and displays it.
No writes happen, so a hardcoded `sample.las` is sufficient.

Phase 3 introduces the first write operation: formation top dragging. The moment
a user drags a formation top, something has to persist that change. If the data
layer is not designed before Phase 3 starts, formation tops will live only in
Zustand (lost on page refresh), and the API + frontend stores will need to be
retrofitted in Phase 4.

---

## Questions to answer

### 1. What is a "project"?

- A folder on disk containing LAS files + a metadata file?
- A SQLite database file (one per project)?
- A record in a shared PostgreSQL database?

### 2. Where do LAS files live?

- Uploaded through the API and stored server-side?
- Already present on a server folder, scanned on startup?
- Referenced by path only (file stays wherever the user put it)?

### 3. How are formation tops persisted?

- A JSON sidecar file next to each LAS file?
- A `formation_tops` table in a project database?
- Embedded in the LAS file itself (non-standard)?

### 4. Database engine

- **SQLite** — simple, single-user, file-based, zero server setup.
  Already used in `curve_dictionary.py`. Good for desktop/local use.
- **PostgreSQL** — multi-user, production-ready, needs a server.
  Overkill if this is a single-geologist tool.

### 5. Well catalog

- How does the app know which wells are available?
- Scan a folder for `*.las` files on startup?
- A `wells` table in the database?
- A JSON manifest file per project?

### 6. Calculation result caching

- Are subsidence/backstripping results recalculated fresh every time?
- Cached in memory (lost on server restart)?
- Stored in the database alongside the formation tops?

### 7. Layout and track config persistence

- When a user changes track widths or curve colours, is that saved?
- Per-well layout? Per-project layout? Named templates?

---

## What already exists in the codebase

- `SQLAlchemy >= 2.0` is already in `app/pyproject.toml` dependencies
- `curve_dictionary.py` uses SQLite — proven pattern to follow
- `app/src/subsidence/data/models.py` has `Well`, `LogCurve`, `StratTopPick`,
  `FormationTop` — domain models are already defined, just not persisted
- `app/data/sample.las` — one hardcoded well, no catalog yet

---

## Suggested research directions

- How Petrel / Kingdom store project data (folder + binary DB hybrid)
- OSDU (Open Subsurface Data Universe) data model — overkill but good reference
- Whether SQLite WAL mode is sufficient for concurrent reads during calculation
- RESQML / LAS 3.0 for standardised formation top storage
