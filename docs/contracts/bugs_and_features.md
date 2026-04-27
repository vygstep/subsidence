# Bugs and Feature Backlog Contract

**Status:** Active backlog contract  
**Scope:** Dictionary/template foundation, configurable import wizard, lithology pattern palettes, lithology curve support, viewer UX fixes, and subsidence chart presentation improvements.  
**Rule:** This is the single active contract for the next data-import and viewer backlog. The former future Import Wizard Contract is merged here as `WIZ-*`.

---

## 1. Summary

The backlog contains five different levels of work:

1. Fast viewer/UI fixes that can be implemented in small commits.
2. Dictionary and template infrastructure needed before advanced curve classification.
3. Configurable import wizard work for CSV/TSV/LAS and other tabular inputs.
4. Lithology visual palette infrastructure needed before lithology log rendering.
5. New lithology data-model work that will affect curve rendering, settings, subsidence inputs, and zone upscaling.

Implementation should not start with lithology upscaling. The safe order is:

1. Add Templates/Dictionaries UI and APIs.
2. Extend curve classification with mnemonic dictionaries.
3. Add the measurement-unit dictionary and engine-unit normalization foundation.
4. Build the Import Wizard shell and preview/mapping engine.
5. Connect Import Wizard presets for logs, tops, unconformities, deviation, and stratigraphy.
6. Add lithology pattern palette registry, built-in SVG patterns, and user SVG imports.
7. Add discrete lithology curve rendering.
8. Add percentage lithology tracks.
9. Add zone aggregation for subsidence inputs.
10. Improve subsidence chart stratigraphy presentation.
11. Implement low-risk viewer UX fixes in small independent commits when they do not conflict with the main path.

## 1.1 Execution Order

### Phase A: Foundation Before Import

Goal:

- Create the dictionary/template layer that later import and lithology features can depend on.

Items:

- `DICT-001`: Add Templates tab beside Settings. (done)
- `DICT-002`: Curve mnemonic resolver. (done)
- `DICT-003`: Lithology sets and compaction presets. (done)
- `UNIT-001`: Measurement unit dictionary and engine-unit normalization. (done)

Exit criteria:

- Built-in dictionaries are visible and read-only. (done)
- Project dictionaries/templates can be duplicated or extended where required. (done)
- Curve classification can use mnemonic first and measurement-unit fallback second. (done)
- Imported and edited numeric values can be normalized to the units expected by the calculation engine. (done)

### Phase B: Import Wizard

Goal:

- Replace direct path-only import dialogs with a configurable import workflow for tabular and LAS inputs.

Items:

- `WIZ-001`: Shared import wizard shell. (done)
- `WIZ-002`: File preview and parser detection. (done)
- `WIZ-003`: Column mapping and required-field validation. (done)
- `WIZ-004`: Target well resolution. (done)
- `WIZ-005`: Import presets by data type. (done)
- `WIZ-006`: Import execution, logging, and tests. (done)

Exit criteria:

- User can choose a file, inspect preview rows, confirm delimiter/header/mapping, confirm target well, and import.
- Missing well names are assigned to the active/selected target well.
- Import behavior is covered by tests before adding lithology-specific imports.

### Phase C: Lithology Pattern Palette Foundation

Goal:

- Replace hardcoded canvas lithology patterns with a dictionary-backed pattern palette registry.

Items:

- `PAT-001`: Vendor and document the Equinor lithology SVG pattern source. (done)
- `PAT-002`: Add lithology pattern palette schema and API. (done)
- `PAT-003`: Seed built-in SVG patterns. (done)
- `PAT-004`: Add Templates UI for lithology pattern palettes. (done)
- `PAT-005`: Connect lithology sets to selectable pattern palette entries. (done)
- `PAT-006`: Render lithology fills from SVG-backed pattern registry. (done)
- `PAT-007`: Pattern palette tests and migration coverage. (done)

Exit criteria:

- Built-in pattern palettes are visible and read-only.
- User SVG pattern palettes can be imported and reused.
- Lithology set entries select pattern ids from the registry instead of free-text ids.
- Existing hardcoded canvas patterns are no longer the source of truth.
- Pattern palette behavior is covered before `LITH-001` starts.

### Phase D: Formation Tops Model and Stratigraphic Zones

Goal:

- Separate the concepts of "horizon definition" and "well pick" so a named set of formation tops can be applied to multiple wells and compared. Build the stratigraphic zone entity that sits between consecutive horizons and carries aggregated well-specific attributes.

Items:

- `TOPS-001`: TopSet / Horizon / Pick data model. (done)
- `TOPS-002`: TVD/TVDSS as stored calculated fields; interactive depth picking. (done)
- `DEPTH-001`: Trusted depth reference on import, QC flags, TVD curve display. (done)
- `ZONE-001`: Zone entity and lifecycle. (done)
- `ZONE-002`: Zone settings UI and manual lithology input. (done)
- `ZONE-003`: Auto-lithology aggregation from discrete log (depends `LITH-001`). (done)
- `ZONE-004`: Zone attributes as subsidence calculation inputs (supersedes `LITH-003`). (done)
- `BSTRIP-001`: Per-zone paleobathymetry and eustatic sea level correction. (done)

Exit criteria:

- One TopSet can be applied to multiple wells; each well carries its own picks but shares horizon definitions and ages.
- Every imported object (curve, top, deviation) carries an explicit `trusted_depth_reference`; data from files with TVD/TVDSS depth axes is never silently mislabelled as MD.
- Curves can be displayed in MD, TVD, and TVDSS mode in the viewer using the same deviation survey that drives pick positioning.
- Import warnings (data below TD, outside deviation range, variable sampling) are surfaced to the user.
- Zones exist as first-class entities between consecutive horizons; thickness recalculates automatically when picks move.
- Manual lithology input per zone is available before any log-derived lithology is implemented.
- Zone-level lithology fractions are available as subsidence engine inputs.
- Per-zone paleobathymetry feeds into the backstrip engine; a eustatic sea level curve can be loaded and applied to shift all burial depths by the sea level at each time step.

### Phase E: Lithology Curves

Goal:

- Add discrete and percentage lithology curve support after zones are stable.

Items:

- `LITH-001`: Discrete log import and rendering. (done)
- `LITH-002`: Percentage lithology curves and Lithology track. (done)

Exit criteria:

- Discrete lithology curves render as blocks.
- Percentage lithology curves can be grouped into Lithology tracks.

### Phase E: Tops, Unconformities, and Subsidence Charts

Goal:

- Improve domain presentation and calculation controls around tops/unconformities and subsidence charts.

Items:

- `TOP-001`: Edit conformable/unconformity attributes in settings. (done)
- `UX-002`: Unconformity visual style. (done)
- `UX-003`: Toggle top labels per pick. (done)
- `SUBS-001`: Two-level stratigraphy in upper subsidence chart. (done)
- `SUBS-002`: Stratigraphy scale in lower multi-well subsidence chart. (done)
- `UX-010`: Subsidence chart labels. (done)

Exit criteria:

- Unconformities are editable and visually distinct.
- Subsidence charts show the intended labels and stratigraphy context.

### Phase F: Independent Viewer UX Fixes

Goal:

- Improve viewer usability without changing the data model.

Items:

- `UX-001`: Break log curves across missing intervals. (done)
- `UX-004`: Align vertical toolbar labels. (done)
- `UX-005`: Logs overview/minimap behavior.
- `UX-006`: Track-local tooltip. (done)
- `UX-007`: Cursor depth label on depth scale.
- `UX-008`: Delete track from track header context menu.
- `UX-009`: Compact application typography and spacing.

Exit criteria:

- Each item can be shipped independently with focused tests where practical.

---

## 2. Quick Viewer and UX Fixes

### UX-001: Break log curves across missing intervals

Problem:

- Continuous log curves currently break on invalid values, but valid points separated by a large depth gap can still be connected by a misleading interpolation line.

Required behavior:

- Curve rendering must break the path when the depth gap between neighboring valid samples exceeds a configurable threshold.
- Default threshold should be derived from the median sample step, with a safe fallback.
- This must not change stored curve data.

Likely code areas:

- `frontend/src/renderers/curveRenderer.ts`
- `frontend/src/components/logview/DataTrack.tsx`
- `frontend/src/types/tracks.ts`

Acceptance:

- Missing intervals are visually blank.
- Dense continuous logs still render as continuous curves.
- Existing null-value breaks continue to work.

### UX-002: Unconformity visual style

Problem:

- Tops with `kind = unconformity` are not visually distinct enough.

Required behavior:

- In tracks: unconformity lines should be red and wavy or otherwise clearly distinct.
- In Data Manager: unconformity picks should be bold red.
- Conformable tops keep the existing visual style.

Likely code areas:

- `frontend/src/components/interaction/FormationTopLine.tsx`
- `frontend/src/components/layout/WellDataPanel.tsx`
- `frontend/src/styles/data-manager.css`

Acceptance:

- A top marked as unconformity is distinguishable in both viewer and Data Manager.

### UX-003: Toggle top labels per pick

Problem:

- Top labels are always shown on tracks.

Required behavior:

- Add a settings checkbox for top picks to show/hide that pick label on tracks.
- The line remains visible when labels are hidden.
- Setting should persist through visual/project config or formation extra metadata, whichever is chosen for the model.

Likely code areas:

- `frontend/src/components/layout/settings/TopPickSettings.tsx`
- `frontend/src/components/interaction/FormationTopLine.tsx`
- Backend persistence if not stored in visual config.

Acceptance:

- User can hide/show a top label without hiding the top line.

### UX-004: Align vertical toolbar labels

Problem:

- Vertical toolbar labels in the log viewer sit lower than the equivalent labels in the subsidence chart.

Required behavior:

- Adjust log viewer vertical toolbar label positioning to match the subsidence toolbar visual alignment.

Likely code areas:

- `frontend/src/components/logview/WellViewerToolbar.tsx`
- `frontend/src/styles/log-view.css`
- `frontend/src/styles/subsidence-panel.css`

Acceptance:

- Log viewer toolbar label placement visually matches the subsidence toolbar convention.

### UX-005: Logs overview/minimap behavior

Problem:

- Logs overview needs to behave as a narrow optional right-side minimap.

Required behavior:

- Fixed at the far right of the log viewer.
- Shows only curves currently visible in viewer tracks.
- Thin and visually light.
- Visible viewport overlay is translucent blue.
- Disabled by default.

Likely code areas:

- `frontend/src/components/logview/WellOverviewMinimap.tsx`
- `frontend/src/components/logview/LogViewPanel.tsx`
- `frontend/src/stores/viewStore.ts`

Acceptance:

- Overview does not show hidden curves.
- Overview is off by default.
- Overview position remains stable during horizontal layout changes.

### UX-006: Track-local tooltip

Problem:

- Tooltip currently reports all loaded/visible curves instead of only curves belonging to the track under the cursor.

Required behavior:

- Tooltip must use the curve set for the active hovered track.
- Tooltip should not show values from other tracks.

Likely code areas:

- `frontend/src/components/interaction/InteractionOverlay.tsx`
- `frontend/src/components/interaction/CurveTooltip.tsx`
- `frontend/src/components/logview/DataTrack.tsx`
- `frontend/src/components/logview/LogViewPanel.tsx`

Acceptance:

- Hovering over one track shows only curves configured on that track.

### UX-007: Cursor depth label on depth scale

Problem:

- Cursor line exists, but the depth scale does not show the exact cursor depth beside the line.

Required behavior:

- Add a compact cursor-depth label on the depth track at the current cursor line.

Likely code areas:

- `frontend/src/components/interaction/DepthCursor.tsx`
- `frontend/src/components/logview/DepthTrack.tsx`
- `frontend/src/components/logview/LogViewPanel.tsx`

Acceptance:

- Depth label follows the cursor and uses the active depth unit/format.

### UX-008: Delete track from track header context menu

Problem:

- Users need to delete normal tracks from the viewer layout.

Required behavior:

- Right-click on a track header opens a context menu with Delete.
- Normal data tracks can be deleted.
- Depth track cannot be deleted.
- Formations track deletion policy must be explicit before implementation.

Likely code areas:

- `frontend/src/components/logview/TrackHeader.tsx`
- `frontend/src/components/logview/TrackHeaderRow.tsx`
- `frontend/src/stores/workspaceStore.ts`

Acceptance:

- Deleting a data track removes it from the layout and persists in per-well visual config.
- Depth track delete action is unavailable.

### UX-009: Compact application typography and spacing

Problem:

- Some UI text and panel/button spacing consume too much space.

Required behavior:

- Reduce percentage text size across the app by approximately 20-30%.
- Reduce padding/margins for compact panels, buttons, and controls.
- Avoid breaking readability or clickable target usability.

Likely code areas:

- `frontend/src/styles/*.css`
- `frontend/src/index.css`

Acceptance:

- UI is visibly more compact without clipping controls.

