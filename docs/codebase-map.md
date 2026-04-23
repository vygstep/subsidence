# Codebase Map

**Status:** Current navigation map  
**Created:** 2026-04-23  
**Purpose:** Help contributors locate code by workflow before reading the whole repository.

For the full documentation entry point, see [Documentation](documentation-index.md).

Detailed module pages:

- [Architecture](architecture.md)
- [Backend API](modules/backend-api.md)
- [Backend Data Layer](modules/backend-data-layer.md)
- [Frontend State](modules/frontend-state.md)
- [Frontend Layout](modules/frontend-layout.md)
- [Frontend Viewer](modules/frontend-viewer.md)
- [Subsidence Panel](modules/subsidence-panel.md)
- [Project Format](modules/project-format.md)
- [Testing](modules/testing.md)
- [Logging](modules/logging.md)

---

## 1. Runtime Shape

The application has two main runtimes:

- Backend: FastAPI application in `app/src/subsidence`.
- Frontend: Vite + React + Zustand application in `frontend/src`.

The project bundle is stored on disk as a `.subsidence` project folder containing SQLite metadata, Parquet curve payloads, checkpoints, and generated result files.

---

## 2. Backend Map

### API entrypoint

File:

- `app/src/subsidence/api/main.py`

Responsibilities:

- Create the FastAPI app.
- Configure CORS.
- Attach `ProjectManager` to `app.state`.
- Register routers.

Typical changes:

- Add middleware.
- Register new route modules.
- Add app-wide logging/diagnostics.

Registered route families:

- `/api/wells...`
- `/api/wells/{well_id}/formations...`
- `/api/strat-units`
- `/api/strat-charts...`
- `/api/compaction-models...`
- `/api/subsidence...`
- `/api/ws/recalculate`
- `/api/projects...`

### Project API

Files:

- `app/src/subsidence/api/projects.py` — lifecycle, path helpers, shared models
- `app/src/subsidence/api/projects_imports.py` — import endpoints (LAS, logs CSV, tops, unconformities, deviation)
- `app/src/subsidence/api/projects_config.py` — undo/redo, checkpoints, dictionaries, visual config
- `app/src/subsidence/api/projects_export.py` — LAS/CSV export

All four routers share the `/api/projects` prefix and are registered in `main.py`. Public API paths are unchanged.

`projects.py` also owns all Pydantic models and helpers used across the split files.

Risk:

- Native path picking endpoints in `projects.py` use platform-blocking dialogs. Do not make them async.
- Shared models are imported by the other three files; renaming models in `projects.py` requires updating those imports.

### Well API

File:

- `app/src/subsidence/api/wells.py`

Responsibilities:

- List wells and well inventory.
- Load a well with curves/formations/deviation summary.
- Load curve LOD data.
- Patch well metadata.
- Load deviation survey.

Main endpoint groups:

- `GET /api/wells`
- `GET /api/wells/inventory`
- `GET /api/wells/{well_id}`
- `GET /api/wells/{well_id}/curves`
- `PATCH /api/wells/{well_id}`
- `GET /api/wells/{well_id}/deviation`

Risk:

- Inventory payload, curve payload loading, formation link mapping, and well metadata live together.

Refactor direction:

- Extract response builders for inventory, well detail, curves, and deviation.

### Formation and strat chart APIs

Files:

- `app/src/subsidence/api/formations.py`
- `app/src/subsidence/api/strat_chart.py`

Responsibilities:

- Formation CRUD and link/type/age behavior.
- Strat chart load/list/delete/current behavior.
- Strat unit dictionary access.

Main endpoint groups:

- `GET /api/strat-units`
- `GET/POST/PATCH/DELETE /api/wells/{well_id}/formations...`
- `PUT /api/wells/{well_id}/formations/{formation_id}/strat-link`
- `GET /api/strat-charts`
- `PATCH /api/strat-charts/{chart_id}/activate`
- `DELETE /api/strat-charts/{chart_id}`
- `POST /api/strat-charts/import`

