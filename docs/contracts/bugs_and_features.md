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

- `WIZ-001`: Shared import wizard shell.
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

- `PAT-001`: Vendor and document the Equinor lithology SVG pattern source.
- `PAT-002`: Add lithology pattern palette schema and API.
- `PAT-003`: Seed built-in SVG patterns.
- `PAT-004`: Add Templates UI for lithology pattern palettes.
- `PAT-005`: Connect lithology sets to selectable pattern palette entries.
- `PAT-006`: Render lithology fills from SVG-backed pattern registry.
- `PAT-007`: Pattern palette tests and migration coverage.

Exit criteria:

- Built-in pattern palettes are visible and read-only.
- User SVG pattern palettes can be imported and reused.
- Lithology set entries select pattern ids from the registry instead of free-text ids.
- Existing hardcoded canvas patterns are no longer the source of truth.
- Pattern palette behavior is covered before `LITH-001` starts.

### Phase D: Lithology and Zone Data Model

Goal:

- Add discrete and percentage lithology support after dictionaries, import wizard, and pattern palettes are stable.

Items:

- `LITH-001`: Discrete log import and rendering.
- `LITH-002`: Percentage lithology curves and Lithology track.
- `LITH-003`: Zone upscaling for subsidence inputs.

Exit criteria:

- Discrete lithology curves render as blocks.
- Percentage lithology curves can be grouped into Lithology tracks.
- Zone-level lithology attributes are available for calculations.

### Phase E: Tops, Unconformities, and Subsidence Charts

Goal:

- Improve domain presentation and calculation controls around tops/unconformities and subsidence charts.

Items:

- `TOP-001`: Edit conformable/unconformity attributes in settings.
- `UX-002`: Unconformity visual style.
- `UX-003`: Toggle top labels per pick.
- `SUBS-001`: Two-level stratigraphy in upper subsidence chart.
- `SUBS-002`: Stratigraphy scale in lower multi-well subsidence chart.
- `UX-010`: Subsidence chart labels.

Exit criteria:

- Unconformities are editable and visually distinct.
- Subsidence charts show the intended labels and stratigraphy context.

### Phase F: Independent Viewer UX Fixes

Goal:

- Improve viewer usability without changing the data model.

Items:

- `UX-001`: Break log curves across missing intervals.
- `UX-004`: Align vertical toolbar labels.
- `UX-005`: Logs overview/minimap behavior.
- `UX-006`: Track-local tooltip.
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

Problem:

- Lithology needs to be aggregated by stratigraphic zones between top and base picks for subsidence calculations.

Required behavior:

- Define a zone as the interval between adjacent formation tops.
- Calculate average/weighted lithology attributes per zone.
- For source curves, output names follow:
  - `<curve mnemonic>:<lithology>` for source curve-derived percentages.
  - `<Lithology track name>:<lithology>` for composition-track-derived percentages.
- Store results in a form usable by subsidence calculations.

Dependencies:

- `LITH-001`
- `LITH-002`

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
