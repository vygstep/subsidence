# API Contract Map

All HTTP endpoints and WebSocket. Frontend caller noted where known.

---

## Wells

| Method | Path | Frontend caller | Key inputs | Key outputs |
|---|---|---|---|---|
| GET | `/api/wells` | — | — | WellListItem[] |
| GET | `/api/wells/inventory` | `wellDataStore.loadWellInventories` | — | WellInventoryResponse[] + zones + sea level curves |
| GET | `/api/wells/{id}` | `wellDataStore.loadWell` | — | WellResponse (well + curves + formations) |
| GET | `/api/wells/{id}/curves` | `wellDataStore.fetchCurvesLOD` | depth_min, depth_max, resolution | CurveResponse[] |
| GET | `/api/wells/{id}/curves/full` | `wellDataStore.reloadCurvesForDepthBasis` | depth_basis (MD/TVD/TVDSS) | CurveResponse[] |
| PATCH | `/api/wells/{id}` | via UpdateWell command | WellPatchRequest | WellResponse |
| PATCH | `/api/wells/{id}/curves/{mnemonic}` | `wellDataStore` | CurvePatchRequest | CurveInventoryItem |
| DELETE | `/api/wells/{id}/curves/{mnemonic}` | `wellDataStore` | — | 204 |
| DELETE | `/api/wells/{id}/curves` | `wellDataStore` | — | 204 |
| GET | `/api/wells/{id}/deviation` | `wellDataStore.loadWell` | — | DeviationSurveyResponse |
| DELETE | `/api/wells/{id}/deviation` | — | — | 204 |
| POST | `/api/wells/{id}/recalculate-tvd` | — | — | RecalculateTvdResponse |

## Wells — Formations

| Method | Path | Frontend caller | Key inputs | Key outputs |
|---|---|---|---|---|
| GET | `/api/wells/{id}/formations` | `wellDataStore.loadWell` | — | FormationTopResponse[] |
| POST | `/api/wells/{id}/formations` | `wellDataStore.addFormation` | FormationTopCreate | FormationTopResponse |
| PATCH | `/api/wells/{id}/formations/{fid}` | `wellDataStore.updateFormation` / `updateFormationDepth` | FormationTopPatch | FormationTopResponse |
| DELETE | `/api/wells/{id}/formations/{fid}` | `wellDataStore.removeFormation` | — | 204 |
| PUT | `/api/wells/{id}/formations/{fid}/strat-link` | `wellDataStore.linkFormationToChart` | StratLinkRequest | FormationTopResponse |

**Note**: PATCH formations is the most complex endpoint. It handles:
depth resolution, color reset, age validation (silent None on invalid),
age=0 auto-set of water_depth_m, undo command selection, optional zone recalc.
(`api/formations.py:update_formation` — ~150 lines)

## Wells — Zones

| Method | Path | Frontend caller | Key inputs | Key outputs |
|---|---|---|---|---|
| GET | `/api/wells/{id}/zones` | via inventory | — | ZoneInventoryItem[] |
| PATCH | `/api/wells/{id}/zones/{zone_id}` | `wellDataStore.updateZoneLithology` | ZonePatch | ZoneInventoryItem |
| POST | `/api/wells/{id}/zones/recalculate-lithology` | — | — | {zones_updated} |

## Wells — Active state

| Method | Path | Frontend caller | Key inputs | Key outputs |
|---|---|---|---|---|
| PUT | `/api/wells/{id}/active-top-set` | `wellDataStore.setWellActiveTopSet` | {top_set_id} | ActiveTopSetResponse |
| PUT | `/api/wells/{id}/active-sea-level-curve` | `wellDataStore.setWellActiveSeaLevelCurve` | {curve_id} | 200 |

---

## Strat Charts