Typical bugs:

- Wrong active chart.
- Built-in chart mutability.
- Tops linked to one chart but displayed against another.

### Subsidence and compaction APIs

Files:

- `app/src/subsidence/api/subsidence.py`
- `app/src/subsidence/api/compaction.py`

Responsibilities:

- WebSocket recalculation.
- Compaction/lithology model behavior.
- Backstrip calculation orchestration.

Main endpoint groups:

- `GET /api/subsidence/stored-results`
- `POST /api/wells/{well_id}/subsidence`
- `WebSocket /api/ws/recalculate`
- `GET/POST/PATCH/DELETE /api/compaction-models...`
- `GET/PATCH /api/compaction-models/{model_id}/params...`

Typical bugs:

- Recalculation not triggered.
- Stale formations after edit.
- Missing or wrong water depth input.

---

## 3. Backend Data Layer

### Project manager

File:

- `app/src/subsidence/data/project_manager.py`

Responsibilities:

- Open project state.
- Project directory and manifest handling.
- SQLite engine/session lifecycle.
- Recent projects.
- Save/checkpoint plumbing.

Risk:

- This is the stateful center of the backend. Bugs here affect almost every workflow.

Do not refactor before tests:

- create/open/save/close project
- recent projects
- checkpoint create/restore/delete
- project lock/session lifecycle

### Engine and migrations

File:

- `app/src/subsidence/data/engine.py`

Responsibilities:

- SQLite engine creation.
- SQLite pragmas.
- Table creation.
- Lightweight schema migrations.
- Project DB validation.

Typical bugs:

- Old projects fail to open after schema changes.
- SQLite foreign keys or journal mode behave differently on another machine.
- Migration silently misses a new persisted field.

### Database schema

Files:

- `app/src/subsidence/data/schema.py`
- `app/src/subsidence/data/models.py`

Responsibilities:

- SQLAlchemy tables.
- Pydantic/domain response models.

Typical changes:

- New persisted fields.
- Project format changes.

Rule:

- Schema changes need migration or compatibility notes.

### Importers

Files:

- `app/src/subsidence/data/importers/__init__.py` — re-exports all public symbols
- `app/src/subsidence/data/importers/common.py` — shared helpers, well resolution, payload writing
- `app/src/subsidence/data/importers/las.py` — LAS import
- `app/src/subsidence/data/importers/logs_csv.py` — logs CSV import
- `app/src/subsidence/data/importers/tops.py` — tops and unconformities import
- `app/src/subsidence/data/importers/deviation.py` — deviation import
- `app/src/subsidence/data/loaders.py` — read curve and deviation payloads from Parquet

Public function signatures are unchanged. All callers import from `data.importers` (the package).

Risk:

- This is the most important backend correctness hotspot. Behavior bugs here affect all import workflows.

### Undo and checkpoints

File:

- `app/src/subsidence/data/undo.py`

Responsibilities:

- Undo/redo command records.
- Reversible operations.

Typical bugs:

- Operation modifies data but does not record undo.
- Undo restores metadata but not linked payload files.

### Dictionaries and linking

Files:

- `app/src/subsidence/data/dict_seeder.py`
- `app/src/subsidence/data/dict_resolver.py`
- `app/src/subsidence/data/strat_link.py`
- `app/src/subsidence/data/unit_conversion.py`
- `app/src/subsidence/data/dictionaries/curve_families.csv`
- `app/src/subsidence/data/dictionaries/lithology_defaults.csv`

Responsibilities:

- Built-in curve/lithology/stratigraphy defaults.
- Resolve curve mnemonics.
- Link tops to strat chart units.
- Normalize units.

Dictionary CSV ownership:

- `curve_families.csv`: backend default mnemonic/family/range behavior.
- `lithology_defaults.csv`: compaction/lithology default parameters.
- `frontend/src/utils/curvePresets.ts`: frontend visual defaults for curve display.

