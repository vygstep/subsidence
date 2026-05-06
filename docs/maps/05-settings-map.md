# Settings & Config Map

Where every configurable value is defined, stored, and read.

---

## Backend — runtime config

| Setting | Source | Default | Where read |
|---|---|---|---|
| CORS origins | `SUBSIDENCE_CORS_ORIGINS` env var | `*` | `api/main.py:80-84` |
| Log level | `SUBSIDENCE_LOG_LEVEL` env var | `INFO` | `observability.py:37` |
| Autosave interval | Hardcoded | 300s | `project_manager.py:62` |
| Schema version | `SCHEMA_VERSION = 14` in `schema.py` | — | `engine.py:28-29` |
| App version | `APP_VERSION = '0.1.0'` in `project_manager.py` | — | `manifest.json`, `ProjectMeta` |

---

## Backend — seeded defaults (written to DB on project open)

| Data | Source file | Table | Module |
|---|---|---|---|
| Lithology entries | `data/dictionaries/lithology_defaults.csv` | `lithology_dict_entries` | dict_seeder.py |
| Compaction presets | same CSV | `compaction_presets` | dict_seeder.py |
| Curve family dictionary | `data/dictionaries/curve_families.csv` | `curve_dict_entries` | dict_seeder.py |
| ICS 2023 strat chart | `sample_data/ics_chart2023.csv` | `strat_charts`, `strat_units` | dict_seeder.py |
| Unit dimensions | hardcoded in dict_seeder.py | `unit_dimensions`, `measurement_units` | dict_seeder.py |
| Well colors | `data/well_colors.py` (palette list) | `WellModel.color_hex` (per well) | well_colors.py |

All seeding is idempotent — safe to call multiple times.

---

## Backend — per-project settings (visual_config table)

Stored as JSON blobs in `visual_config` with `scope` + `scope_id`.

| Scope | scope_id | Contents |
|---|---|---|
| `'project'` | project name | Track widths, depth ranges, subsidence width, overlay styles, active model type |
| `'well'` | well_id | Per-well track layout (workspaceStore.wellViewStates) |

Written by: `projects_config.py` (PATCH `/api/projects/visual-config`)
Read by: projectStore.loadVisualConfig → viewStore + workspaceStore

---

## Backend — user-level settings

| Setting | Location | Module |
|---|---|---|
| Recent projects list | `{user_cache_dir}/subsidence/recent_projects.json` | project_manager.py |

---

## Frontend — viewStore

All persisted to `visual_config (scope='project')` on save.

| Key | Type | What it controls |
|---|---|---|
| `depthPerPixel` | number | Log view zoom |
| `trackWidths` | Record<trackId, number> | Width of each log track |
| `subsidenceWidth` | number | Width of subsidence panel |
| `depthTrackConfig` | object | Depth track appearance |
| `formationsTrackConfig` | object | Formations track appearance |
| `subsidenceSingleDepthMin/Max` | number | Y-axis depth range for subsidence |
| `subsidenceTimeMin/Max` | number | X-axis age range for subsidence |
| `seaLevelOverlayStyles` | object | Sea level overlay colors/opacity |
| `activeSubsidenceModelType` | string | Selected subsidence model tab |
| `subsidenceModelConfigs` | object | Per-model display configs |

---

## Frontend — workspaceStore

Per-well track state. Persisted to `visual_config (scope='well')`.

| Key | What it controls |
|---|---|
| `wellViewStates[wellId].tracks` | Track list (type, mnemonic, color, scale) |
| `wellViewStates[wellId].trackWidths` | Per-track width overrides |
| `wellViewStates[wellId].colorOverrides` | Curve color overrides |

---

## Frontend — localStorage (browser, not saved to project)

| Key | What |
|---|---|
| `lastProjectPath` | Last opened project path |
| `lastImportPath` | Last import file/folder path |

Managed by `utils/pathMemory.ts`.

---

## Frontend — computedStore

Not persisted. Ephemeral calculation state.

| Key | Notes |
|---|---|
| `waterDepthM` | Sent to WebSocket but **IGNORED by backend** |
| `subsidenceCurves` | Result of last calculation |
| `isComputing` | Loading state |

---

## Where to look by symptom

| Symptom | Check |
|---|---|
| Track layout reset on reopen | `visual_config` table, `projectStore.saveProject` call order |
| Zoom lost on reopen | `viewStore.depthPerPixel`, `visual_config scope='project'` |
| Wrong curve colors after reopen | `workspaceStore.wellViewStates[id].colorOverrides`, `visual_config scope='well'` |
| Water depth slider has no effect | `computedStore.waterDepthM`, `api/subsidence.py:ws_recalculate` — known bug |
| Lithology defaults wrong | `data/dictionaries/lithology_defaults.csv`, `dict_seeder.py` |
| ICS chart wrong ages | `sample_data/ics_chart2023.csv` (start=older, end=younger — commit da35f29) |