### UX-010: Subsidence chart labels

Problem:

- Subsidence charts need explicit titles/labels.

Required behavior:

- Upper subsidence chart label includes well name and model name.
- Current model name can be `Total subsidence`.
- Lower chart label is `Multi-well subsidence chart`.

Likely code areas:

- `frontend/src/components/subsidence/SubsidenceCanvas.tsx`
- `frontend/src/components/subsidence/MultiWellPanel.tsx`

Acceptance:

- Both charts have stable, readable titles.

---

## 3. Templates and Dictionaries Foundation

_DICT-002 and UNIT-001 are implemented — see Implemented section._

---

## 4. Import Wizard

Implementation checkpoints:

1. `WIZ-001-A`: add the shared wizard shell and preset model, then route existing import actions through the shell without changing backend behavior. (done)
2. `WIZ-001-B`: add step navigation, blocking validation states, and target-well controls shared by logs/tops/deviation. (done)
3. `WIZ-002-A`: add backend preview endpoints for tabular files and LAS files. (done)
4. `WIZ-002-B`: render parser settings and preview rows/curve metadata from the preview response. (done)
5. `WIZ-003-A`: add preset-specific mapping definitions and auto-mapping. (done)
6. `WIZ-003-B`: pass explicit mappings into import execution endpoints or adapter functions. (done)

Shared frontend model:

- `ImportWizardPreset`: data type, title, accepted file filters, preview mode, required fields, optional fields, target-well policy, execute endpoint, and result labels.
- `ImportWizardState`: selected file path, parser settings, preview response, column mappings, target-well policy, validation state, execution state, and last error.
- `ImportWizardShell`: reusable step layout, footer actions, error surface, and progress indicator.
- Preset-specific components should only provide field definitions, copy, and endpoint adapters.

Backend preview contract:

- `POST /api/import-preview/tabular`: accepts file path and parser settings; returns delimiter, header row, columns, first rows, row count where cheap, warnings, and suggested mappings.
- `POST /api/import-preview/las`: accepts LAS path; returns well metadata, depth unit, curve list with units, null value, start/stop/step where available, warnings, and suggested logs preset mappings.
- Preview endpoints do not mutate project state and do not write imported data.

### WIZ-001: Shared import wizard shell (done)

Problem:

- Current import dialogs are path-first workflows. The user picks a file and import starts with limited opportunity to verify the file format.

Required behavior:

- Introduce a shared import wizard component used by logs, tops, unconformities, deviation, stratigraphy, and future tabular imports.
- Wizard flow:
  - select file;
  - preview data;
  - configure parser settings;
  - map columns;
  - select target well where applicable;
  - validate required fields;
  - execute import.
- Existing direct import dialogs should either be replaced or become thin wrappers around the wizard.
- The first implementation keeps the current import endpoints and wraps them with the shared shell.
- File picking continues to use the existing `pickFile`, `getLastImportRoot`, and `rememberImportPath` helpers.
- The shell must support non-tabular LAS imports and tabular CSV/TSV imports through the same step container.
- Step buttons:
  - `Back`;
  - `Next`;
  - `Import`;
  - `Cancel`.
- Footer actions are disabled while preview/import requests are running.
- Every step must expose a compact validation summary, not only inline field errors.

Likely code areas:

- `frontend/src/components/layout/ImportLasDialog.tsx`
- `frontend/src/components/layout/ImportTopsDialog.tsx`
- `frontend/src/components/layout/ImportDeviationDialog.tsx`
- `frontend/src/components/layout/LoadStratChartDialog.tsx`
- New shared wizard components under `frontend/src/components/layout/importWizard/`.
- `frontend/src/components/layout/ProjectToolbar.tsx`
- `frontend/src/components/layout/pathMemory.ts`

Acceptance:

- There is one reusable wizard shell and data-type-specific presets plug into it.
- Logs, tops, and deviation toolbar actions open the same wizard shell with different presets.
- The initial shell can execute the same imports as the old dialogs.
- Existing target-well default behavior remains covered by tests.

### WIZ-002: File preview and parser detection

Problem:

- User needs to verify CSV/TSV format before import.

Required behavior:

- Preview the first 50 rows.
- Auto-detect delimiter:
  - comma;
  - tab;
  - semicolon where practical.
- Auto-detect likely header row.
- Allow user override for delimiter and header row.
- Preserve support for LAS imports, but LAS preview can initially show metadata/curve list instead of tabular rows.
- Preview should be backend-backed so the parsed columns match backend import behavior.
- Preview response must include warnings for:
  - empty files;
  - inconsistent row lengths;
  - duplicate column names;
  - missing obvious depth/name fields where a preset expects them.
- Parser settings:
  - delimiter: `auto`, `comma`, `tab`, `semicolon`;
  - header row index;
  - data start row index;
  - text encoding can remain UTF-8 in the first pass unless real files force expansion.

Likely code areas:

- `app/src/subsidence/api/projects_imports.py` or a dedicated `import_preview.py` router.
- New backend preview helpers under `app/src/subsidence/data/importers/preview.py`.
- New frontend preview client utilities under `frontend/src/components/layout/importWizard/`.
- Existing importers under `app/src/subsidence/data/importers/`.

Acceptance:

- User can see what will be imported before import starts.
- CSV and TSV previews show the same parsed columns that the import will use.
- LAS previews show well metadata and curve list before import starts.
- Changing delimiter/header row refreshes the preview deterministically.

### WIZ-003: Column mapping and required-field validation

Problem:

- Real files can have different column names and column order.

Required behavior:

- Provide a column mapping table for each import preset.
- Show required fields with checkbox/status indicators.
- Required field status:
  - green when mapped and parseable;
  - failed/neutral when missing.
- Optional fields can be mapped but do not block import.
- Mapping must support at least:
  - logs: depth column and curve columns;
  - tops: top name and depth;
  - unconformities: name/depth/age fields;
  - deviation: MD/TVD or inclination/azimuth variants;
  - stratigraphy: unit name, rank, age top/base, parent, color.
- Auto-mapping should use normalized aliases, not exact case-sensitive column names.
- Unit labels should be parsed from headers such as `DEPT[ft]`, `RHOB (kg/m3)`, and LAS curve metadata.
- Logs mapping must distinguish:
  - depth column;
  - excluded metadata columns;
  - imported curve columns.
- Mapping should be represented as data, so preset definitions can be tested without rendering the full wizard.

Likely code areas:

- New import wizard mapping model.
- Existing backend import endpoints and importers.
- `frontend/src/components/layout/importWizard/importWizardPresets.ts`
- `frontend/src/components/layout/importWizard/mapping.ts`

Acceptance:

- Import button is disabled until required mappings are valid.
- User can fix wrong auto-mapping before import.
- Auto-mapping handles reordered columns.
- Invalid mappings never start backend import execution.

### WIZ-004: Target well resolution

Problem:

- Some imported files do not contain a well name. Those data must go into the active/selected well instead of creating accidental new wells.

Required behavior:

- Target well dropdown defaults to the active well.
- User can select any existing well.
- If file contains well name, wizard shows it and allows policy selection:
  - use file well names;
  - force selected target well.
- If file does not contain well name, data imports into selected target well.
- If no well exists, wizard can create a default well using existing application defaults.

Likely code areas:

- `frontend/src/components/layout/ImportLasDialog.tsx`
- `frontend/src/stores/projectStore.ts`
- `app/src/subsidence/data/importers/common.py`
- `app/src/subsidence/api/projects_imports.py`

Acceptance:

- Importing logs/tops/deviation without well name writes to the selected target well.
- Active well is preselected.
- No hidden new well is created unless the selected policy allows it.

### WIZ-005: Data-type import presets

Problem:

- Different import types need different parser/mapping rules, but should share the same wizard infrastructure.

Required behavior:

- Add presets:
  - logs/LAS;
  - logs CSV/TSV;
  - tops;
  - unconformities;
  - deviation;
  - strat chart;
  - future generic tabular import.
- Each preset defines required columns, optional columns, default aliases, target-well policy, and backend endpoint.
- Logs preset should support later curve classification from dictionaries:
  - continuous;
  - discrete;
  - percentage lithology.

Likely code areas:

- New preset definitions in frontend.
- Existing import API endpoints.
- `app/src/subsidence/data/importers/`.

Acceptance:

- Adding a new tabular import type does not require rewriting the wizard shell.

### WIZ-006: Import execution, logging, and tests

Problem:

- Import problems should be diagnosable from logs and protected by regression tests.

Required behavior:

- Log import preview and execution events with source path, preset, target well, mapping summary, and result counts.
- Backend errors should return actionable messages.
- Tests should cover:
  - CSV delimiter detection;
  - TSV delimiter detection;
  - logs without well name importing into active/selected well;
  - tops import with reordered columns;
  - deviation import with supported column variants;
  - invalid required mapping blocking import.

Likely code areas:

- `app/src/subsidence/observability.py`
- `frontend/src/utils/diagnostics.ts`
- `app/tests/integration/test_project_api_workflows.py`
- New frontend import wizard tests.

Acceptance:

- Import wizard regressions are covered before lithology-specific import behavior is added.

---

## 5. Lithology Pattern Palettes

### PAT-001: Vendor and document the Equinor lithology SVG pattern source

Problem:

- Lithology patterns are currently hardcoded in `frontend/src/renderers/lithologyRenderer.ts`.
- The project needs a larger and auditable built-in pattern library before lithology logs are rendered.
- The initial external source should be `https://github.com/equinor/lithology-patterns`, whose SVG patterns are stored under `assets/svg` and licensed under MIT.

Required behavior:

- Clone or vendor `equinor/lithology-patterns` under `repos/lithology-patterns`.
- Record the upstream repository URL, license, and source asset path in project documentation.
- Do not make runtime rendering depend directly on the external repository checkout.
- Treat the upstream repository as a source snapshot for seeding/copying built-in assets into the application model.
- Preserve a clear boundary between:
  - upstream SVG pattern assets;
  - the app's built-in pattern palette rows;
  - user-imported SVG palettes.

Likely code areas:

- `repos/lithology-patterns/`
- `docs/contracts/bugs_and_features.md`
- New or existing dictionary documentation under `docs/`
- `app/src/subsidence/data/dictionaries/`

Acceptance:

- Upstream source is available under `repos/lithology-patterns`.
- The contract or supporting docs identify the source URL, license, and asset folder.
- Built-in seeding can proceed without using the upstream checkout as a runtime dependency.

### PAT-002: Add lithology pattern palette schema and API

Problem:

- `LithologySetEntry.pattern_id` is currently a free-text string.
- There is no database-backed pattern registry equivalent to unit dimensions or lithology sets.
- User SVG palettes need stable persistence, validation, preview metadata, and read-only built-in behavior.

Required behavior:

- Add a database-backed pattern registry with two levels:
  - `LithologyPatternPalette`: palette/set metadata.
  - `LithologyPattern`: one repeatable SVG pattern entry inside a palette.
- Built-in palettes are read-only.
- User palettes can be created, renamed, copied, deleted, and extended.
- Pattern entries store at least:
  - stable code/id used by lithology entries;
  - display name;
  - SVG content or internal asset reference;
  - tile width and tile height where available;
  - optional description/source metadata;
  - sort order;
  - built-in/read-only state inherited from palette.
- The API exposes:
  - list palettes;
  - fetch palette with pattern entries;
  - create/copy/rename/delete user palette;
  - add/edit/delete user pattern entry;
  - import SVG file(s) into a user palette.
- SVG import validation must reject clearly unsafe content before storage or rendering:
  - scripts;
  - event handler attributes;
  - external network references;
  - oversized files beyond a documented limit.
- Existing `LithologySetEntry.pattern_id` behavior must be migrated or wrapped so old projects still open.

Likely code areas:

- `app/src/subsidence/data/schema.py`
- `app/src/subsidence/data/dict_seeder.py`
- `app/src/subsidence/api/compaction.py` or a new `patterns.py` router
- `app/src/subsidence/api/main.py`
- `app/tests/integration/test_project_api_workflows.py`
- `frontend/src/types/subsidence.ts`
- `frontend/src/stores/wellDataStore.ts`

Acceptance:

- Built-in and user pattern palettes are persisted in the project database.
- Built-in rows cannot be edited or deleted through the API.
- User SVG imports are validated and stored.
- API responses provide enough data for UI previews and canvas rendering.
- Existing lithology sets with old `pattern_id` strings remain readable.

### PAT-003: Seed built-in SVG pattern palettes

Problem:

- Built-in lithology patterns should come from data, not frontend switch statements.
- The default lithology set should reference real pattern registry entries.

Required behavior:

- Seed a built-in palette from the Equinor SVG assets.
- Include at minimum the upstream pattern names currently documented by Equinor:
  - sandstone;
  - siltstone;
  - mudstone;
  - claystone;
  - shale;
  - limestone;
  - marl;
  - gypsum;
  - dolostone;
  - conglomerate.