Keep backend dictionary behavior and frontend visual presets intentionally aligned.

### LOD and calculations

Files:

- `app/src/subsidence/data/lttb.py`
- `app/src/subsidence/data/backstrip.py`

Responsibilities:

- `lttb.py`: downsample dense curve arrays for visible windows.
- `backstrip.py`: 1D backstrip/decompaction calculation.

Rule:

- Calculation changes need backend unit tests.
- LOD changes need frontend rendering/performance checks and API tests around `/api/wells/{well_id}/curves`.

---

## 4. Frontend Map

### App shell

File:

- `frontend/src/App.tsx`

Responsibilities:

- Compose toolbar, data manager, viewer, settings, status bar.
- Coordinate high-level effects after project/well changes.
- Wire keyboard shortcuts and top-level dialogs.
- Coordinate active well hydration and stored subsidence result loading.

Risk:

- High-level side effects should stay small. Detailed logic belongs in stores or hooks.

### Stores

Files:

- `frontend/src/stores/projectStore.ts`
- `frontend/src/stores/wellDataStore.ts`
- `frontend/src/stores/workspaceStore.ts`
- `frontend/src/stores/viewStore.ts`
- `frontend/src/stores/multiWellStore.ts`
- `frontend/src/stores/computedStore.ts`

Responsibilities:

- `projectStore.ts`: project lifecycle, recent projects, visual config hydration/persistence.
- `wellDataStore.ts`: active well data, curves, formations, inventories, well metadata patches.
- `workspaceStore.ts`: per-well viewer templates, tracks, visible curves, layout state.
- `viewStore.ts`: viewer selection, zoom, scroll, scale, active panel state.
- `multiWellStore.ts`: multi-well/subsidence panel state.
- `computedStore.ts`: calculated subsidence data, websocket state, display toggles.

Important store helpers:

- `workspaceStore.buildTrackOrder`: canonical track ordering with depth/formations/static tracks.
- `workspaceStore.coerceWellViewState`: visual config hydration guard.
- `projectStore.collectProjectVisualConfig`: project-level visual config serialization.
- `projectStore.collectWellVisualConfigs`: per-well visual config serialization.
- `wellDataStore.updateFormationDepth`: optimistic/debounced top depth patching.
- `computedStore.triggerRecalculation`: WebSocket recalculation entry point.

Risk:

- Stores are convenient but can become hidden coupling points. Any new state should have a clear owner.

### Data Manager

Files:

- `frontend/src/components/layout/DataManagerPane.tsx`
- `frontend/src/components/layout/DataManagerTopPane.tsx`
- `frontend/src/components/layout/WellDataPanel.tsx`
- `frontend/src/components/layout/StratChartTab.tsx`
- `frontend/src/components/layout/CompactionModelsTab.tsx`
- `frontend/src/components/layout/useDataManagerController.ts` — thin coordinator hook
- `frontend/src/components/layout/dataManagerSelection.ts` — object selection handlers
- `frontend/src/components/layout/dataManagerVisibility.ts` — toggle/visibility handlers
- `frontend/src/components/layout/dataManagerActions.ts` — context menu action handlers
- `frontend/src/components/layout/pathMemory.ts`

Responsibilities:

- Tree display for strat charts, wells, and models.
- Selection, expansion, checkboxes/radio controls.
- Context menus.
- Object actions: duplicate, delete, rename, link, add/remove visualization items.
- Last project/import root memory.

`useDataManagerController.ts` calls `makeSelectionHandlers`, `makeVisibilityHandlers`, and `makeActionHandlers` each render and returns a unified public shape.

Risk:

- `WellDataPanel.tsx` renders both tree structure and visibility controls. UI bugs can be state bugs or rendering bugs.

### Settings pane

Files:

