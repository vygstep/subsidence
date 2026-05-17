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
- `frontend/src/components/layout/ImportWellsDialog.tsx`
- `frontend/src/components/layout/ImportDeviationDialog.tsx`
- `frontend/src/components/layout/LoadStratChartDialog.tsx`
- `frontend/src/components/layout/LoadSeaLevelCurveDialog.tsx`
- `frontend/src/components/layout/ExportWellInfoDialog.tsx`
- `frontend/src/components/layout/ExportWellLogsDialog.tsx`
- `frontend/src/components/layout/ExportWellTopsDialog.tsx`
- `frontend/src/components/layout/ExportWellDeviationDialog.tsx`
- `frontend/src/components/layout/ExportStratChartDialog.tsx`
- `frontend/src/components/layout/ExportSeaLevelCurveDialog.tsx`
- `frontend/src/components/layout/FileOpenDialog.tsx`
- `frontend/src/components/layout/importWizard/*`
- `frontend/src/components/layout/export/*`

Responsibilities:

- Project actions.
- File/folder picking.
- Import target selection.
- Import preview and column mapping.
- Export scope, destination folder, per-well/combined layout, and zip selection.
- Data creation actions.

Common bug areas:

- Active well is not preselected as target.
- Dialog input and action payload diverge.
- File picker root is not remembered.
- Path picker writes visible input but submit uses stale internal state.
- Import wizard UX diverges between LAS, logs CSV, tops, deviation, wells, StratChart, and sea-level workflows.
- Exported file shape cannot be re-imported automatically.

---

## Data Manager

Files:

- `frontend/src/components/layout/DataManagerPane.tsx`
- `frontend/src/components/layout/DataManagerTopPane.tsx`
- `frontend/src/components/layout/WellDataPanel.tsx`
- `frontend/src/components/layout/StratChartTab.tsx`
- `frontend/src/components/layout/useDataManagerController.ts`
- `frontend/src/components/layout/dataManagerSelection.ts`
- `frontend/src/components/layout/dataManagerVisibility.ts`
- `frontend/src/components/layout/dataManagerActions.ts`

Responsibilities:

- Tree display for strat charts, wells, and models.
- Selection and expansion state.
- Visibility controls.
- Load/export grouped action menus.
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
- Edit StratChart display levels and label modes.
- Edit compaction model settings.
- Edit subsidence chart domain and interaction settings.

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