- Map existing default lithology rows to the closest built-in SVG pattern codes.
- Keep solid fill as a valid explicit option for entries with no pattern.
- The seeder must be idempotent and self-healing for open projects, following the existing dictionary seeder pattern.
- Do not overwrite user palettes or user lithology set choices.

Likely code areas:

- `app/src/subsidence/data/dictionaries/`
- `app/src/subsidence/data/dict_seeder.py`
- `app/src/subsidence/data/schema.py`
- `app/tests/integration/test_project_api_workflows.py`

Acceptance:

- A new project contains a read-only built-in lithology pattern palette.
- Existing projects receive missing built-in palette rows on open.
- Default lithology set entries reference available built-in pattern codes where appropriate.
- Re-running seed logic does not duplicate palettes or pattern rows.

### PAT-004: Add Templates UI for lithology pattern palettes

Problem:

- Users need to inspect built-in patterns and manage project-specific SVG palettes from the same Templates area as lithology sets and units.

Required behavior:

- Add a `Pattern Palettes` subtree in the Templates tab.
- The root panel lists built-in and user palettes with entry counts.
- The palette detail panel shows:
  - pattern preview swatch;
  - code;
  - display name;
  - tile size;
  - source/origin;
  - description where available.
- Built-in palette details are read-only.
- User palette details allow:
  - rename palette;
  - add/import SVG pattern;
  - edit display name/code where safe;
  - delete pattern;
  - delete palette.
- Preview rendering should use the same sanitized SVG-to-pattern path that the log renderer will use, not a separate fake preview.

Likely code areas:

- `frontend/src/components/layout/TemplatesTab.tsx`
- `frontend/src/components/layout/SettingsInspector.tsx`
- New settings components under `frontend/src/components/layout/settings/`
- `frontend/src/stores/wellDataStore.ts`
- `frontend/src/types/subsidence.ts`
- `frontend/src/styles/data-manager.css`

Acceptance:

- Pattern palettes are discoverable from Templates.
- Built-in palettes are visibly read-only.
- User palettes can be created/imported and previewed.
- Pattern preview matches the renderer's final tile behavior.

### PAT-005: Connect lithology sets to selectable pattern palette entries

Problem:

- `LithologySetSettings` currently exposes `pattern_id` as a free-text field.
- Lithology entries should choose from known pattern registry entries, while still allowing solid fill.
- A lithology entry already links visual style and compaction preset; this should remain the central per-lithology configuration point.

Required behavior:

- Replace free-text pattern entry editing with a pattern selector.
- Selector options include:
  - solid fill / no pattern;
  - built-in pattern entries;
  - user-imported pattern entries.
- Each selectable pattern shows a compact preview and display name.
- Lithology set entries continue to expose:
  - lithology code;
  - display name;
  - color;
  - selected pattern;
  - linked compaction preset;
  - derived density, surface porosity, and compaction coefficient.
- Built-in lithology sets remain read-only.
- User lithology sets can use either built-in or user pattern entries.
- If a referenced user pattern is deleted, dependent lithology entries must fall back predictably:
  - either block deletion with a clear API error;
  - or set affected entries to solid fill.
  - The chosen policy must be explicit before implementation.

Likely code areas:

- `frontend/src/components/layout/settings/LithologySetSettings.tsx`
- `frontend/src/stores/wellDataStore.ts`
- `frontend/src/types/subsidence.ts`
- `app/src/subsidence/api/compaction.py`
- Pattern palette API module

Acceptance:

- Users cannot type invalid pattern ids by accident.
- Lithology set rows preview the actual selected pattern.
- User lithology sets can combine built-in compaction presets with user-imported visual patterns.
- Pattern deletion behavior is deterministic and tested.

### PAT-006: Render lithology fills from SVG-backed pattern registry

Problem:

- `frontend/src/renderers/lithologyRenderer.ts` currently renders only a few canvas-drawn hardcoded pattern names.
- Discrete and percentage lithology tracks need a generic renderer that can repeat SVG patterns from the registry.

Required behavior:

- Replace the hardcoded switch-based pattern renderer with a registry-backed renderer.
- Renderer input should be a resolved visual style, not only a lithology enum:
  - fill color;
  - optional pattern code/id;
  - optional SVG content or resolved pattern asset;
  - fallback label/color for unknown values.
- Convert sanitized SVG patterns to repeatable canvas patterns.
- Cache canvas patterns by rendering context and stable pattern version/key.
- Preserve solid fill behavior when no pattern is selected or pattern loading fails.
- Unknown or missing lithology values must use a visible fallback style.
- The renderer must support:
  - current formation/lithology block usage;
  - future `curve_type = discrete` block tracks;
  - future percentage lithology composition tracks.

Likely code areas:

- `frontend/src/renderers/lithologyRenderer.ts`
- `frontend/src/renderers/index.ts`
- `frontend/src/components/logview/DataTrack.tsx`
- `frontend/src/components/layout/settings/`
- `frontend/src/types/tracks.ts`

Acceptance:

- Existing lithology blocks still render.
- Built-in SVG patterns render as repeatable canvas fills.
- User-imported SVG patterns render through the same path.
- Renderer no longer depends on hardcoded lithology string cases for pattern drawing.
- Pattern rendering failures degrade to solid fill plus normal block border, without breaking the viewer.

### PAT-007: Pattern palette tests and migration coverage

Problem:

- Pattern registry changes affect database schema, API behavior, Templates UI, and rendering.
- Regression coverage is needed before lithology log import and rendering depend on these patterns.

Required behavior:

- Backend tests cover:
  - built-in palette seeding;
  - idempotent self-healing;
  - read-only built-in protection;
  - user palette CRUD;
  - SVG import validation;
  - lithology set references to pattern entries;
  - old `pattern_id` compatibility/migration.
- Frontend tests cover:
  - Templates tree shows pattern palettes;
  - built-in palette is read-only;
  - lithology set pattern selector lists built-in and user patterns;
  - invalid/missing pattern falls back in preview.
- Renderer-level tests or focused component tests cover:
  - solid fill;
  - SVG pattern fill;
  - missing pattern fallback.

Likely code areas:

- `app/tests/integration/test_project_api_workflows.py`
- Frontend integration tests under `frontend/src/__tests__/integration/`
- Renderer tests where practical

Acceptance:

- Pattern registry behavior is protected before `LITH-001`.
- Old projects with existing lithology sets still open and display sane visual styles.

---

## 6. Formation Tops Model and Stratigraphic Zones

### TOPS-001: TopSet / Horizon / Pick data model

Problem:

- `FormationTopModel` merges two distinct concepts: the definition of a stratigraphic horizon (name, age, color, kind) and the well-specific observation of that horizon (depth). There is no way to define a named set of formation tops once and apply it to multiple wells.
- Applying the same pick framework to a second well currently requires a duplicate import. Ages and colors must be re-entered or re-matched.
- Comparing the same stratigraphic interval across two wells is impossible because the interval is not an independent entity.

Required behavior:

**New schema tables (SCHEMA_VERSION 7 → 8):**

- `TopSet`: named collection of horizon definitions belonging to the project. Fields: `id` (int PK autoincrement), `name` (String 256), `description` (Text nullable), `created_at`, `modified_at`.

- `TopSetHorizon`: one horizon definition within a TopSet. Fields: `id` (int PK autoincrement), `top_set_id` (int FK → `top_sets.id` CASCADE DELETE), `name` (String 256), `kind` (String 16, default `'strat'`, values `'strat'` | `'unconformity'`), `age_ma` (Float nullable — canonical reference age of this boundary), `color` (String 9, default `'#90a4ae'`), `sort_order` (int — explicit ascending integer, managed by service), `note` (Text nullable). Unique constraint on `(top_set_id, name)`.

- `WellActiveTopSet`: which TopSet a well currently uses. Fields: `id` (int PK autoincrement), `well_id` (str FK → `wells.id` CASCADE DELETE, UNIQUE — one active set per well), `top_set_id` (int FK → `top_sets.id` RESTRICT — cannot delete a TopSet while any well references it).

**Modified `FormationTopModel`:**

- Add `horizon_id` (int nullable FK → `top_set_horizons.id` SET NULL on delete). Default NULL. Existing records are unaffected.
- Add `depth_tvdss` (Float nullable). Existing `depth_tvd` field starts being populated by the backend (was always nullable but never written).
- Make `depth_md` nullable (Float nullable). Rationale: when a TopSet is applied to a well and a pick has not yet been assigned a depth, the record exists but has no valid MD. The UI shows these as "unset" with a dashed line or empty depth cell. Existing records keep their numeric value; the migration adds `NULL` as a valid state.

**Backend service: `app/src/subsidence/data/deviation_transform.py` (new file):**

- `build_tvd_table(project_path, deviation_survey) → tuple[np.ndarray, np.ndarray] | None`: loads the parquet file at `deviation_survey.data_uri`, reads columns `md` and `incl_deg` / `azim_deg` (for INCL_AZIM mode), runs the minimum-curvature algorithm identical to the JavaScript in `frontend/src/utils/depthTransform.ts`, returns `(md_array, tvd_array)`. Returns `None` if survey is absent or mode is not INCL_AZIM.
- `interpolate_tvd(md_value, md_array, tvd_array) → float`: binary search + linear interpolation, mirrors `mdToTvd` in `depthTransform.ts`.
- `compute_tvd_tvdss(project_path, well, depth_md) → tuple[float | None, float | None]`: builds the TVD table for the well's deviation survey, interpolates TVD at `depth_md`, computes TVDSS as `tvd - well.kb_elev`. Returns `(None, None)` if no survey or mode is unsupported.
- `tvd_to_md(tvd_value, md_array, tvd_array) → float | None`: inverse lookup — binary search on the TVD array to find the corresponding MD. Returns `None` if TVD array is not monotonically increasing or value is out of range.
- `recalculate_picks_tvd(session, project_path, well) → int`: for every `FormationTopModel` record belonging to `well` that has a non-null `depth_md`, call `compute_tvd_tvdss` and write `depth_tvd` and `depth_tvdss`. Returns count of updated records.

**Changes to existing undo commands:**

- `UpdateFormationDepth` (in `app/src/subsidence/data/undo.py` or wherever it lives): after updating `depth_md`, call `compute_tvd_tvdss` and write `depth_tvd` / `depth_tvdss` to the same record within the same transaction. Command must receive `project_path` for this. The command currently only stores old/new `depth_md` — also store old/new `depth_tvd` and `depth_tvdss` for correct undo.
- `CreateFormation`: after creating the record, call `compute_tvd_tvdss` and populate the two TVD fields.

**TopSet API (`app/src/subsidence/api/top_sets.py`, new router):**

- `GET /api/top-sets` → list all TopSets with id, name, description, horizon_count.
- `POST /api/top-sets` → create new TopSet (body: name, description?). Returns created TopSet.
- `GET /api/top-sets/{id}` → full detail with ordered list of horizons (id, name, kind, age_ma, color, sort_order).
- `PATCH /api/top-sets/{id}` → rename or update description.
- `DELETE /api/top-sets/{id}` → blocked with 409 if any well has this TopSet active (`WellActiveTopSet` row exists); otherwise cascade-deletes all horizons and zones.
- `POST /api/top-sets/{id}/horizons` → add horizon (body: name, kind, age_ma?, color?, insert_after_sort_order?). Service assigns `sort_order`, creates the new `FormationZone` records for every well using this TopSet.
- `PATCH /api/top-sets/{id}/horizons/{hid}` → update name, age_ma, color, kind, sort_order. Reordering triggers zone rebuild for all wells.
- `DELETE /api/top-sets/{id}/horizons/{hid}` → deletes horizon, merges adjacent zones, clears `lithology_fractions` in merged `ZoneWellData`.
- `POST /api/top-sets/{id}/extract-from-well` → body: `well_id`. Creates a TopSet whose horizons mirror the existing `FormationTopModel` records of that well (by name, age, color, kind, sorted by current depth_md). Sets `horizon_id` on each existing `FormationTopModel` record to point to the corresponding new horizon. Creates `WellActiveTopSet` for that well.
- `POST /api/wells/{well_id}/apply-top-set` → body: `top_set_id`. Creates `WellActiveTopSet`. For each `TopSetHorizon` in the set: if a `FormationTopModel` record with matching `name` already exists for this well, sets its `horizon_id`; otherwise creates a new `FormationTopModel` with `depth_md = NULL`, `horizon_id` set, `name`/`age_top_ma`/`color`/`kind` copied from the horizon. Triggers zone rebuild for this well.

**Formation response changes:**

- `FormationTopResponse` gains `depth_tvd: float | None`, `depth_tvdss: float | None`, `horizon_id: int | None`.
- `FormationInventoryItem` (in inventory response) gains `depth_tvd: float | None`, `depth_tvdss: float | None` for display in data manager and subsidence chart.
- `GET /api/wells/inventory` builds `formations` with depth_tvd and depth_tvdss from stored fields — no on-the-fly calculation.
- A new inventory response field per well: `active_top_set: { id, name } | null`.