- `frontend/src/components/layout/SettingsInspector.tsx` — dispatcher by selected object type
- `frontend/src/components/layout/SettingsPaneShell.tsx`
- `frontend/src/components/layout/settings/WellSettings.tsx`
- `frontend/src/components/layout/settings/DepthTrackSettings.tsx`
- `frontend/src/components/layout/settings/FormationsTrackSettings.tsx`
- `frontend/src/components/layout/settings/LasSettings.tsx`
- `frontend/src/components/layout/settings/CurveSettings.tsx`
- `frontend/src/components/layout/settings/TopsSettings.tsx`
- `frontend/src/components/layout/settings/TopPickSettings.tsx`
- `frontend/src/components/layout/settings/StratChartSettings.tsx`
- `frontend/src/components/layout/settings/ModelSettings.tsx`

Responsibilities:

- Show editor for the selected object.
- `SettingsInspector.tsx` dispatches to the matching settings component based on `selectedObject.type`.

### Toolbar and dialogs

Files:

- `frontend/src/components/layout/ProjectToolbar.tsx`
- `frontend/src/components/layout/NewProjectDialog.tsx`
- `frontend/src/components/layout/CreateWellDialog.tsx`
- `frontend/src/components/layout/ImportLasDialog.tsx`
- `frontend/src/components/layout/ImportTopsDialog.tsx`
- `frontend/src/components/layout/ImportDeviationDialog.tsx`
- `frontend/src/components/layout/LoadStratChartDialog.tsx`
- `frontend/src/components/layout/FileOpenDialog.tsx`

Responsibilities:

- User actions and path selection.
- Import target selection.
- Project menu and action groups.
- Windows/native path picking through backend picker endpoints.

Typical bugs:

- Wrong active well preselected.
- File/folder picker does not remember root.
- Dialog writes to path field but action uses stale value.
- Active well target not used when source data has no well name.

### Well viewer

Files:

- `frontend/src/components/logview/LogViewPanel.tsx`
- `frontend/src/components/logview/DataTrack.tsx`
- `frontend/src/components/logview/DepthTrack.tsx`
- `frontend/src/components/logview/FormationColumn.tsx`
- `frontend/src/components/logview/TrackHeaderRow.tsx`
- `frontend/src/components/logview/TrackHeader.tsx`
- `frontend/src/components/logview/WellOverviewMinimap.tsx`
- `frontend/src/components/interaction/InteractionOverlay.tsx`
- `frontend/src/components/interaction/FormationTopLine.tsx`
- `frontend/src/components/interaction/DepthCursor.tsx`
- `frontend/src/components/interaction/CurveTooltip.tsx`
- `frontend/src/renderers/*.ts`
- `frontend/src/hooks/*.ts`
- `frontend/src/utils/curvePresets.ts`

Responsibilities:

- Render depth track, log tracks, curves, fills, formation column, tops, and interaction overlays.
- Keep canvas rendering separated from SVG/HTML interaction.
- Apply curve mnemonic visual defaults.

Rule:

- Renderer changes should be tested with pure unit tests where possible.
- `DataTrack.tsx` currently owns clipping/interpolation helpers. If reused elsewhere, extract with tests first.

Important viewer files:

- `curvePresets.ts`: frontend mnemonic defaults for curve color, limits, scale, precision, line style, and fill.
- `fillRenderer.ts`: baseline and curve-to-curve fill logic.
- `TrackResizeHandle.tsx`: track width changes.
- `TrackHeaderRow.tsx`: drag/reorder and header selection surface.
- `useSynchronizedScroll.ts`: depth scroll/zoom behavior.
- `useKeyboardShortcuts.ts`: keyboard actions for zoom, scroll, undo/redo, delete/link top.

### Subsidence panel

Files:

- `frontend/src/api/subsidenceSocket.ts`
- `frontend/src/components/subsidence/MultiWellPanel.tsx`
- `frontend/src/components/subsidence/SubsidencePanel.tsx`
- `frontend/src/components/subsidence/SubsidenceCanvas.tsx`
- `frontend/src/components/subsidence/SubsidenceControls.tsx`
- `frontend/src/components/subsidence/SubsidenceToolbar.tsx`
- `frontend/src/components/subsidence/GeologicalTimescale.tsx`
- `frontend/src/utils/exportPng.ts`

