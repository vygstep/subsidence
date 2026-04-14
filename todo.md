# TODO & Ideas — SUBSIDENCE Project

## Data Storage (Approved)

**Strategy:** File-based + SQLite

- Сырые данные (LAS, CSV каротаж, отбивки) → `data/wells/<well_name>/` на диске
- Метаданные скважин, стратиграфия, результаты расчетов → SQLite (`project.db`)
- SQLite подключается на фазе 1, чтобы не переделывать позже

**Структура данных:**
```
data/
  stratigraphy_master.csv       # эталонная стратиграфическая колонка (цвета, возраста, юниты)
  wells/
    <well_name>/
      metadata.json             # имя, координаты, TD, CRS
      logs.las                  # каротаж (читается через lasio)
      tops.csv                  # отбивки: formation, depth_top, depth_bot
```

**SQLite (project.db) tables:**
- `wells` — метаданные скважин
- `tops` — отбивки (linked to well)
- `strat_units` — стратиграфические юниты (из master CSV)
- `burial_results` — результаты расчетов burial history
- `subsidence_results` — результаты backstripping

---

## Tech Stack (Approved)

**Frontend:**
- Dash (Python web framework for interactive dashboards)
- Plotly (charts with hover, zoom, selection)
- dash-bootstrap-components (UI components)

**Backend:**
- FastAPI (REST API for data processing)
- lasio (LAS file reader)
- Pandas (CSV/data manipulation)

**Core/Calculation:**
- numpy, scipy (numerical computations)
- pybacktrack logic (backstrip/decompaction)
- pybasin logic (burial history)

---

## Sprint 1: MVP Visualization — Well Log Display

### Ideas (Brainstorm)

- **Data input:** CSV for stratigraphy (colors, ages, units), LAS or CSV for log curves
- **Visual layout:** Left side = vertical well column with strata; Right side = log curves (gamma, porosity, etc.)
- **Stratigraphy master data:** Static CSV with geological units (won't change per well)
- **Interactivity:** Hover over stratum → show age, lithology; Hover over log curve → show values
- **Future:** Selection of depth intervals → trigger burial calc
- **Input contract:**
  - Strat chart is a standalone static dictionary loaded from CSV (`units` + `ranks`), including ages, RGB colors, hierarchy.
  - Well creation requires `well_name`; defaults: `kb_elev=10`, `gl_elev=10`, `td_md=1000`, `td_tvd=1000`, `x=0`, `y=0`, `crs=unset`; `well_id` auto-generated.
  - Tops fields: `well_name`, `top_name`, `depth`, `strat_age_ma`; global load setting for depth reference (`MD` or `TVD`).
  - Tops have two types: `strat` and `unconformity`.
  - Unconformity requires: `MD`, `unc_name`, `start_age_ma`, `base_age_ma`.
  - Deviation formats supported: `MD+INCL+AZIM`, `MD+X+Y`, `MD+DX+DY`, and the same sets for `TVD` and `TVDSS`.

### Decisions (Approved)

- Runtime dictionary source: SQLite (`project.db`)
- Import/export dictionary formats: CSV and YAML
- Dictionary layering and priority: `user` > `project` > `base`
- Curve matching strategy: pattern-based alias matching with explicit priority
- Unit normalization: convert to canonical units after mnemonic/family mapping
- Unknown curves: do not fail load; keep as `unknown` and log warning

### Tasks (Phase 1: MVP Viz)

- [x] **1.1** — Setup Dash + FastAPI boilerplate
- [x] **1.2** — Create data models: Well, Stratum, LogCurve, StratColumn
- [x] **1.3** — Parse LAS files (lasio) + CSV logs
  - [x] 1.3.a Implement LAS loader (depth axis + curves)
  - [x] 1.3.b Implement CSV log loader (depth + multi-curve)
  - [x] 1.3.c Add mnemonic dictionary lookup (SQLite aliases)
  - [x] 1.3.d Add unit normalization (depth + curve units) to canonical units
  - [x] 1.3.e Keep unknown mnemonics as pass-through with warnings
  - [x] 1.3.f Implement separate unconformity loader (`unconformities.csv`)
  - [x] 1.3.g Add linking between strat tops and unconformity boundaries
- [x] **1.4** — Load stratigraphy master table (CSV with colors, ages, units)
- [x] **1.5** — Build Plotly subplot layout (strat column left, log curves center/right)
- [x] **1.6** — Add hover annotations for depth, age, lithology, curve values
- [x] **1.7** — Implement well selector dropdown (test with synthetic data)
- [x] **Test MVP** — Display sample well with carotage + strata

### Tasks (Phase 2: Data Processing)

- [x] **Doc.1** — Add module reference docs for `api`, `core`, `data`, `viz`, and tests
- [x] **Doc.2** — Consolidate project documentation into one canonical root README
- [ ] **2.1** — Input format spec (CSV for strat, LAS for logs, JSON for well metadata)
- [ ] **2.2** — Depth normalization and curve alignment
- [ ] **2.3** — Quality checks (missing depth intervals, curve alignment)

### Tasks (Phase 3: Burial History — Level A)

- [ ] **3.1** — Audit pybasin burial history module
- [ ] **3.2** — Implement burial history calculator (ages, depths, erosion)
- [ ] **3.3** — Add burial curve visualization to dashboard
- [ ] **3.4** — Export burial history table

### Tasks (Phase 4: Tectonic Subsidence — Level B)

- [ ] **4.1** — Audit pyBacktrack decompaction logic
- [ ] **4.2** — Implement decompaction module
- [ ] **4.3** — Implement backstripping calculator
- [ ] **4.4** — Visualize tectonic subsidence curve
- [ ] **4.5** — Export tectonic subsidence results

---

## Archive

_Completed tasks and decisions moved here._


