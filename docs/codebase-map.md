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

### Project API

File:

- `app/src/subsidence/api/projects.py`

Responsibilities:

- Project create/open/save/close/status/recent.
- Native path picking/reveal helpers.
- Import endpoints for LAS, logs CSV, tops, unconformities, and deviation.
- Undo/redo and checkpoints.
- Dictionary endpoints.
- Visual config endpoints.
- LAS/CSV export endpoints.

Risk:

- This file is large and mixes API validation, platform dialogs, project lifecycle, import orchestration, dictionaries, visual config, and export.

Refactor direction:

- Keep API paths stable.
- Extract service helpers for project lifecycle, import orchestration, visual config, dictionaries, and export.

### Well API

File:

- `app/src/subsidence/api/wells.py`

Responsibilities:

- List wells and well inventory.
- Load a well with curves/formations/deviation summary.
- Load curve LOD data.
- Patch well metadata.
- Load deviation survey.

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

File:

- `app/src/subsidence/data/importers.py`

Responsibilities:

- Create empty wells.
- Resolve or create wells from incoming data.
- Read LAS.
- Read logs CSV.
- Read tops and unconformities CSV.
- Read deviation CSV.
- Write curve payload Parquet files.
- Apply imported metadata and link stratigraphy.

Risk:

- This is the largest backend file and the most important correctness hotspot.

Refactor direction:

- Split into:
  - `importers/common.py`
  - `importers/well_resolution.py`
  - `importers/las.py`
  - `importers/logs_csv.py`
  - `importers/tops.py`
  - `importers/deviation.py`

Do this only after API tests exist for import workflows.

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

Responsibilities:

- Built-in curve/lithology/stratigraphy defaults.
- Resolve curve mnemonics.
- Link tops to strat chart units.
- Normalize units.

---

## 4. Frontend Map

### App shell

File:

- `frontend/src/App.tsx`

Responsibilities:

- Compose toolbar, data manager, viewer, settings, status bar.
- Coordinate high-level effects after project/well changes.

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

Risk:

- Stores are convenient but can become hidden coupling points. Any new state should have a clear owner.

### Data Manager

Files:

- `frontend/src/components/layout/DataManagerPane.tsx`
- `frontend/src/components/layout/DataManagerTopPane.tsx`
- `frontend/src/components/layout/WellDataPanel.tsx`
- `frontend/src/components/layout/StratChartTab.tsx`
- `frontend/src/components/layout/CompactionModelsTab.tsx`
- `frontend/src/components/layout/useDataManagerController.ts`

Responsibilities:

- Tree display for strat charts, wells, and models.
- Selection, expansion, checkboxes/radio controls.
- Context menus.
- Object actions: duplicate, delete, rename, link, add/remove visualization items.

Risk:

- `useDataManagerController.ts` is a dense interaction controller. It should be split after tests are added.

### Settings pane

Files:

- `frontend/src/components/layout/SettingsInspector.tsx`
- `frontend/src/components/layout/SettingsPaneShell.tsx`

Responsibilities:

- Show editor for the selected object.
- Edit well metadata, LAS/curve settings, tops settings, strat chart stats, compaction model settings.

Risk:

- `SettingsInspector.tsx` contains many inspector types in one file.

Refactor direction:

- Split into inspectors by object type:
  - `WellSettingsInspector`
  - `CurveSettingsInspector`
  - `TopsSettingsInspector`
  - `StratChartSettingsInspector`
  - `CompactionModelInspector`

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

Typical bugs:

- Wrong active well preselected.
- File/folder picker does not remember root.
- Dialog writes to path field but action uses stale value.

### Well viewer

Files:

- `frontend/src/components/logview/LogViewPanel.tsx`
- `frontend/src/components/logview/DataTrack.tsx`
- `frontend/src/components/logview/DepthTrack.tsx`
- `frontend/src/components/logview/FormationColumn.tsx`
- `frontend/src/components/logview/TrackHeaderRow.tsx`
- `frontend/src/components/logview/TrackHeader.tsx`
- `frontend/src/components/logview/FormationTopLine.tsx`
- `frontend/src/components/logview/WellOverviewMinimap.tsx`
- `frontend/src/renderers/*.ts`
- `frontend/src/hooks/*.ts`

Responsibilities:

- Render depth track, log tracks, curves, fills, formation column, tops, and interaction overlays.
- Keep canvas rendering separated from SVG/HTML interaction.

Rule:

- Renderer changes should be tested with pure unit tests where possible.

### Subsidence panel

Files:

- `frontend/src/components/subsidence/MultiWellPanel.tsx`
- `frontend/src/components/subsidence/SubsidenceCanvas.tsx`
- `frontend/src/components/subsidence/SubsidenceControls.tsx`
- `frontend/src/utils/exportPng.ts`

Responsibilities:

- Show burial/subsidence curves.
- Trigger and display recalculation results.
- Export panel PNG.

Known historical risk:

- This panel has had visibility/rendering issues. Keep a dedicated bug document for panel rendering failures.

### Styling

File:

- `frontend/src/index.css`

Responsibilities:

- Global application styles and component styles.

Risk:

- This file is too large. Layout fixes can cascade into unrelated components.

Refactor direction:

- Split after behavior is stable:
  - layout shell
  - toolbar/dialogs
  - data manager
  - log viewer
  - subsidence panel
  - settings/status

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

### Subsidence recalculation

1. Formation edits or controls trigger frontend recalculation.
2. `computedStore` sends WebSocket payload.
3. Backend computes in `subsidence.py` using `data/backstrip.py`.
4. Frontend receives results and renders `SubsidenceCanvas`.

---

## 6. Where To Look By Bug Type

| Bug report | Start here |
|---|---|
| Project cannot open/save/reopen | `projectStore.ts`, `api/projects.py`, `data/project_manager.py` |
| Recent projects wrong | `projectStore.ts`, `data/project_manager.py`, `api/projects.py` |
| LAS/log CSV imports into wrong well | import dialog, `projectStore.ts`, `data/importers.py`, `api/projects.py` |
| Tops colors/links wrong | `data/importers.py`, `data/strat_link.py`, `api/formations.py`, `StratChartTab.tsx` |
| Data Manager tree wrong | `WellDataPanel.tsx`, `DataManagerPane.tsx`, `useDataManagerController.ts` |
| Settings pane wrong object | `viewStore.ts`, `SettingsInspector.tsx`, Data Manager selection code |
| Track display wrong | `workspaceStore.ts`, `LogViewPanel.tsx`, `TrackHeaderRow.tsx`, `DataTrack.tsx` |
| Curve rendering wrong | `DataTrack.tsx`, `renderers/*`, `hooks/useCanvasRenderer.ts` |
| Formation drag wrong | `FormationTopLine.tsx`, `wellDataStore.ts`, `api/formations.py` |
| Strat chart cannot delete/load | `api/strat_chart.py`, `StratChartTab.tsx`, `projectStore.ts` |
| Undo/redo wrong | `projectStore.ts`, `api/projects.py`, `data/undo.py` |
| Subsidence panel blank/wrong | `computedStore.ts`, `MultiWellPanel.tsx`, `SubsidenceCanvas.tsx`, `api/subsidence.py` |
| Export wrong | `utils/exportPng.ts`, `api/projects.py`, `SubsidenceControls.tsx` |
| Layout scroll/resizer bug | `index.css`, `SplitView.tsx`, `DataManagerPane.tsx`, `MultiWellPanel.tsx` |

---

## 7. Current Test Commands

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

Current baseline from 2026-04-23:

- Frontend: 25 passed.
- Backend: 21 passed.