**Import flow changes:**

- `import_tops_csv` (`app/src/subsidence/data/importers/tops.py`): after creating each `FormationTopModel` record, call `compute_tvd_tvdss` and populate `depth_tvd` / `depth_tvdss`. If the well has an active TopSet, attempt name-match to set `horizon_id`.
- `PATCH /api/wells/{well_id}/formations/{formation_id}` (`formations.py`): extend `FormationTopPatch` to accept optional `depth_tvd: float | None` and `depth_tvdss: float | None` as alternative depth inputs. When `depth_tvd` is provided instead of `depth_md`, back-calculate MD using `tvd_to_md`; when `depth_tvdss` is provided, convert via `tvd_to_md(tvdss + well.kb_elev, ...)`. If back-calculation fails (no survey), return 400 with clear message. In all cases, store all three depth fields after resolution.

**Trigger: recalculate TVD after deviation import:**

- `POST /api/projects/import-deviation` handler: after successful import, call `recalculate_picks_tvd` for the well. This ensures all existing `FormationTopModel` records immediately reflect the new survey.
- New endpoint `POST /api/wells/{well_id}/formations/recalculate-tvd`: explicit call, returns `{ updated_count: int }`.

**Strat link functionality unchanged.** `FormationStratLink`, `auto_link_to_active_chart`, `PUT /api/wells/{well_id}/formations/{formation_id}/strat-link` — all remain exactly as implemented.

Likely code areas:

- `app/src/subsidence/data/schema.py` — add `TopSet`, `TopSetHorizon`, `WellActiveTopSet`; modify `FormationTopModel`; bump `SCHEMA_VERSION` to 8.
- `app/src/subsidence/data/deviation_transform.py` — new module.
- `app/src/subsidence/data/undo.py` — update `UpdateFormationDepth`, `CreateFormation`.
- `app/src/subsidence/api/top_sets.py` — new router.
- `app/src/subsidence/api/main.py` — register new router.
- `app/src/subsidence/api/formations.py` — extend `FormationTopPatch`, `FormationTopResponse`; add TVD logic to create/update paths.
- `app/src/subsidence/api/wells.py` — extend `FormationInventoryItem`, `WellInventoryResponse`.
- `app/src/subsidence/data/importers/tops.py` — call TVD calculation after each pick creation.
- `app/src/subsidence/api/projects_imports.py` — call `recalculate_picks_tvd` after deviation import.
- `frontend/src/types/well.ts` — extend `FormationTop` with `depth_tvd`, `depth_tvdss`, `horizon_id`.
- `frontend/src/stores/wellDataStore.ts` — load and expose `active_top_set`, top set CRUD actions.
- `frontend/src/types/subsidence.ts` — add `TopSetSummary`, `TopSetDetail`, `TopSetHorizon` types.

Dependencies: none.

Acceptance:

- `extract-from-well` on Well A produces a TopSet; `apply-top-set` on Well B creates picks with depths null; after importing a tops CSV for Well B matched by horizon name, the picks have depths.
- Moving a pick triggers TVD/TVDSS update; the inventory response reflects updated values.
- Importing a new deviation survey triggers recalculation of all existing picks.
- Legacy wells (no TopSet, no horizon_id) open without errors; all existing tests pass unchanged.
- `SCHEMA_VERSION` = 8; migrations run cleanly on an existing v7 database.

Implemented: commits `542ade1` (backend) and `1308a0d` (frontend types).

- `app/src/subsidence/data/schema.py`: `TopSet`, `TopSetHorizon`, `WellActiveTopSet` tables; `FormationTopModel` gains `horizon_id`, `depth_tvdss`, nullable `depth_md`; `SCHEMA_VERSION` → 8.
- `app/src/subsidence/data/deviation_transform.py`: new module — `compute_tvd_tvdss`, `tvd_to_md`, `recalculate_picks_tvd`, `_min_curvature`.
- `app/src/subsidence/data/undo.py`: `UpdateFormationDepth` accepts `project_path`; updates `depth_tvd`/`depth_tvdss` in same transaction.
- `app/src/subsidence/api/top_sets.py`: full CRUD router for TopSets/horizons; `PUT /api/wells/{well_id}/active-top-set`; `POST /api/top-sets/{id}/extract-from-well/{well_id}`; `POST /api/wells/{well_id}/recalculate-tvd`.
- `app/src/subsidence/api/formations.py`: `FormationTopResponse` gains `depth_tvd`, `depth_tvdss`, `horizon_id`; create endpoint computes TVD; `UpdateFormationDepth` gets `project_path`.
- `app/src/subsidence/api/wells.py`: `FormationInventoryItem`/`FormationResponse` gain TVD fields; `WellInventoryResponse` gains `active_top_set_id`, `active_top_set_name`; inventory query loads `WellActiveTopSet` in one batch.
- `app/src/subsidence/api/projects_imports.py`: `recalculate_picks_tvd` called after deviation import and tops import.
- `frontend/src/types/well.ts`: `FormationTop.depth_md` → `number | null`; added `depth_tvd`, `depth_tvdss`, `horizon_id`; `WellInventory` gains `active_top_set_id`, `active_top_set_name`.
- `frontend/src/types/subsidence.ts`: added `TopSetHorizon`, `TopSetSummary`, `TopSetDetail`.
- All components null-guarded for `depth_md`: skip rendering if null in `InteractionOverlay`, `FormationColumn`, `WellOverviewMinimap`; display `—` in `FormationTopsList`; drag disabled in `useFormationDrag`.

Not yet implemented from TOPS-001 spec (deferred to TOPS-002 or later):
- `FormationTopPatch` does not yet accept `depth_tvd`/`depth_tvdss` as alternate inputs (back-calculation via `tvd_to_md`).
- `import_tops_csv` does not yet match horizon_id by name against active TopSet during import.
- Integration tests for TopSet lifecycle.

---

### TOPS-002: TVD/TVDSS display, interactive depth picking, and Set Depth

Problem:

- The current depth track and all UI inputs only use MD. There is no way to view or edit picks in TVD or TVDSS.
- Setting a pick depth requires importing a file or manually dragging in the viewer. There is no direct numeric input and no click-to-set workflow.
- The drag interaction only updates MD; TVD/TVDSS are not recalculated from the drag result.

Required behavior:

**Depth type extension:**

