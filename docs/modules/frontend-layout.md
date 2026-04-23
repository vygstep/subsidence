# Frontend Layout Module

This module covers application shell, toolbar, Data Manager, settings, and dialogs.

---

## App Shell

File:

- `frontend/src/App.tsx`

Responsibilities:

- Compose main UI regions.
- Coordinate high-level effects after project or active well changes.
- Wire toolbar, Data Manager, viewer, settings pane, and status bar.
- Wire keyboard shortcuts and high-level project/well hydration effects.

Rule:

- Keep detailed behavior out of `App.tsx`. Move it to stores, hooks, or focused components.

---

## Toolbar and Dialogs

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

- Project actions.
- File/folder picking.
- Import target selection.
- Data creation actions.

Common bug areas:

- Active well is not preselected as target.
- Dialog input and action payload diverge.
- File picker root is not remembered.
- Path picker writes visible input but submit uses stale internal state.

---

## Data Manager

Files:

- `frontend/src/components/layout/DataManagerPane.tsx`
- `frontend/src/components/layout/DataManagerTopPane.tsx`
- `frontend/src/components/layout/WellDataPanel.tsx`
- `frontend/src/components/layout/StratChartTab.tsx`
- `frontend/src/components/layout/CompactionModelsTab.tsx`
- `frontend/src/components/layout/useDataManagerController.ts`

Responsibilities:

- Tree display for strat charts, wells, and models.
- Selection and expansion state.
- Visibility controls.
- Context menus.
- Object actions such as duplicate, delete, rename, and add/remove from visualization.

Risk:

- `useDataManagerController.ts` combines many interaction responsibilities.
- Right-click context behavior should stay cheap; slow context menus usually indicate over-coupled selection/action code.

Planned split:

- Selection controller.
- Context menu controller.
- Well object actions.
- Tops object actions.
- Strat chart actions.
- Visualization toggle actions.
- Rename/duplicate/delete actions.
- Active object settings routing.

---

## Settings Pane

Files:

- `frontend/src/components/layout/SettingsInspector.tsx`
- `frontend/src/components/layout/SettingsPaneShell.tsx`

Responsibilities:

- Show settings for the selected Data Manager or viewer object.
- Edit well metadata.
- Edit curve settings.
- Edit tops settings.
- Show strat chart statistics.
- Edit compaction model settings.

Risk:

- `SettingsInspector.tsx` has too many object-specific branches.
- It also triggers persistence for some settings. Extract UI-only branches separately from save/patch logic.

Planned split:

- `WellSettingsInspector`
- `CurveSettingsInspector`
- `TopsSettingsInspector`
- `StratChartSettingsInspector`
- `CompactionModelInspector`

Safety tests before split:

- selected well opens well settings
- selected curve opens curve settings
- selected LAS folder opens LAS settings
- selected top opens top settings
- selected strat chart opens chart stats/settings
- metadata edits persist and reload