| Method | Path | Frontend caller | Key inputs | Key outputs |
|---|---|---|---|---|
| GET | `/api/strat-charts` | `wellDataStore.loadStratCharts` | — | StratChartInfo[] |
| PATCH | `/api/strat-charts/{id}/activate` | `wellDataStore.activateChart` | — | StratChartInfo |
| DELETE | `/api/strat-charts/{id}` | `wellDataStore.deleteChart` | — | 204 |
| POST | `/api/strat-charts/import` | LoadStratChartDialog | {csv_path} | ImportStratChartResponse |
| GET | `/api/strat-units` | TopPickSettings autocomplete | q, limit, chart_id | StratUnitLookupResponse[] |

**Note on CSV convention**: In the strat chart CSV, `start_age_ma` = OLDER (larger Ma),
`end_age_ma` = YOUNGER (smaller Ma). This was swapped in commit da35f29 — do not revert.

---

## Top Sets

| Method | Path | Notes |
|---|---|---|
| GET | `/api/top-sets` | List all |
| POST | `/api/top-sets` | Create |
| GET | `/api/top-sets/{id}` | Get with horizons |
| PATCH | `/api/top-sets/{id}` | Rename |
| DELETE | `/api/top-sets/{id}` | Deletes zones + ZoneWellData via cascade |
| POST | `/api/top-sets/{id}/horizons` | Triggers full pipeline for all linked wells |
| PATCH | `/api/top-sets/{id}/horizons/{hid}` | |
| DELETE | `/api/top-sets/{id}/horizons/{hid}` | Merges zones first |
| POST | `/api/top-sets/{id}/picks` | Create a pick directly into a TopSet |

---

## Subsidence

| Method | Path | Frontend caller | Notes |
|---|---|---|---|
| WS | `/api/ws/recalculate` | `computedStore.triggerRecalculation` | Accepts {well_id, water_depth_m}; **water_depth_m is ignored** |
| POST | `/api/wells/{id}/subsidence` | SubsidenceControls | REST alternative, blocking |
| GET | `/api/subsidence/stored-results` | `multiWellStore` | Returns stored calculation results for all wells |

---

## Projects

| Method | Path | Frontend caller |
|---|---|---|
| POST | `/api/projects` | projectStore.createProject |
| POST | `/api/projects/open` | projectStore.openProject |
| POST | `/api/projects/close` | projectStore.closeProject |
| POST | `/api/projects/save` | projectStore.saveProject |
| GET | `/api/projects/status` | projectStore.pollStatus |
| GET | `/api/projects/recent` | projectStore.loadRecentProjects |
| POST | `/api/projects/checkpoints` | projectStore.createCheckpoint |
| POST | `/api/projects/undo` | projectStore.undo |
| POST | `/api/projects/redo` | projectStore.redo |
| GET/POST/PATCH | `/api/projects/visual-config` | projectStore |
| POST | `/api/projects/import-tops` | ImportDialog |
| POST | `/api/projects/import-las` | ImportDialog |
| POST | `/api/projects/import-logs-csv` | ImportDialog |
| POST | `/api/projects/import-deviation` | ImportDialog |
| POST | `/api/projects/pick-folder` | FileDialogs — **MUST be sync, not async** |
| POST | `/api/projects/pick-file` | FileDialogs — **MUST be sync, not async** |
| POST | `/api/projects/import-preview/tabular` | ImportWizard |
| POST | `/api/projects/import-preview/las` | ImportWizard |

**IMPORTANT**: `pick-folder` and `pick-file` use native OS dialogs.
They MUST remain synchronous routes — async would block the event loop. (`CLAUDE.md` antipatterns)

---

## Dictionaries (read/write by wellDataStore)

- `/api/compaction-models*` — CRUD
- `/api/compaction-presets*` — CRUD
- `/api/mnemonic-sets*` — CRUD
- `/api/unit-dimensions*` — CRUD
- `/api/lithology-dict*` — CRUD
- `/api/lithology-sets*` — CRUD
- `/api/lithology-patterns*` — CRUD
- `/api/sea-level-curves*` — CRUD

---

## Known gaps / stale docs

- `projects_export.py` is referenced in `docs/backend-api.md` and `docs/codebase-map.md`
  but **the file does not exist** in the codebase. LAS/CSV export endpoints are missing.
- `GET /api/wells/{id}/curves/full` is not documented anywhere in `docs/modules/`.