Responsibilities:

- Show burial/subsidence curves.
- Trigger and display recalculation results.
- Export panel PNG.
- Render stored multi-well results.
- Keep WebSocket connection and retry queue.

Known historical risk:

- This panel has had visibility/rendering issues. Keep a dedicated bug document for panel rendering failures.
- There are two display modes in code: active-well `SubsidencePanel/SubsidenceCanvas` and stored-results `MultiWellPanel`.

### Styling

Files:

- `frontend/src/index.css` — `@import` index only
- `frontend/src/styles/base.css` — reset rules, `:root`, `html/body`
- `frontend/src/styles/app-layout.css` — app shell, topbar, status bar, sidebar, workspace layout
- `frontend/src/styles/data-manager.css` — sidebar panels, trees, top leaves, template panels, compaction table
- `frontend/src/styles/log-view.css` — depth track, data track, formation column, track headers, log view panel
- `frontend/src/styles/dialogs.css` — project dialog
- `frontend/src/styles/subsidence-panel.css` — split view, subsidence panel, toolbar, canvas, timescale

---

## 5. Data Flow Cheat Sheet

### Open project

1. Frontend calls `projectStore.openProject`.
2. Backend `projects.py` opens the project through `ProjectManager`.
3. Frontend loads project status, visual config, well inventories, and active/first well.
4. `wellDataStore` loads well detail and formations.
5. `workspaceStore` hydrates per-well viewer state.

### Import logs

1. User opens import dialog from toolbar.
2. Frontend posts to `/api/projects/import-las` or `/api/projects/import-logs-csv`.
3. Backend route delegates to `data/importers.py`.
4. Importer resolves target well or creates one.
5. Curve metadata goes to SQLite, curve arrays go to Parquet payload files.
6. Frontend refreshes inventories and the affected well.

### Import tops

1. User imports tops CSV.
2. Backend resolves target well.
3. Tops are inserted as formations.
4. Links/colors/ages are resolved against the active or chosen strat chart when possible.
5. Frontend reloads formations/inventory.

### Save and reopen

1. Frontend sends visual config and project save.
2. Backend persists metadata and manifest state.
3. Reopen should restore project status, wells, curves, formations, strat charts, and visual config.

Implementation files:

- `projectStore.collectProjectVisualConfig`
- `projectStore.collectWellVisualConfigs`
- `projects.py` visual-config routes
- `project_manager.py` save/checkpoint methods
- `workspaceStore.coerceWellViewState`

### Subsidence recalculation

1. Formation edits or controls trigger frontend recalculation.
2. `computedStore` calls `api/subsidenceSocket.ts`.
3. `subsidenceSocket.ts` sends the WebSocket payload to `/api/ws/recalculate`.
4. Backend computes in `subsidence.py` using `data/backstrip.py`.
5. Frontend receives results and renders `SubsidenceCanvas`.

### Curve display

1. Data Manager toggles/selects well, LAS group, curves, tops, or tracks.
2. `useDataManagerController.ts` updates `workspaceStore` and/or selected object state.
3. `workspaceStore` determines track order and visible curve configs.
4. `wellDataStore` provides active well curve arrays and formations.
5. `LogViewPanel` renders `TrackHeaderRow`, `DepthTrack`, `DataTrack`, `FormationColumn`, and `InteractionOverlay`.

### Path picking

1. Dialog uses `pathMemory.ts` to suggest last root.
2. Frontend calls `/api/projects/pick-folder` or `/api/projects/pick-file`.
3. `projects.py` invokes native picker and returns selected path.
4. Dialog updates local input and remembers the root.

---

## 6. Where To Look By Bug Type