- `viewStore.depthType` currently `'MD' | 'TVD'` → extend to `'MD' | 'TVD' | 'TVDSS'`. Update `setDepthType` signature and all consumers: `DepthTrack`, `FormationColumn`, `StatusBar`, depth display in Data Manager, `useFormationDrag`.
- When `depthType = 'TVD'` or `'TVDSS'`: `FormationColumn` reads the stored `depth_tvd` / `depth_tvdss` from the formation record to position the line. `DepthTrack` renders TVD/TVDSS scale from the loaded TVD table (already computed in `depthTransform.ts` from the well's survey points; expose as a hook `useTVDTable(): TVDTable | null` in `wellDataStore`).
- The frontend keeps `depthTransform.ts` for rendering the depth scale; authoritative stored values always come from the backend.

**Active pick mode:**

- Add `activePickId: string | null` and `setActivePickId: (id: string | null) => void` to `viewStore` (or `workspaceStore`, whichever holds transient viewer state).
- In `interactionMode = 'edit-tops'`, clicking a formation line in `FormationTopLine` (without dragging) sets `activePickId` to that formation's id and marks it as "active target for depth input".
- Active pick is highlighted differently from the selected pick: a filled circle handle at the pick depth, brighter stroke, cursor `crosshair` on the track area.
- Pressing Escape clears `activePickId`.
- Only one active pick at a time, cleared when switching wells or exiting `edit-tops` mode.

**Click-to-set depth:**

- When `interactionMode = 'edit-tops'` AND `activePickId` is set: `LogViewPanel` adds an `onClick` handler to the tracks container (alongside existing `onMouseMove`). On click: read `cursorDepth` (already maintained by `handleMouseMove`), call `wellDataStore.updateFormationDepth(activePickId, cursorDepth)`. The depth is always sent as MD regardless of `depthType`; the backend calculates and stores TVD/TVDSS.
- Visual feedback: while hovering with active pick mode, show a temporary ghost line at cursor position (same color as the active pick, dashed, 50% opacity).

**Drag interaction update:**

- `useFormationDrag.ts`: `dragState.current.startDepth` currently reads `formation.depth_md`. When `depthType = 'TVD'`, start from `formation.depth_tvd`; for `'TVDSS'`, from `formation.depth_tvdss`. During drag, convert displayed delta to MD delta for the backend call — use the frontend `TVDTable` (`mdToTvd` in reverse via `tvdToMd` helper in `depthTransform.ts`): add `tvdToMd(targetTVD, table) - tvdToMd(startTVD, table)` to get the MD delta. The final `onDragEnd` still calls `updateFormationDepth` with the resolved MD. Add `tvdToMd` to `depthTransform.ts` (binary search on `tvd` array).
- `wellDataStore.updateFormationDepth`: currently `PATCH depth_md`. After TOPS-001, the backend recalculates TVD/TVDSS internally — no change needed on the API call, but the frontend must re-fetch or optimistically update all three depth fields from the PATCH response.

**Set Depth context menu:**

- `FormationTopLine.tsx`: add `onContextMenu` handler. Opens a small popover/tooltip anchored to the pick line position. The popover contains:
  - Three labeled inputs: MD, TVD, TVDSS (each showing current stored value, or `—` if null).
  - Only the input for the current `depthType` is focused/editable by default; the other two are read-only and reflect what the backend will compute.
  - Confirm on Enter or click-away dismisses. On confirm: `PATCH /api/wells/{well_id}/formations/{formation_id}` with `{depth_md: value}` if MD was edited, or `{depth_tvd: value}` / `{depth_tvdss: value}` if TVD/TVDSS was edited (TOPS-001 endpoint accepts these).
  - The popover must be dismissible with Escape.
- Data Manager row for a formation: add an inline editable depth cell. Single-click shows the numeric value; double-click or "edit" icon activates an `<input>` pre-filled with the depth in current `depthType`. Saving triggers the same PATCH call.

**"Set depth" from Data Manager pick list:**

- `FormationTopsList.tsx` (or the inline per-formation row in `WellDataPanel`): replace the current read-only depth display with an editable field. The field label shows `MD` / `TVD` / `TVDSS` based on `depthType`. Editing sends the same PATCH with the appropriate field.

**"Not picked" state:**

- `FormationTopModel.depth_md` is now nullable (TOPS-001). The frontend `FormationTop.depth_md` type becomes `number | null`.
- In `FormationColumn`: if `depth_md` (and all three depth fields) are null, render the formation as a dashed horizontal line at the top of the visible area with a badge "not picked", not as a draggable line. Click on it in `edit-tops` mode activates it for click-to-set.
- In `FormationTopsList`: show `—` for depth; cell is editable.
- `useFormationDrag`: guard against null `formation.depth_md`; drag is disabled if depth is null.

Likely code areas:

- `frontend/src/stores/viewStore.ts` — extend `depthType`, add `activePickId`.
- `frontend/src/utils/depthTransform.ts` — add `tvdToMd(tvd, table)`.
- `frontend/src/hooks/useFormationDrag.ts` — depth-type-aware drag start and delta calculation.
- `frontend/src/components/interaction/FormationTopLine.tsx` — context menu, active-pick highlighting, click handler.
- `frontend/src/components/logview/LogViewPanel.tsx` — `onClick` for click-to-set.
- `frontend/src/components/logview/FormationColumn.tsx` — render "not picked" state; use `depth_tvd`/`depth_tvdss` for positioning in non-MD modes.
- `frontend/src/components/logview/DepthTrack.tsx` — TVD/TVDSS scale rendering.
- `frontend/src/components/layout/FormationTopsList.tsx` — editable depth cell.
- `frontend/src/components/layout/WellDataPanel.tsx` — depth display using `depthType`.
- `app/src/subsidence/api/formations.py` — `FormationTopPatch` accepts `depth_tvd`, `depth_tvdss`; back-calculation logic.

Dependencies: `TOPS-001`.

Acceptance:

- Switching depth type to TVD repositions all formation lines to stored `depth_tvd` values.
- Clicking on a track with an active pick in `edit-tops` mode sets the pick depth; the response includes updated `depth_tvd` and `depth_tvdss`.
- Right-click "Set depth" popover: editing TVD updates MD correctly via back-calculation; without a survey it returns 400 and the UI shows an error.
- Dragging a pick in TVD mode moves the line in TVD space; the stored MD is updated accordingly.
- Formations with `depth_md = null` display as "not picked" and can be assigned a depth via click or the inline editor.
- Existing drag tests still pass; new tests cover click-to-set and the TVD/TVDSS context menu.

#### Implemented (TOPS-002)

Commit `9d79cae` — all frontend and backend changes landed together.

Backend:
- `FormationTopPatch` now accepts `depth_tvd` and `depth_tvdss` as alternate depth inputs. When `depth_md` is not set, the backend back-calculates MD using `tvd_to_md()` (or adds `kb_elev` for TVDSS → TVD first). Returns 400 if no deviation survey is available.
- Import in `formations.py`: added `tvd_to_md` from `deviation_transform`.

Frontend:
- `viewStore.depthType` extended to `'MD' | 'TVD' | 'TVDSS'`. `activePickId: string | null` and `setActivePickId` added. `setInteractionMode('view')` clears `activePickId`.
- `depthTransform.ts`: added `tvdToMd(tvdValue, table)` (binary search on `tvd` array, mirrors `mdToTvd`).
- `DepthTrack.tsx`: TVDSS label transform = `mdToTvd(md, table) − kbElev`.
- `FormationColumn.tsx`: TVDSS display depth = `mdToTvd(md, table) − kbElev`. "Not picked" formations render as colored name badges at the top of the column canvas.
- `WellViewerToolbar.tsx`: added MD / TVD / TVDSS toggle button group.
- `StatusBar.tsx`: cursor depth displayed as TVD or TVDSS when applicable.
- `InteractionOverlay.tsx`: not-picked formations rendered as clickable SVG strip; clicking sets `activePickId`. Ghost line at cursor when a pick is active. `FormationTopLine` receives `isActivePick` and `onSetActivePick` props.
- `FormationTopLine.tsx`: active-pick highlight (filled circle handle, wider stroke, crosshair cursor). Single click toggles `activePickId`. Right-click opens "Set depth" popover with MD / TVD / TVDSS inputs (current depthType is focused/editable; others are read-only). Popover dismisses on Escape, Enter, or outside click.
- `LogViewPanel.tsx`: `onClick` handler on tracks div — when `interactionMode = 'edit-tops'` and `activePickId` is set, click depth is sent to `updateFormationDepth(activePickId, depth)` and `activePickId` is cleared.
- `FormationTopsList.tsx`: depth column shows value for current `depthType` (MD/TVD/TVDSS). Double-click activates an inline `<input>` pre-filled with the current-depthType value; saving sends the appropriate `depth_md`/`depth_tvd`/`depth_tvdss` PATCH field.
- `wellDataStore.ts`: `FormationPatchPayload` now includes `depth_tvd?: number` and `depth_tvdss?: number`.

Not yet implemented (deferred):
- Drag in TVD/TVDSS mode still uses MD pixel delta (depth_md as start depth). TVD-aware drag with `tvdToMd` delta requires additional work in `useFormationDrag.ts`.
- Integration tests for click-to-set and the Set Depth context menu.

---

### DEPTH-001: Trusted depth reference, import QC flags, and TVD curve display

Problem:

- `CurveMetadata` does not record what depth type the imported file used. A LAS or CSV file whose depth column is TVDSS is stored and rendered as if the depths are MD — silent data misinterpretation with no warning.
- Import does not warn when data extends beyond well TD, curves fall outside the deviation survey range, or sampling is irregular/variable.
- After TOPS-002, formation picks can be viewed in TVD/TVDSS — but log curves stay in MD regardless of the viewer depth mode. The depth axis is inconsistent between picks and curves when the user switches depth type.

Required behavior:

**Schema changes (SCHEMA_VERSION 8 → 9):**

- `CurveMetadata`: add `trusted_depth_reference` (String 8, default `'MD'`; values: `'MD' | 'TVD' | 'TVDSS'`), `sampling_kind` (String 16, nullable; values: `'CONSTANT' | 'VARIABLE' | 'SINGLE_POINT' | 'UNKNOWN'`), `nominal_step_m` (Float nullable — median depth step for CONSTANT curves, in meters), `qc_status` (String 8, default `'OK'`; values: `'OK' | 'WARNING' | 'ERROR'`), `qc_summary` (Text nullable — JSON blob; see format below).
- `FormationTopModel`: add `qc_status` (String 8, default `'OK'`), `qc_summary` (Text nullable — JSON blob).

Migration: existing `CurveMetadata` rows default to `trusted_depth_reference = 'MD'`, `qc_status = 'OK'`, `sampling_kind = NULL`. Existing `FormationTopModel` rows default to `qc_status = 'OK'`. These defaults are safe because historical import always treated depths as MD.

**QC flag codes (stable string constants):**

```
CURVE_BELOW_TD               — curve max depth > well.td_md * 1.001
TOP_BELOW_TD                 — top depth > well.td_md * 1.001
DEVIATION_SHORTER_THAN_CURVE — deviation max MD < curve max MD
VARIABLE_SAMPLING            — depth step varies by more than 10% of median step
DUPLICATE_DEPTHS             — two or more samples share the same depth
NON_MONOTONIC_DEPTH          — depth values not strictly increasing after dedup
LARGE_DEPTH_GAP              — any gap > 20× median step
HIGH_NULL_FRACTION           — more than 30% of value samples are null
ALL_VALUES_NULL              — every value sample is null
DEPTH_UNIT_UNKNOWN           — depth unit not recognised; defaulted to meters
DEPTH_TRANSFORM_UNAVAILABLE  — TVD/TVDSS display requested but no deviation survey
```

**QC summary JSON format:**

```json
{
  "flags": ["VARIABLE_SAMPLING", "CURVE_BELOW_TD"],
  "messages": [
    "Variable sampling: min step 0.18 m, median 0.20 m, max 1.40 m.",
    "Curve max depth 2540.2 m exceeds well TD 2500.0 m."
  ],
  "stats": {
    "sample_count": 12044,
    "min_depth_m": 100.0,
    "max_depth_m": 2540.2,
    "median_step_m": 0.20,
    "null_fraction": 0.02
  }
}
```

**Import API changes (backward-compatible new optional fields):**

- `ImportLasRequest`, `ImportLogsCsvRequest`: add `trusted_depth_reference: Literal['MD', 'TVD', 'TVDSS'] = 'MD'`.
- `ImportTopsRequest`: add `trusted_depth_reference: Literal['MD', 'TVD', 'TVDSS'] = 'MD'` (tops carry their picked depth in this reference; stored as `depth_value` intent even though the column name in `FormationTopModel` is still `depth_md`).
- `ImportDeviationRequest`: already has `reference` field — rename to `trusted_depth_reference` or alias. No breaking change needed if field is also accepted under `trusted_depth_reference`.

**Importer changes:**

- LAS and logs CSV importers: after parsing, compute `sampling_kind` from depth deltas (CONSTANT if `(max_delta - min_delta) < 0.10 * median_delta`; VARIABLE otherwise; SINGLE_POINT if only one sample; UNKNOWN if detection fails). Store `nominal_step_m` as `median_delta` for CONSTANT curves, NULL otherwise.
- All importers: run QC checks after parsing and flush. Populate `qc_status` and `qc_summary` on `CurveMetadata` / `FormationTopModel`. Return aggregated `qc_warnings: list[str]` in import response.
- Tops importer: emit `TOP_BELOW_TD` per top that exceeds `well.td_md`. Currently this would raise no error — behavior is unchanged, only a flag is added.

**TVD curve display (backend, MD-origin curves only):**

- `GET /api/wells/{well_id}/curves` (full curve endpoint): add optional `?depth_basis=MD|TVD|TVDSS` (default `MD`). When `depth_basis != 'MD'` and curve `trusted_depth_reference == 'MD'` and well has an active deviation survey: convert the curve's depth array from MD to TVD/TVDSS using `deviation_transform._interpolate`. Response gains `depth_basis: str` and `native_depth_reference: str` fields. If conversion is unavailable (no survey), return native depths and add `DEPTH_TRANSFORM_UNAVAILABLE` to the response `qc_flags`.
- Curves with `trusted_depth_reference != 'MD'` are always returned in their native basis regardless of `depth_basis` request; response `depth_basis` reflects actual returned basis.
- `GET /api/wells/{well_id}/curves/lod` (LOD endpoint): depth_basis NOT added in DEPTH-001. LOD stays MD-only. When viewer is in TVD/TVDSS mode it uses the full curve endpoint instead. This is acceptable for typical well depths (< 5000 samples per curve).

**Viewer changes (frontend):**

- Import dialogs: `ImportLasDialog`, `ImportLogsCsvDialog`, `ImportTopsDialog` — add a `Depth reference` selector (MD / TVD / TVDSS, default MD). Shows a brief tooltip: "Which depth type is in the depth column of this file."
- Import result dialog: show any `qc_warnings` returned by the API. Yellow warning box listing the flag messages.
- `wellDataStore`: when `depthType` (from `viewStore`) is `'TVD'` or `'TVDSS'`, the curve fetch path calls the full `/api/wells/{id}/curves` endpoint with `?depth_basis=<depthType>` instead of the LOD endpoint. When `depthType = 'MD'`, continue using the existing LOD path.
- `CurveInventoryItem` type: add `trusted_depth_reference: string` for display in settings pane.

**Not in DEPTH-001 (deferred):**

- LOD endpoint with `depth_basis` support (performance future work; needs TVD↔MD window conversion).
- Depth transform Parquet cache (materialised pre-computed table). On-the-fly conversion via `deviation_transform` is sufficient for current scale.
- Log run grouping model (`log_run_id` FK on `CurveMetadata`). Current grouping by `data_uri` is adequate.
- Parquet column schema changes for curves (adding `depth_native`, `md`, `tvd`, `tvdss` columns). Native depth column already serves as `depth_native`; on-the-fly conversion covers the rest.
- Display of TVD/TVDSS-origin curves in MD mode (requires inverse transform, uncommon in practice).

Likely code areas:

- `app/src/subsidence/data/schema.py` — add fields to `CurveMetadata`, `FormationTopModel`; bump `SCHEMA_VERSION` to 9.
- `app/src/subsidence/data/importers/common.py` — QC helper functions (`compute_sampling_kind`, `run_curve_qc`, `run_top_qc`).
- `app/src/subsidence/data/importers/las.py`, `logs.py`, `tops.py` — call QC helpers; store `trusted_depth_reference`, `sampling_kind`, `nominal_step_m`.
- `app/src/subsidence/api/projects_imports.py` — add `trusted_depth_reference` to request models; propagate to importers; include `qc_warnings` in responses.
- `app/src/subsidence/api/wells.py` — extend `CurveInventoryItem` with `trusted_depth_reference`; add `?depth_basis` to full curve endpoint; apply TVD conversion when needed.
- `frontend/src/components/layout/ImportLasDialog.tsx` — depth reference selector.
- `frontend/src/components/layout/ImportLogsCsvDialog.tsx` — depth reference selector.
- `frontend/src/components/layout/ImportTopsDialog.tsx` — depth reference selector.
- `frontend/src/stores/wellDataStore.ts` — conditional curve fetch path based on `depthType`.
- `frontend/src/types/well.ts` — `trusted_depth_reference` on `CurveInventoryItem`.
- `app/tests/integration/test_project_api_workflows.py` — QC flag tests, TVD curve endpoint test.

Dependencies: `TOPS-002` (for `depthType` extension in viewStore).

Acceptance:

- Importing a LAS with `trusted_depth_reference = 'TVDSS'` stores `CurveMetadata.trusted_depth_reference = 'TVDSS'`; returning the curve always returns TVDSS depths regardless of `?depth_basis` request.
- Importing a tops CSV where one top exceeds `well.td_md`: import succeeds; response `qc_warnings` includes `TOP_BELOW_TD` message; `FormationTopModel.qc_status = 'WARNING'`.
- A LAS file with variable 0.18–1.40 m step: `sampling_kind = 'VARIABLE'`; `qc_summary.flags` includes `VARIABLE_SAMPLING`; import does not fail.
- `GET /api/wells/{id}/curves?depth_basis=TVD` for a MD curve with an active deviation survey: returns TVD depths; `depth_basis = 'TVD'` in response.
- `GET /api/wells/{id}/curves?depth_basis=TVD` with no deviation survey: returns native MD depths; `qc_flags` includes `DEPTH_TRANSFORM_UNAVAILABLE`.
- Switching viewer to TVD mode: curves re-fetch from full endpoint with `?depth_basis=TVD`; log tracks and formation lines align on the same TVD axis.
- All existing import and API tests pass.

Implemented: commit `ce61e29` (2026-04-26).

- Schema: SCHEMA_VERSION 8→9; `CurveMetadata` gains `trusted_depth_reference`, `sampling_kind`, `nominal_step_m`, `qc_status`, `qc_summary`; `FormationTopModel` gains `qc_status`, `qc_summary`.
- `importers/common.py`: `compute_sampling_kind`, `run_curve_qc`, `run_top_qc` helpers.
- LAS, CSV log, tops importers: `trusted_depth_reference` param; return `(result, qc_warnings)` tuple; QC metadata stored.
- Tops importer: TVD/TVDSS `depth_ref` accepted (was `NotImplementedError`).
- API: `trusted_depth_reference` on import requests; `qc_warnings` on import responses.
- `GET /wells/{id}/curves/full?depth_basis=MD|TVD|TVDSS`: on-the-fly depth conversion via `deviation_transform`.
- Frontend: `reloadCurvesForDepthBasis` in wellDataStore; depth-type toolbar buttons call it; LOD disabled in non-MD mode.
- Import dialogs: depth reference selector and QC warnings panel.

---

### ZONE-001: Zone entity and lifecycle

Problem:

- The stratigraphic interval between two consecutive formation tops is not a persistent entity. Its attributes — thickness, age span, hiatus duration — are recomputed ad hoc or not at all.
- There is no place to store user-entered lithology percentages for a zone, nor to record whether those percentages came from a log or manual input.
- Without a persistent zone entity, multi-well comparison of intervals is impossible.

Required behavior:

**New schema tables (same SCHEMA_VERSION 8 migration as TOPS-001):**

- `FormationZone`: one interval between two consecutive horizons in a TopSet. Fields: `id` (int PK autoincrement), `top_set_id` (int FK → `top_sets.id` CASCADE DELETE), `upper_horizon_id` (int FK → `top_set_horizons.id` RESTRICT), `lower_horizon_id` (int FK → `top_set_horizons.id` RESTRICT), `sort_order` (int — equals `upper_horizon.sort_order`, updated when horizons reorder). Unique constraint on `(top_set_id, upper_horizon_id)`. Zones are created and deleted exclusively by the service layer; no direct user creation.

- `ZoneWellData`: well-specific attributes for one zone. Fields: `id` (int PK autoincrement), `zone_id` (int FK → `formation_zones.id` CASCADE DELETE), `well_id` (str FK → `wells.id` CASCADE DELETE), `thickness_md` (Float nullable — recalculated from picks), `thickness_tvd` (Float nullable — recalculated from picks), `lithology_fractions` (Text nullable — JSON `{"sandstone": 0.6, "shale": 0.4}`), `lithology_source` (`String(8)`, `'manual'` | `'auto'`, default `'manual'`). Unique constraint on `(zone_id, well_id)`.

**Zone service: `app/src/subsidence/data/zone_service.py` (new file):**

- `rebuild_zones_for_top_set(session, top_set_id)`: queries all `TopSetHorizon` records for the set ordered by `sort_order`. Creates `FormationZone` records for each consecutive pair. Deletes any `FormationZone` records that no longer correspond to an adjacent horizon pair. Preserves `ZoneWellData` records whose `zone_id` still exists.
- `ensure_zone_well_data(session, top_set_id, well_id)`: ensures a `ZoneWellData` row exists for every `FormationZone` in the TopSet for this well. Called when a well is linked to a TopSet.
- `recalculate_zone_thickness(session, top_set_id, well_id)`: for each `FormationZone` of this TopSet, finds the `FormationTopModel` records for this well that carry `horizon_id` matching `upper_horizon_id` and `lower_horizon_id`. Computes `thickness_md = lower_pick.depth_md - upper_pick.depth_md` and `thickness_tvd = lower_pick.depth_tvd - upper_pick.depth_tvd` (null if either pick is missing or null). Writes to `ZoneWellData`.
- `merge_zones_on_horizon_delete(session, top_set_id, horizon_id)`: identifies the two zones that shared this horizon as lower and upper boundary respectively. Deletes both. Creates a new zone spanning the gap. For each well: creates a new `ZoneWellData` with `lithology_fractions = NULL`, `lithology_source = 'manual'` (user data is discarded on merge as documented). Recalculates thickness.
- `split_zone_on_horizon_insert(session, top_set_id, new_horizon_id)`: identifies the existing zone whose sort_order range now contains the new horizon. Deletes that zone and its `ZoneWellData`. Creates two new zones. New `ZoneWellData` records have no lithology.

**Trigger points:**

- `POST /api/top-sets/{id}/horizons` → calls `rebuild_zones_for_top_set`, `ensure_zone_well_data` for all linked wells, `recalculate_zone_thickness` for all linked wells.
- `DELETE /api/top-sets/{id}/horizons/{hid}` → calls `merge_zones_on_horizon_delete`, then `recalculate_zone_thickness`.
- `PATCH /api/top-sets/{id}/horizons/{hid}` (reorder only) → calls `rebuild_zones_for_top_set`.
- `POST /api/wells/{well_id}/apply-top-set` → calls `ensure_zone_well_data`, `recalculate_zone_thickness`.
- `PATCH /api/wells/{well_id}/formations/{formation_id}` when `depth_md` changes → calls `recalculate_zone_thickness` for the well and its active TopSet.
- `UpdateFormationDepth` command (undo stack) → same as above.

**API:**

- `GET /api/wells/{well_id}/zones` → list of zones for the well's active TopSet, ordered by sort_order. Each item: `zone_id`, `top_set_id`, `upper_horizon: {id, name, age_ma}`, `lower_horizon: {id, name, age_ma}`, `sort_order`, `thickness_md`, `thickness_tvd`, `age_span_ma` (derived: `lower_horizon.age_ma - upper_horizon.age_ma`, null if either age is null), `hiatus_ma` (derived: `lower_horizon.age_ma - upper_horizon.age_ma` if `upper_horizon.kind = 'unconformity'`, else null), `lithology_fractions`, `lithology_source`.
- `PATCH /api/wells/{well_id}/zones/{zone_id}` → update `lithology_fractions` and/or `lithology_source`. Only user-editable fields. Validates that fraction values sum to ≤ 1.0; returns 400 if not.
- Zones are also included in `GET /api/wells/inventory` under a `zones` array (same fields, for the active TopSet only).

**Behavior on pick move (TOPS-002 drag / TOPS-001 click-to-set):**

- Thickness recalculates; `lithology_fractions` and `lithology_source` are preserved.

**Behavior on horizon delete:**

- Adjacent zones merge; `lithology_fractions` reset to null; `lithology_source = 'manual'`.

**Behavior on horizon insert:**

- Containing zone splits; new zone `ZoneWellData` records have no lithology.

Likely code areas:

- `app/src/subsidence/data/schema.py` — add `FormationZone`, `ZoneWellData`.
- `app/src/subsidence/data/zone_service.py` — new module.
- `app/src/subsidence/api/top_sets.py` — zone trigger calls in horizon add/delete/reorder.
- `app/src/subsidence/api/formations.py` — zone thickness recalculation after depth change.
- `app/src/subsidence/api/wells.py` — add `zones` to inventory response; add `GET /api/wells/{id}/zones`, `PATCH /api/wells/{id}/zones/{zone_id}`.
- `frontend/src/types/well.ts` — add `FormationZone`, `ZoneWellData` types.
- `frontend/src/stores/wellDataStore.ts` — load zones, expose `updateZoneLithology` action.
- `app/tests/integration/test_project_api_workflows.py` — zone lifecycle tests.

Dependencies: `TOPS-001`.

Acceptance:

- Creating a TopSet with 4 horizons → 3 zones per linked well.
- Deleting a middle horizon → 2 zones; the middle zone's `ZoneWellData` are merged (lithology cleared).
- Dragging a pick → `thickness_md` updates; `lithology_fractions` unchanged; `lithology_source` unchanged.
- `PATCH /api/wells/{id}/zones/{zone_id}` with fractions summing to 1.1 → 400.
- A well with no active TopSet has an empty `zones` array in inventory.
- All operations are covered by integration tests.

Implemented: commit `0c70f25` (2026-04-26).

- Schema: SCHEMA_VERSION 9→10; `FormationZone` (id, top_set_id, upper_horizon_id, lower_horizon_id, sort_order) and `ZoneWellData` (zone_id, well_id, thickness_md, thickness_tvd, lithology_fractions, lithology_source) tables added.
- `zone_service.py`: `rebuild_zones_for_top_set`, `ensure_zone_well_data`, `recalculate_zone_thickness`, `merge_zones_on_horizon_delete`, `get_well_active_top_set_id`.
- `top_sets.py`: zone triggers on horizon add/delete/reorder and `set_active_top_set`.
- `formations.py`, `undo.py`: zone thickness recalculation after pick depth change (including undo/redo).
- `wells.py`: `ZoneInventoryItem` in `WellInventoryResponse`; `GET /wells/{id}/zones`; `PATCH /wells/{id}/zones/{zone_id}` with fraction sum validation.
- Frontend: `FormationZone`, `ZoneHorizonRef` types; `zones: FormationZone[]` in store; `updateZoneLithology` action.

---

### ZONE-002: Zone settings UI and manual lithology input

Problem:

- There is no UI to inspect zone attributes or enter per-zone lithology percentages.

Required behavior:

**Zone list in well settings:**

- In the well Settings pane, add a **Zones** section below Tops (or as a sibling tab). The section is hidden if the well has no active TopSet.
- Each zone row shows: upper horizon name → lower horizon name, `thickness_md` in the project depth unit, `age_span_ma` (e.g. "12.3 Ma"), and a compact lithology bar if lithology fractions are set.
- Selecting a zone opens a detail panel.

**Zone detail panel:**

- Read-only calculated fields (with grey "calculated" label):
  - Thickness (MD), thickness (TVD) if available.
  - Age span (Ma).
  - Hiatus (Ma) if the upper horizon is an unconformity.
- Lithology section:
  - If `lithology_source = 'auto'`: shows the auto-derived fractions with a "from log" badge. An "Override" button switches to manual mode.
  - If `lithology_source = 'manual'` and no fractions yet: shows an "Add lithology" button that reveals the entry form.
  - If `lithology_source = 'manual'` and fractions exist: shows an editable rows table with `{lithology_name: %}` using lithology entries from the well's active lithology set (from `DICT-003`). Each row: lithology selector (dropdown from active LithologySet), percentage input (0–100). Total shown below rows; turns red if > 100. Save button disabled while total > 100.
  - If `lithology_source = 'auto'`: "Reset to auto" button reverts to auto fractions (sets `lithology_source = 'auto'`). Only visible when `LITH-001` is implemented and the well has a discrete lithology curve.

**Multi-well zone comparison panel (optional, later):**

- Placeholder in the Data Manager for a future "Compare zones across wells" view. Not implemented in ZONE-002.

Likely code areas:

- `frontend/src/components/layout/settings/ZoneSettings.tsx` — new component.
- `frontend/src/components/layout/settings/ZoneDetailSettings.tsx` — new component.
- `frontend/src/components/layout/SettingsInspector.tsx` — register zone panel.
- `frontend/src/stores/wellDataStore.ts` — `updateZoneLithology` action.
- `frontend/src/styles/data-manager.css` — zone lithology bar style.

Dependencies: `ZONE-001`, `DICT-003`.

Acceptance:

- Zone list visible in settings for a well with an active TopSet.
- Entering lithology fractions > 100% prevents saving.
- Manually entered fractions survive a pick move (server confirms `lithology_source = 'manual'`).
- Fractions are cleared after a horizon merge (server returns null fractions; UI shows "Add lithology").

---

### ZONE-003: Auto-lithology aggregation from discrete log

Problem:

- If a well has a discrete lithology curve, zone lithology fractions should be computable automatically instead of manually.

Required behavior:

- When a well has a `CurveMetadata` record with `curve_type = 'discrete'` and `family_code = 'lithology'`, the backend can aggregate sample values over each zone's depth interval.
- Service function `aggregate_zone_lithology_from_curve(session, project_path, well, zone_well_data)`: loads the parquet for the discrete curve, selects rows where `depth_md` falls within `[upper_pick.depth_md, lower_pick.depth_md]`, counts occurrences of each integer code, maps codes to lithology codes via the `CurveMnemonicEntry` or a direct lithology-code lookup, returns `{code: fraction}` dict.
- The service writes the result to `ZoneWellData.lithology_fractions` and sets `lithology_source = 'auto'` only when `existing.lithology_source != 'manual'` (does not overwrite manual overrides).
- Triggered on: discrete curve import for a well, pick depth change, zone rebuild.
- `POST /api/wells/{well_id}/zones/recalculate-lithology` — explicit recalculation endpoint.

Likely code areas:

- `app/src/subsidence/data/zone_service.py` — add `aggregate_zone_lithology_from_curve`.
- `app/src/subsidence/api/projects_imports.py` — call after discrete curve import.
- `app/src/subsidence/api/wells.py` — add `recalculate-lithology` endpoint.

Dependencies: `ZONE-001`, `ZONE-002`, `LITH-001`.

Acceptance:

- Importing a discrete lithology curve for a well updates `lithology_fractions` and sets `lithology_source = 'auto'` for all zones.
- A zone with `lithology_source = 'manual'` is not overwritten by auto-recalculation.
- Explicit `recalculate-lithology` call refreshes auto zones without affecting manual ones.

---

### ZONE-004: Zone attributes as subsidence calculation inputs

Problem:

- The subsidence calculation engine currently receives lithology in an ad-hoc format. Zone entities (ZONE-001) should become the canonical input layer, replacing or wrapping the current per-formation lithology field.
- `LITH-003` (old item) is superseded by this item.

Required behavior:

- Backend function `build_zone_layer_inputs(session, well_id) → list[ZoneLayerInput]`: for each `ZoneWellData` of the well's active TopSet (ordered by `sort_order`):
  - `thickness_md`: from `ZoneWellData.thickness_md`.
  - `age_top_ma`, `age_base_ma`: from the zone's upper and lower horizon `age_ma`.
  - `hiatus_ma`: `lower.age_ma - upper.age_ma` if upper horizon `kind = 'unconformity'`, else 0.
  - `lithology_fractions`: from `ZoneWellData.lithology_fractions` if set; otherwise falls back to `FormationTopModel.lithology` of the upper pick (existing single-lithology field) mapped to `{code: 1.0}`; if that is also null, uses the project default lithology.
  - `compaction_params`: weighted average of `CompactionPreset` fields (density, porosity_surface, compaction_coeff) by lithology fraction, using the well's active `LithologySet`.
- The subsidence API `POST /api/wells/{well_id}/subsidence` calls `build_zone_layer_inputs` when the well has an active TopSet. Falls back to existing logic (using `FormationTopModel` records directly) if no TopSet is active.
- No breaking change to the existing calculation path for legacy wells.

Likely code areas:

- `app/src/subsidence/data/zone_service.py` — add `build_zone_layer_inputs`.
- `app/src/subsidence/api/subsidence.py` — branch on TopSet presence.
- `app/src/subsidence/data/backstrip.py` — accept `ZoneLayerInput` list.

Dependencies: `ZONE-001`, `ZONE-002`, `DICT-003`.

Acceptance:

- Subsidence calculated via zone inputs for a two-zone well reproduces the result of the legacy single-lithology path when zone lithology fractions are `{legacy_code: 1.0}`.
- Zones without lithology do not crash the calculation; they use the project default.
- Legacy wells (no TopSet) continue to calculate without modification.

---

### BSTRIP-001: Per-zone paleobathymetry and eustatic sea level correction

Problem:

- The backstrip engine currently takes a single constant `water_depth_m` for the whole well at all time steps. In reality each zone was deposited at a different water depth (paleobathymetry), and the absolute sea level shifted over geological time (eustasy).
- `FormationTopModel.water_depth_m` is already stored per pick but is not passed to the engine.
- `FormationTopModel.eroded_thickness_m` is stored but not used in decompaction; an eroded section represents missing matrix volume that must be restored before backstripping.
- There is no concept of a eustatic sea level curve in the project yet.

**Semantics of existing attributes (clarification):**

- `water_depth_m` on a pick: depth of the water column at the time this horizon was deposited. Positive = below sea level (marine); negative = above sea level (emerged, non-marine, terrestrial). Default 0 (sea surface).
- `eroded_thickness_m` on a pick: thickness of rock removed by erosion at this surface. Default 0 means a pure time gap (hiatus) with no rock loss. Values > 0 mean additional solid material existed above this surface and was eroded before the next layer was deposited; this must be added back to the decompaction calculation as a "ghost" layer.

**Required behavior — per-zone water depth:**

- `ZoneLayerInput` gains a `water_depth_m: float` field (default 0.0).
- `build_zone_layer_inputs` populates it from the upper pick's `FormationTopModel.water_depth_m`.
- The `backstrip()` engine uses `water_depth_m` per time step rather than a single constant: at each time step the column is shifted down by the water depth of the shallowest active zone (the zone currently at the depositional surface).
- Legacy `FormationInput` path: `water_depth_m` is taken from the corresponding `FormationTopModel.water_depth_m`; the existing single-constant fallback remains for wells that have never set per-pick water depths.

**Required behavior — eroded thickness:**

- `ZoneLayerInput` gains an `eroded_thickness_m: float` field (default 0.0), taken from the upper pick's `eroded_thickness_m`.
- In `backstrip()`, before computing `solid_m` for a zone, the ghost eroded section is added: `effective_base_m = current_base_m + eroded_thickness_m`. The solid matrix for the ghost layer is computed separately and included in the decompaction but is not returned as a `SubsidenceResult` (it is invisible — it was eroded).

**Required behavior — eustatic sea level curve:**

New schema table `SeaLevelCurve` (SCHEMA_VERSION → next):
- `id` (int PK autoincrement)
- `name` (String 256) — e.g. "Haq 1987", "Miller 2020"
- `source` (String 256 nullable) — reference / citation
- `is_builtin` (bool, default False)
- `created_at`, `modified_at`

New schema table `SeaLevelPoint`:
- `id` (int PK autoincrement)
- `curve_id` (int FK → `sea_level_curves.id` CASCADE DELETE)
- `age_ma` (Float) — time in Ma (older = larger)
- `sea_level_m` (Float) — meters relative to modern sea level (0); positive = sea level higher than today; negative = lower

New schema table `WellActiveSeaLevelCurve`:
- `well_id` (str FK → `wells.id` CASCADE DELETE, UNIQUE)
- `curve_id` (int FK → `sea_level_curves.id` RESTRICT)

The active sea level curve for a well (if any) is interpolated at each time step of the backstrip calculation; the resulting `sea_level_at(age_ma)` value is added to the burial depth offset alongside `water_depth_m`. Multiple curves can coexist in the project; each well independently selects one.

**Import:**

- `POST /api/sea-level-curves` — create a named curve.
- `POST /api/sea-level-curves/{id}/points` — bulk upload as `[{age_ma, sea_level_m}]` array (JSON body or CSV file).
- `GET /api/sea-level-curves` — list all curves with point count.
- `DELETE /api/sea-level-curves/{id}` — only if not referenced by any well.
- `PUT /api/wells/{well_id}/active-sea-level-curve` body `{curve_id}` or `{curve_id: null}` to clear.

**Engine change:**

- `backstrip()` receives an optional `sea_level_curve: list[tuple[float, float]] | None` (sorted by age_ma descending). At each time step, if a curve is provided, `sea_level_at(t_ma)` is computed by linear interpolation and added to the depth offset.
- Combined offset at time step t for zone i: `depth = paleo_top[i] + water_depth_at(t) + sea_level_at(t)`.

**UI — Settings panel:**

- In the well settings (`WellSettings`), a "Sea level correction" row shows the active curve name (or "None") and a dropdown/button to select a curve from the project list.
- Per-zone `water_depth_m` is editable in `ZoneDetailSettings` (numeric input, labelled "Paleobathymetry (m)", hint: negative = emerged).

Likely code areas:

- `app/src/subsidence/data/schema.py` — `SeaLevelCurve`, `SeaLevelPoint`, `WellActiveSeaLevelCurve` tables.
- `app/src/subsidence/api/sea_level.py` — new router.
- `app/src/subsidence/data/backstrip.py` — `ZoneLayerInput.water_depth_m`, `ZoneLayerInput.eroded_thickness_m`, sea level interpolation in `backstrip()`.
- `app/src/subsidence/data/zone_service.py` — pass `water_depth_m` and `eroded_thickness_m` from picks into `ZoneLayerInput`.
- `app/src/subsidence/api/subsidence.py` — fetch active sea level curve and pass to engine.
- `frontend/src/types/` — `SeaLevelCurve` type; `FormationZone` gains `water_depth_m`.
- `frontend/src/components/layout/settings/ZoneDetailSettings.tsx` — paleobathymetry input field.
- `frontend/src/components/layout/settings/WellSettings.tsx` — active sea level curve selector.

Dependencies: `ZONE-004`.

Acceptance:

- A two-zone well where both zones have `water_depth_m = 50` produces burial depths 50 m deeper than the same well with `water_depth_m = 0` at every time step.
- A zone with `water_depth_m = -20` (emerged) shifts burial paths upward by 20 m.
- Assigning a sea level curve shifts burial depths by the interpolated curve value at each time step; removing the curve restores the original depths.
- `eroded_thickness_m = 100` on a zone boundary increases the decompacted column height vs the same zone with `eroded_thickness_m = 0`.
- Legacy wells without a TopSet are unaffected by this change.

---

## 6. Lithology Curve Support

### LITH-001: Discrete log import and rendering

Problem:

- Some logs represent discrete indexes instead of continuous measurements, for example lithology/facies codes by depth.

Required behavior:

- Support curves with `curve_type = discrete`.
- A discrete curve can be assigned a palette/dictionary.
- Rendering is block-style:
  - value at the upper sample fills down to the next sample;
  - next value fills to the following sample;
  - and so on.
- Settings allow selecting/previewing the palette.

Dependencies:

- `DICT-001`
- `DICT-002`
- `DICT-003`
- `PAT-001`
- `PAT-002`
- `PAT-003`
- `PAT-004`
- `PAT-005`
- `PAT-006`
- `PAT-007`

Likely code areas:

- `app/src/subsidence/data/importers/logs_csv.py`
- `app/src/subsidence/data/importers/las.py`
- `frontend/src/renderers/lithologyRenderer.ts`
- New discrete curve renderer or extension to `DataTrack`.
- `frontend/src/components/layout/settings/CurveSettings.tsx`

Acceptance:

- Discrete curve renders as categorical blocks, not a continuous line.
- Unknown values use a visible fallback style.

### LITH-002: Percentage lithology curves and Lithology track

Problem:

- Some lithology logs store percentage composition curves, for example `LIME`, `SAND`, `SHALE`, where values sum to 100%.

Required behavior:

- Support percentage lithology curve groups.
- Curves can be collected into a `Lithology track`.
- Lithology track renders stacked/fill composition between lithology percentages.
- Lithology dictionary controls colors/patterns.

Dependencies:

- `DICT-001`
- `DICT-003`
- `PAT-006`

Likely code areas:

- `frontend/src/types/tracks.ts`
- `frontend/src/renderers/lithologyRenderer.ts`
- `frontend/src/components/logview/DataTrack.tsx`
- `frontend/src/stores/workspaceStore.ts`

Acceptance:

- Multiple percentage lithology curves can render as one composition track.
- Sum-to-100 validation or warning exists.

### LITH-003: Zone upscaling for subsidence inputs

> **Superseded by `ZONE-004`.** The zone entity, lithology aggregation, and subsidence input pipeline are specified in full detail in the `ZONE-*` series. `LITH-003` is retained only as a pointer.

Dependencies:

- `ZONE-004` (implements this)

Likely code areas:

- Backend data layer for zone aggregation.
- `app/src/subsidence/api/subsidence.py`
- `app/src/subsidence/data/backstrip.py`

Acceptance:

- Each zone has lithology percentages available for model calculations.
- Aggregated values are reproducible after project save/reopen.

---

## 7. Formation and Unconformity Settings

### TOP-001: Edit conformable/unconformity attributes in settings

Problem:

- Top settings must expose attributes needed by subsidence calculations and unconformity handling.

Required behavior:

- Settings allow changing `kind` between conformable/strat and unconformity.
- Settings expose unconformity-related attributes:
  - start/top age;
  - base age;
  - eroded thickness;
  - water depth where applicable.
- UI labels should use domain terminology consistently.

Likely code areas:

- `frontend/src/components/layout/settings/TopPickSettings.tsx`
- `app/src/subsidence/api/formations.py`
- `app/src/subsidence/data/undo.py`

Acceptance:

- Attribute edits persist and affect subsequent calculations.

---

## 8. Subsidence Chart Stratigraphy

### SUBS-001: Two-level stratigraphy in upper subsidence chart

Problem:

- Upper subsidence chart needs a two-level stratigraphy header, for example stage and system.

Required behavior:

- Add two-level stratigraphy visualization to the upper chart.
- Levels should be derived from the active strat chart where possible.

Likely code areas:

- `frontend/src/components/subsidence/SubsidenceCanvas.tsx`
- `frontend/src/renderers/subsidenceRenderer.ts`
- `frontend/src/utils/geologicalTimescale.ts`

Acceptance:

- Upper chart clearly displays two stratigraphic levels.

### SUBS-002: Stratigraphy scale in lower multi-well subsidence chart

Problem:

- Lower chart also needs stratigraphy, but it may differ from the upper chart because wells can cover different time intervals.

Required behavior:

- Add stratigraphy scale/header to the lower multi-well chart.
- Time interval should be based on the multi-well chart domain.

Likely code areas:

- `frontend/src/components/subsidence/MultiWellPanel.tsx`
- `frontend/src/renderers/subsidenceRenderer.ts`
- `frontend/src/utils/geologicalTimescale.ts`

Acceptance:

- Lower chart has its own stratigraphic scale and remains readable for multi-well data.

---

## 9. Contract Boundaries

Import Wizard is now part of this contract as `WIZ-*`.

Ownership split:

- `DICT-*` owns dictionaries, templates, curve mnemonic aliases, lithologies, lithology sets, and compaction presets.
- `UNIT-*` owns measurement dimensions, units, aliases, unit conversion rules, and engine-unit normalization.
- `WIZ-*` owns import preview, parser settings, column mapping, target-well selection, validation, execution, logging, and import tests.
- `PAT-*` owns lithology pattern palette registry, built-in/user SVG pattern storage, SVG validation, pattern previews, and renderer pattern resolution.
- `LITH-*` owns discrete/percentage lithology data behavior after import.
- `UX-*` owns viewer interactions and visual presentation.
- `SUBS-*` owns subsidence chart presentation.

Dependency rule:

- Import Wizard can read dictionary/template data, but it must not duplicate dictionary definitions.
- Lithology pattern palettes must be implemented before discrete/percentage lithology rendering depends on pattern fills.
- Lithology import behavior must not be implemented before dictionary/template, wizard, and pattern palette foundations are stable.

---

## Implemented

### DICT-001: Add Templates tab beside Settings (done)

Templates tab added next to Settings in the Data Manager. Contains Compaction Presets, Curve Mnemonics (flat read-only table), and Lithologies tree. Built-in entries are read-only; user entries can be created/edited. Commits: `8e44815`, `01817d9`.

### DICT-003: Lithology sets and compaction presets (done)

Backend: `LithologySet` / `LithologyEntry` schema, `CompactionPreset` with `id`/`origin`/`is_builtin`, seeded `Default Lithologies` and built-in presets from existing flat dictionary. API: CRUD for presets and lithology sets. Frontend: `CompactionPresetsRootSettings`, `CompactionPresetSettings`, `CompactionPresetDraftSettings`, `LithologySetSettings`, `LithologySetsRootSettings`. Built-in rows are muted/read-only; user rows are editable inline; `Make copy` and `New preset` actions work. Commits: `d5a6b82`, `5005cee`, `0b5c191`.

### DICT-002: Curve mnemonic resolver (done)

`CurveMnemonicSet` / `CurveMnemonicEntry` schema added; idempotent seeder creates `Default Mnemonics` from `curve_families.csv`. Full CRUD API (list sets, fetch set with entries, create/copy/rename/delete set, add/edit/delete entries). `TemplatesTab` navigation tree shows mnemonic sets as a subtree. `CurveMnemonicSetsRootSettings` and `CurveMnemonicSetSettings` panels in Settings. `dict_resolver.py` evaluates user mnemonic sets first (by `sort_order`, then `id`, then entry `priority` desc), built-in `Default Mnemonics` second, with measurement-unit fallback via `unit_registry` after mnemonic resolution fails. `SCHEMA_VERSION` bumped to 5. Commits: `a6f64c9`, `19630c2`.

### UNIT-001: Measurement unit dictionary and engine-unit normalization (done)

`UnitDimension` / `MeasurementUnit` / `MeasurementUnitAlias` schema added; full seeder with built-in dimensions (depth, density, fraction, slowness, resistivity, gamma_ray, caliper, compaction_coeff) and conversion factors; `unit_registry.py` service for `resolve_unit`, `get_engine_unit`, `convert_depth_values_to_meters`, `convert_curve_values_to_target`. Read-only API for dimensions and units. `MeasurementUnitsRootSettings` and `UnitDimensionSettings` panels in Settings. LAS and CSV log importers updated to use `unit_registry` for depth and curve value conversion. Deterministic unit fallback integrated into `dict_resolver.py` after mnemonic resolution. `SCHEMA_VERSION` bumped to 6. Commit: `19630c2`.

### WIZ-001: Shared import wizard shell (done)

`ImportWizardShell` component with step breadcrumb, footer actions (Cancel / Back / Next / Import), and compact validation summary. `ImportWizardTargetWellFields` for shared well-selection controls. `importWizardPresets.ts` defines data-type-specific preset objects (logsLas, logsCsv, tops, deviation). `buildImportWizardSteps` util drives step status. All three import dialogs (LAS logs, tops, deviation) routed through the shared shell. Commits: `e41f65d`, `2ceb054`.

### WIZ-002: File preview and parser detection (done)

Backend `preview.py` module adds `preview_tabular` (csv.Sniffer auto-delimiter, configurable header row, utf-8-sig/latin-1 fallback, duplicate-column and row-count warnings) and `preview_las` (lasio metadata extraction: well name, UWI, depth unit, start/stop/step/null, curve list). New `/api/import-preview/tabular` and `/api/import-preview/las` POST endpoints. Frontend `useImportPreview` hook with `AbortController` cancellation; `TabularPreviewPane` (delimiter select, header-row input, scrollable preview table); `LasPreviewPane` (well metadata rows, curve table). Step breadcrumb uses `repeat(auto-fit, ...)` to support variable step counts. Integration tests mock `fetch` and use `waitFor` to advance through the async preview step. Commit: `49617e8`.

### WIZ-003: Column mapping and required-field validation (done)

`mapping.ts` defines `FieldDefinition`, `ColumnMapping`, field sets for tops (`TOPS_FIELDS`), deviation (`DEVIATION_FIELDS`), and logs CSV (`LOGS_CSV_FIELDS`), plus `autoMap` (normalized-alias matching, deduplication), `validateTopsMapping`, `validateDeviationMapping` (requires depth + one mode pair), `validateLogsCsvMapping`, and `isMappingValid`. `MappingPane` renders a field→column select table with required/optional status badges. `buildImportWizardSteps` accepts an optional `labels` parameter; `MAPPING_STEP_LABELS` adds a Mapping step between Preview and Options for CSV dialogs. All three CSV import dialogs (tops, deviation, logs CSV) gain the 5-step flow; LAS logs keeps 4 steps. Backend: `_apply_column_map` helper in `common.py` inverts the `{canonical: file_col}` dict to rename columns before importers run; `import_tops_csv` and `import_deviation_csv` accept `column_map`; `ImportTopsRequest` and `ImportDeviationRequest` gain `column_map` field. Commit: `3a12cbc`.

### WIZ-004: Target well resolution (done)

`ImportWizardTargetWellFields` gains optional `fileWellSource`, `wellPolicy`, and `onWellPolicyChange` props. When `fileWellSource` is set, the Options step shows a radio toggle — "Use file well name" (default) vs "Override with target well" — instead of the plain dropdown. The override path exposes a target well select (`aria-label="Target well"`) pre-filled with the active well. `fileWellSource` is derived from `lasPreview.well_name` in `ImportLasDialog` (LAS source only) and from `mapping['well_name']` in `ImportTopsDialog` (when the well_name column is mapped). Submit logic passes `well_id: null, create_new_well: false` when policy is `'file'`, and the selected well id when policy is `'override'`. Deviation and logs-CSV imports have no file well name concept and retain the plain dropdown. Tests extended to verify default file policy and active-well preselection under override. Commit: `d5b2ebd`.

### WIZ-005: Data-type import presets (done)

`UNCONFORMITIES_FIELDS` added to `mapping.ts` (unc_name/depth_md/end_age_ma/start_age_ma required; well_name/color/note optional) with `validateUnconformitiesMapping`. `ImportWizardDataType` extended with `'unconformities'`. `unconformities` preset added to `importWizardPresets.ts` (`targetWellPolicy: 'required'`). New `ImportUnconformitiesDialog`: 5-step wizard, required well dropdown (no create-new or file-well-source toggle), `canSubmit` requires a selected well. "Load unconformities" button added to `topsModeActions` in `ProjectToolbar`. Backend: `import_unconformities_csv` gains `column_map` kwarg with `_apply_column_map` applied before field processing; `ImportUnconformitiesRequest` gains `column_map` field. Commit: `6746c76`.

### WIZ-006: Import execution, logging, and tests (done)

`operation_log` context manager in `observability.py` already logs start/success/failure with duration_ms, error_type, and error_message for all import endpoints. Four integration tests added to `test_project_api_workflows.py`: `test_tops_import_with_column_map` (non-standard column names remapped via `column_map`), `test_deviation_import_with_column_map` (custom column names for md/incl/azim), `test_tops_import_with_incomplete_column_map_returns_400` (missing required field after remapping → 400 with field name in detail), `test_logs_import_without_well_name_imports_to_explicit_well` (no `well_name` column, explicit `well_id` routes to the correct well). CSV and TSV delimiter detection were already covered in `test_logs_csv_import_supports_comma_and_tab_delimiters`. Commit: `eb3cc52`.

### PAT-001: Vendor and document the Equinor lithology SVG pattern source (done)

10 SVG assets vendored from `https://github.com/equinor/lithology-patterns` (MIT) into `app/src/subsidence/data/dictionaries/lithology_patterns/equinor/svg/` with `manifest.csv` recording code, display name, upstream source code, tile size, and sort order. `docs/lithology-pattern-palettes.md` documents upstream URL, license, source asset folder, local checkout path, and runtime seed snapshot path. Runtime seeding depends only on the vendored snapshot, not the upstream checkout. Commit: `cabe990`.

### PAT-002: Add lithology pattern palette schema and API (done)

`LithologyPatternPalette` and `LithologyPattern` SQLAlchemy models added to `schema.py`. `lithology_patterns.py` router provides: list palettes, fetch palette detail with patterns (including `svg_content`), create/rename/copy/delete user palette, add/edit/delete user pattern entry, import SVG from file path. Built-in palettes return 403 on mutating operations. SVG import validation rejects scripts, event handler attributes (`on*`), external network references, and files over 256 KB. `LithologySetEntry.pattern_id` FK references `LithologyPattern` with `SET NULL` on delete. `SCHEMA_VERSION` bumped. Commit: `cabe990`.

### PAT-003: Seed built-in SVG pattern palettes (done)

`dict_seeder.py` `seed_lithology_pattern_palettes` function seeds the `Equinor Lithology Patterns` palette from `manifest.csv` and SVG files in the vendored snapshot directory. Seeder is idempotent: checks by `origin='equinor'` before inserting, updates missing patterns by code without duplicating. Called from both project create and project open (self-healing). Default lithology set entries for sandstone, siltstone, shale, limestone, etc. reference the corresponding built-in pattern codes. Commit: `cabe990`.

### PAT-004: Add Templates UI for lithology pattern palettes (done)

`Pattern Palettes` subtree added to the Templates tab via `TemplatesTab.tsx` and `DataManagerTopPane.tsx`. `LithologyPatternPalettesRootSettings` lists all palettes with entry counts, create/import actions disabled for built-in. `LithologyPatternPaletteSettings` shows pattern entries with SVG preview swatches (via `LithologyPatternPreview` using CSS `mask` from inline SVG data URI), tile size, code, display name, and source origin. Built-in palettes show read-only badges; user palettes show edit/delete controls. `wellDataStore` gains `lithologyPatternPalettes` slice with load/CRUD actions. `subsidence.ts` types gain `LithologyPatternPaletteSummary` and `LithologyPatternDetail`. Commit: `b8b78a1`.

### PAT-005: Connect lithology sets to selectable pattern palette entries (done)

`LithologySetSettings.tsx` pattern field replaced with a `<select>` populated from all available pattern palettes (built-in + user). Each option shows the pattern display name and palette origin. Solid fill option (`''`) is always present. `wellDataStore` fetches and caches pattern palette summaries for the selector. Built-in lithology sets remain read-only; user sets can mix built-in and user patterns. Pattern deletion blocked by FK constraint returning 409 when a lithology entry references the pattern. Commit: `b8b78a1`.

### PAT-006: Render lithology fills from SVG-backed pattern registry (done)

`lithologyRenderer.ts` rewritten: hardcoded switch-based pattern drawing removed; `drawLithologyBlock` accepts `{ color, patternSvg?: string }` visual style; SVG patterns are converted to `CanvasPattern` via `Image` + `drawImage` pipeline with a per-context cache keyed by stable pattern code. `FormationColumn.tsx` updated to resolve pattern SVG from `wellDataStore` and pass it into the renderer. Solid fill remains the fallback when no pattern or pattern load fails. Commit: `c6a0861`.

### PAT-007: Pattern palette tests and migration coverage (done)

Backend integration tests: `test_lithology_pattern_palettes_seeded` (built-in palette present, SVG content and tile metadata correct, built-in rename blocked with 403), `test_lithology_pattern_palettes_self_heal_for_open_project` (deleted tables re-seeded on next API call), `test_lithology_pattern_palette_user_crud_and_svg_validation` (user palette create/copy, SVG file import, unsafe SVG rejected with 400, pattern deletion blocked by lithology set reference returning 409). Frontend: `DataManagerTree.integration.test.tsx` extended with pattern palette subtree expansion and selection callback tests. Commits: `cabe990`, `b8b78a1`.
