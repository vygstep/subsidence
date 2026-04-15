# TODO & Ideas вЂ” SUBSIDENCE Project

## Data Storage (Approved)

**Strategy:** File-based + SQLite

- РЎС‹СЂС‹Рµ РґР°РЅРЅС‹Рµ (LAS, CSV РєР°СЂРѕС‚Р°Р¶, РѕС‚Р±РёРІРєРё) в†’ `data/wells/<well_name>/` РЅР° РґРёСЃРєРµ
- РњРµС‚Р°РґР°РЅРЅС‹Рµ СЃРєРІР°Р¶РёРЅ, СЃС‚СЂР°С‚РёРіСЂР°С„РёСЏ, СЂРµР·СѓР»СЊС‚Р°С‚С‹ СЂР°СЃС‡РµС‚РѕРІ в†’ SQLite (`project.db`)
- SQLite РїРѕРґРєР»СЋС‡Р°РµС‚СЃСЏ РЅР° С„Р°Р·Рµ 1, С‡С‚РѕР±С‹ РЅРµ РїРµСЂРµРґРµР»С‹РІР°С‚СЊ РїРѕР·Р¶Рµ

**РЎС‚СЂСѓРєС‚СѓСЂР° РґР°РЅРЅС‹С…:**
```
data/
  stratigraphy_master.csv       # Р­С‚Р°Р»РѕРЅРЅР°СЏ СЃС‚СЂР°С‚РёРіСЂР°С„РёС‡РµСЃРєР°СЏ РєРѕР»РѕРЅРєР° (С†РІРµС‚Р°, РІРѕР·СЂР°СЃС‚Р°, СЋРЅРёС‚С‹)
  wells/
    <well_name>/
      metadata.json             # РёРјСЏ, РєРѕРѕСЂРґРёРЅР°С‚С‹, TD, CRS
      logs.las                  # РєР°СЂРѕС‚Р°Р¶ (С‡РёС‚Р°РµС‚СЃСЏ С‡РµСЂРµР· lasio)
      tops.csv                  # РѕС‚Р±РёРІРєРё: formation, depth_top, depth_bot
```

**SQLite (project.db) tables:**
- `wells` вЂ” РјРµС‚Р°РґР°РЅРЅС‹Рµ СЃРєРІР°Р¶РёРЅ
- `tops` вЂ” РѕС‚Р±РёРІРєРё (linked to well)
- `strat_units` вЂ” СЃС‚СЂР°С‚РёРіСЂР°С„РёС‡РµСЃРєРёРµ СЋРЅРёС‚С‹ (РёР· master CSV)
- `burial_results` вЂ” СЂРµР·СѓР»СЊС‚Р°С‚С‹ СЂР°СЃС‡РµС‚РѕРІ burial history
- `subsidence_results` вЂ” СЂРµР·СѓР»СЊС‚Р°С‚С‹ backstripping

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

## Sprint 1: MVP Visualization вЂ” Well Log Display

### Ideas (Brainstorm)

- **Data input:** CSV for stratigraphy (colors, ages, units), LAS or CSV for log curves
- **Visual layout:** Left side = vertical well column with strata; Right side = log curves (gamma, porosity, etc.)
- **Stratigraphy master data:** Static CSV with geological units (won't change per well)
- **Interactivity:** Hover over stratum в†’ show age, lithology; Hover over log curve в†’ show values
- **Future:** Selection of depth intervals в†’ trigger burial calc
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

- [x] **1.1** вЂ” Setup Dash + FastAPI boilerplate
- [x] **1.2** вЂ” Create data models: Well, Stratum, LogCurve, StratColumn
- [x] **1.3** вЂ” Parse LAS files (lasio) + CSV logs
  - [x] 1.3.a Implement LAS loader (depth axis + curves)
  - [x] 1.3.b Implement CSV log loader (depth + multi-curve)
  - [x] 1.3.c Add mnemonic dictionary lookup (SQLite aliases)
  - [x] 1.3.d Add unit normalization (depth + curve units) to canonical units
  - [x] 1.3.e Keep unknown mnemonics as pass-through with warnings
  - [x] 1.3.f Implement separate unconformity loader (`unconformities.csv`)
  - [x] 1.3.g Add linking between strat tops and unconformity boundaries
- [x] **1.4** вЂ” Load stratigraphy master table (CSV with colors, ages, units)
- [x] **1.5** вЂ” Build Plotly subplot layout (strat column left, log curves center/right)
- [x] **1.6** вЂ” Add hover annotations for depth, age, lithology, curve values
- [x] **1.7** вЂ” Implement well selector dropdown (test with synthetic data)
- [x] **Test MVP** вЂ” Display sample well with carotage + strata
- [x] **1.8** — Rework `Sync charts` into a true ON/OFF mode for `burial-multi`, `burial-selected`, and `well-figure`
- [ ] **1.9** — Build `Object Manager` as a real object list for the selected well
- [ ] **1.10** — Split `well-figure` into independent strat/lith/log/depth track graphs

### Tasks (Phase 2: Data Processing)

- [x] **Doc.1** вЂ” Add module reference docs for `api`, `core`, `data`, `viz`, and tests
- [x] **Doc.2** вЂ” Consolidate project documentation into one canonical root README
- [ ] **2.1** вЂ” Input format spec (CSV for strat, LAS for logs, JSON for well metadata)
- [ ] **2.2** вЂ” Depth normalization and curve alignment
- [ ] **2.3** вЂ” Quality checks (missing depth intervals, curve alignment)

### Tasks (Phase 3: Burial History вЂ” Level A)

- [ ] **3.1** вЂ” Audit pybasin burial history module
- [ ] **3.2** вЂ” Implement burial history calculator (ages, depths, erosion)
- [ ] **3.3** вЂ” Add burial curve visualization to dashboard
- [ ] **3.4** вЂ” Export burial history table

### Tasks (Phase 4: Tectonic Subsidence вЂ” Level B)

- [ ] **4.1** вЂ” Audit pyBacktrack decompaction logic
- [ ] **4.2** вЂ” Implement decompaction module
- [ ] **4.3** вЂ” Implement backstripping calculator
- [ ] **4.4** вЂ” Visualize tectonic subsidence curve
- [ ] **4.5** вЂ” Export tectonic subsidence results

---

## Archive

_Completed tasks and decisions moved here._