| Bug report | Start here |
|---|---|
| Project cannot open/save/reopen | `projectStore.ts`, `api/projects.py`, `data/project_manager.py` |
| Recent projects wrong | `projectStore.ts`, `data/project_manager.py`, `api/projects.py` |
| Native file/folder picker wrong | `FileOpenDialog.tsx`, import dialogs, `pathMemory.ts`, `api/projects.py` |
| LAS/log CSV imports into wrong well | import dialog, `projectStore.ts`, `importers/common.py`, `api/projects_imports.py` |
| Logs CSV delimiter problem | `importers/logs_csv.py`, `ImportLasDialog.tsx`, `api/projects_imports.py` |
| Tops colors/links wrong | `importers/tops.py`, `data/strat_link.py`, `api/formations.py`, `StratChartTab.tsx` |
| Data Manager tree wrong | `WellDataPanel.tsx`, `DataManagerPane.tsx`, `useDataManagerController.ts` |
| Data Manager context menu slow/wrong | `useDataManagerController.ts`, `DataManagerPane.tsx`, `WellDataPanel.tsx` |
| Settings pane wrong object | `viewStore.ts`, `SettingsInspector.tsx`, `dataManagerSelection.ts` |
| Well settings not saved | `settings/WellSettings.tsx`, `wellDataStore.ts`, `api/wells.py` |
| Track display wrong | `workspaceStore.ts`, `LogViewPanel.tsx`, `TrackHeaderRow.tsx`, `DataTrack.tsx` |
| Track order wrong after reopen | `workspaceStore.ts`, `projectStore.ts`, `TrackHeaderRow.tsx`, `api/projects.py` visual config |
| Curve rendering wrong | `DataTrack.tsx`, `renderers/*`, `hooks/useCanvasRenderer.ts` |
| Curve defaults wrong | `utils/curvePresets.ts`, `data/dictionaries/curve_families.csv`, `api/projects.py` dictionary endpoints |
| Formation drag wrong | `FormationTopLine.tsx`, `wellDataStore.ts`, `api/formations.py` |
| Strat chart cannot delete/load | `api/strat_chart.py`, `StratChartTab.tsx`, `projectStore.ts` |
| Built-in ICS chart wrong | `data/dict_seeder.py`, `api/strat_chart.py`, `sample_data/ics_chart2023.csv` |
| Undo/redo wrong | `projectStore.ts`, `api/projects.py`, `data/undo.py` |
| Subsidence panel blank/wrong | `computedStore.ts`, `api/subsidenceSocket.ts`, `MultiWellPanel.tsx`, `SubsidenceCanvas.tsx`, `api/subsidence.py` |
| Export wrong | `utils/exportPng.ts`, `api/projects.py`, `SubsidenceControls.tsx` |
| Layout scroll/resizer bug | `styles/app-layout.css`, `styles/subsidence-panel.css`, `SplitView.tsx`, `DataManagerPane.tsx`, `MultiWellPanel.tsx` |

---

## 7. High-Risk Refactor Targets

These files are allowed to change, but not casually. Add tests/logging first when the change is behavioral.

| File | Why risky | Safety net needed |
|---|---|---|
| `app/src/subsidence/data/importers/` | all import paths and well auto-resolution | API import/save/reopen tests |
| `app/src/subsidence/api/projects*.py` | project lifecycle, native dialogs; shared models imported by split files | project lifecycle + import API tests |
| `frontend/src/components/layout/useDataManagerController.ts` | many object actions and selection behavior | Data Manager component/store tests |
| `frontend/src/stores/projectStore.ts` | project lifecycle and visual config serialization | save/reopen/hydration tests |
| `frontend/src/stores/wellDataStore.ts` | active well data, optimistic top updates | well switching + formation CRUD tests |
| `frontend/src/components/subsidence/*` | two rendering paths and WebSocket-fed data | recalculation + stored-results tests |

---

## 8. Current Test Commands

Frontend:

```bash
cd frontend
npm run test -- --run
```

Backend:

```bash
cd app
pytest tests
```

Current baseline from 2026-04-23 (after M6 refactor):

- Frontend: 34 passed.
- Backend: 30 passed.
