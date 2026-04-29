# Bugs and Features Contract 3

**Status:** Active backlog contract  
**Created:** 2026-04-29  
**Scope:** Settings panel polish, subsidence chart selectability, Wells-tab restructuring, cross-well zone sets, model selection/settings, and built-in sea-level curves.

---

## Session items (2026-04-29) - implemented

### BF3-001: Tops settings - Zone labels / Marker labels (done)

**Type:** Feature  
Added `showLabels` (zone block labels, always center) and `showMarkerLabels` + `markerLabelPosition`
(Left/Center/Right) to `FormationsTrackConfig`. Per-formation position override stored in
`WellViewState.topLabelPositions`. Settings exposed in `TopsSettings` (global) and `TopPickSettings`
(per-formation with "-- global" fallback option).

---

### BF3-002: Horizontal grid toggle + grid/label color (done)

**Type:** Feature  
Added `showHorizontalGrid` and `gridColor` to `TrackConfig` (curve tracks) and
`showHorizontalGrid`, `gridColor`, `labelColor` to `DepthTrackConfig`. Renamed "Show grid" ->
"Show vertical grid" in `CurveTrackSettings`. All renderers accept optional color overrides.

---

### BF3-003: Subsidence Y-axis depth range (done)

**Type:** Feature  
Removed `tdMd` from Y-axis auto-range; chart now fits to burial data. Added `subsidenceDepthMinM`
/ `subsidenceDepthMaxM` to `viewStore`. Controls were first placed in `SubsidenceControls` and then
moved into proper chart settings by BF3-005.

---

### BF3-004: Curve "interpolation stick" in null regions (done)

**Type:** Bug fix  
`computeGapThreshold` was computed from the 2-point clipped slice, making threshold = gap * 5,
so the gap was never detected. Fix: export `computeGapThreshold`, compute it from the full
(unclipped) curve data in `DataTrack`, pass as `gapThresholdOverride` to `drawCurve`.

---

### BF3-005: Subsidence charts - selectable objects in Settings panel (done)

**Type:** Feature  
Added `{ type: 'subsidence-chart'; chartType: 'single' | 'multi' }` to `SelectedObject` union.
Chart titles in `SubsidenceCanvas` and `MultiWellPanel` are clickable and toggle selection with
`--selected` CSS highlight. `SubsidenceChartSettings.tsx` shows chart type + depth min/max inputs
(empty = auto). Registered in `SettingsInspector.tsx`. Depth min/max removed from
`SubsidenceControls.tsx`.

**Design note — chart settings vs model settings:**  
`subsidence-chart` is intentionally separate from `subsidence-model` (BF3-006-E).

- **Chart settings** (`subsidence-chart`): display/axis properties of the canvas itself —
  depth min/max, axis style. Each chart (single-well and multi-well) has its own independent
  depth range; `null` = auto-fit from that chart's data. Single-well auto-fit is computed from
  the active well's burial data; multi-well auto-fit from all loaded well results.
- **Model settings** (`subsidence-model`): computation-model properties — ZoneSet choice,
  sea-level curve choice, burial-curve/formation-fill toggles, model-specific parameters.

**Migration required in BF3-006-E/F:** the current global `subsidenceDepthMinM` /
`subsidenceDepthMaxM` in `viewStore` must be replaced by per-chart depth state. Each
`subsidence-chart` object carries its own `depthMinM: number | null` and
`depthMaxM: number | null`.

---

## Active backlog

### BF3-006: Wells tab restructuring - WELLS / ZONES / Models

**Type:** Major feature  
**Priority:** High  
**Scope:** Frontend tree restructuring plus backend/API support for ZoneSet assignment during tops import.

The Data Manager top-level tabs stay unchanged:

- **StratCharts**
- **Wells**
- **Templates**

This item restructures only the content of the existing **Wells** tab.

Target Wells tab tree:

```text
WELLS
  <well>
    Logs
    TOPS
    DEV

ZONES
  <zone set>
    <zone interval>

Models
  Total burial / total subsidence
  Decompaction
  Airy backstripping
  Stepwise backstripping through time
  Thermal subsidence fitting
```

Implementation note: the current database already has `TopSet`, `TopSetHorizon`,
`FormationZone`, `ZoneWellData`, and `WellActiveTopSet`. For this contract, the UI term
**ZoneSet** maps to the existing `TopSet` / horizon / zone structure unless implementation finds
a hard blocker that requires a schema rename. Do not rename database tables only for UI wording.

#### BF3-006-A: Add WELLS root inside the Wells tab (done)

Add a root node named **WELLS** inside the existing Wells tab. All current well nodes move under
this root.

Keep the current per-well structure under each well:

- Logs
- TOPS
- DEV

Move zone browsing out of the per-well node into the new top-level **ZONES** root. The per-well
TOPS group remains the list of loaded marker picks for that specific well.

Affected frontend areas:

- `frontend/src/components/layout/DataManagerTopPane.tsx`
- `frontend/src/components/layout/WellDataPanel.tsx`
- `frontend/src/components/layout/useDataManagerController.ts`
- `frontend/src/components/layout/dataManagerSelection.ts`
- `frontend/src/stores/workspaceStore.ts`

#### BF3-006-B: Add top-level ZONES root and ZoneSet browser (partial)

Add a top-level **ZONES** root inside the Wells tab. It lists ZoneSets built from loaded tops.

ZoneSet semantics:

- A ZoneSet is a named ordered set of marker horizons.
- Adjacent marker horizons define zones.
- Zone top/base matching across wells is by normalized marker/top name.
- Each ZoneSet can be linked to multiple wells.
- Each linked well has per-zone `ZoneWellData` such as thickness, lithology fractions, and lithology source.

Current code mapping:

- `TopSet` = ZoneSet.
- `TopSetHorizon` = marker/horizon inside a ZoneSet.
- `FormationZone` = interval between two adjacent horizons.
- `ZoneWellData` = per-well attributes for a zone.
- `WellActiveTopSet` = currently selected ZoneSet for a well.

Target browser:

```text
ZONES
  <zone set name> (<linked well count>, <zone count>)
    <upper marker> -> <lower marker>
```

Selection behavior:

- Selecting **ZONES** root opens a ZoneSet overview in Settings.
- Selecting a ZoneSet opens ZoneSet settings.
- Selecting a zone interval opens zone detail settings.
- Settings for a ZoneSet must include a well dropdown at the top. The dropdown lists only wells that exist in the selected ZoneSet.
- Changing the well dropdown changes the displayed per-well zone attributes without changing the selected ZoneSet.

ZoneSet settings must show, at minimum:

- selected well
- zone interval name (`upper marker -> lower marker`)
- upper/lower marker match state for the selected well
- MD/TVD thickness when available
- age span / hiatus when available
- water depth if applicable
- lithology fractions and source (`auto` / `manual`)

If a marker is missing in a well, the zone row remains visible and shows an unresolved/missing state
rather than disappearing silently.

#### BF3-006-C: Tops import must ask for target ZoneSet (done)

When importing tops into a well, the import wizard must ask which ZoneSet should receive the
imported marker set:

- Use selected existing ZoneSet.
- Create a new ZoneSet from the imported tops.
- Import without assigning a ZoneSet only if the user explicitly selects "None".

Default behavior:

- If a ZoneSet is currently selected in Data Manager, default to that ZoneSet.
- Otherwise default to "Create new ZoneSet" with a name derived from the file name or well name.

Backend behavior:

- Extend the tops import request with `zone_set_id` / `create_zone_set` / `zone_set_name`
  (exact field names can follow local API style).
- On create-new: create a `TopSet`, extract ordered horizons from the imported tops, rebuild zones,
  link the importing well, ensure `ZoneWellData`, recalculate thickness, and aggregate lithology if
  a lithology curve exists.
- On existing ZoneSet: link imported picks to existing horizons by normalized marker/top name,
  create ghost picks for missing horizons if needed, ensure `ZoneWellData`, recalculate thickness,
  and aggregate lithology.
- Matching top/base across wells must be by marker name, not by row order or imported depth order.
- The response should include the resolved `zone_set_id`, created/linked horizon counts, zone count,
  and QC warnings for unmatched/duplicate markers.

Affected backend areas:

- `app/src/subsidence/api/projects.py` import request/response models
- `app/src/subsidence/api/projects_imports.py` tops import endpoint
- `app/src/subsidence/api/top_sets.py` existing TopSet/active-link logic
- `app/src/subsidence/data/zone_service.py` rebuild/link/recalculate helpers

Affected frontend areas:

- `frontend/src/components/layout/ImportTopsDialog.tsx`
- `frontend/src/components/layout/DataManagerTopPane.tsx`
- `frontend/src/components/layout/WellDataPanel.tsx`

Implemented notes:

- `ImportTopsDialog` now asks whether to create a new ZoneSet, use an existing ZoneSet, or import without ZoneSet assignment.
- The wizard defaults to the selected ZoneSet when one is selected in Data Manager; otherwise it defaults to creating a new ZoneSet.
- `/api/projects/import-tops` accepts `zone_set_id`, `create_zone_set`, and `zone_set_name`.
- On create-new, the backend creates `TopSet` horizons from imported picks, rebuilds zones, activates the ZoneSet for the importing well, and recalculates per-well zone data.
- On existing ZoneSet, the backend matches imported picks to existing horizons by normalized marker name, creates ghost picks for missing horizons, recalculates thickness, and emits QC warnings for imported tops that do not match the selected ZoneSet.
- Shared TopSet activation/linking logic now lives in `app/src/subsidence/data/zone_service.py` and is reused by manual TopSet assignment and tops import.
- Covered by backend integration tests for create-new and existing ZoneSet import paths plus frontend import-wizard tests for target well and default ZoneSet payload.

#### BF3-006-D: Zone settings for all wells in a ZoneSet (partial)

The current `ZoneSettings` and `ZoneDetailSettings` are scoped to the active well. Extend this to
ZoneSet-level settings:

- Settings open from the top-level ZONES tree, not only from a well node.
- A well dropdown controls which well's zone attributes are being edited.
- Manual lithology edits update the selected well's `ZoneWellData` for the selected zone.
- Auto lithology state remains per well.
- The UI must make unresolved marker matches visible.

The implementation may reuse `ZoneSettings` / `ZoneDetailSettings`, but the selected object should
carry enough identity to avoid relying on active well only.

Proposed selected object types:

```ts
| { type: 'zone-sets-root' }
| { type: 'zone-set'; zoneSetId: number; wellId?: string }
| { type: 'zone'; zoneSetId: number; zoneId: number; wellId?: string }
```

The exact union can differ if it better matches the code, but the selected object must distinguish:

- ZoneSet identity
- zone interval identity
- chosen well context

#### BF3-006-E: Add Models root inside the Wells tab (partial)

Add a top-level **Models** root inside the existing Wells tab. It lists the five computation models:

| # | Computation model | Initial chart target | Planned SelectedObject type |
|---|---|---|---|
| 1 | Total burial / total subsidence | top single-well chart + bottom multi-well chart | `subsidence-model` `total` |
| 2 | Decompaction | top single-well chart + bottom multi-well chart | `subsidence-model` `decompaction` |
| 3 | Airy backstripping | top single-well chart + bottom multi-well chart | `subsidence-model` `airy` |
| 4 | Stepwise backstripping through time | top single-well chart + bottom multi-well chart | `subsidence-model` `stepwise` |
| 5 | Thermal subsidence fitting | top single-well chart + bottom multi-well chart | `subsidence-model` `thermal` |

Important: **Multi-well comparison is a display mode, not a sixth computation model.**

Chart display rules:

- The top single-well chart shows only the selected model for the active well.
- The bottom multi-well chart can show multiple selected/available models.
- In the bottom chart, well identity is encoded by color.
- In the bottom chart, model identity is encoded by line style.
- Legends must explain both color (well) and line style (model).

Model settings must include, when applicable:

- selected ZoneSet dropdown
- selected sea-level curve dropdown
- display toggles (burial curves, formation fills)
- model-specific parameters

**Note:** Y-axis depth range is a chart setting, not a model setting. It lives in
`SubsidenceChartSettings` (per-chart, per `subsidence-chart` object) and is not duplicated in
model settings.

Initial implementation may render only already-computable outputs and show planned/disabled states
for models whose engine is not implemented yet, but the tree and settings contract should already
reflect the five-model structure.

#### BF3-006-F: Persist model display/config choices

Model settings should be represented as project/session visual configuration, not hard-coded component state.

Persist at least:

- selected model for single-well chart
- visible models for multi-well chart
- per-model ZoneSet choice
- per-model sea-level curve choice
- per-chart depth min/max (single-well chart and multi-well chart independently; replaces global
  `subsidenceDepthMinM` / `subsidenceDepthMaxM` in `viewStore`)

Persistence can initially use existing visual config plumbing if no new table is required.

#### BF3-006-G: Well color setting and default well colors (done)

Add a user-editable well color in Well settings.

Purpose:

- The same well color is used consistently in Data Manager, single-well context indicators, and multi-well/model charts.
- In bottom multi-well charts, well identity is encoded by this well color while model identity is encoded by line style.

Required behavior:

- Every well has a `color_hex` value.
- New wells get a default color automatically.
- The default color should be random or pseudo-random from a professional categorical palette, with low collision risk inside one project.
- The generated color must persist after project save/reopen.
- Users can edit the color from `WellSettings`.
- Existing projects without stored well colors get colors assigned lazily or through migration/backfill.

Persistence options:

- Preferred: add an explicit nullable `color_hex` column to `wells` and backfill missing values.
- Acceptable fallback: persist in existing well-level visual config only if backend/API responses expose it consistently and save/reopen tests cover it.

Affected areas:

- `app/src/subsidence/data/schema.py`
- `app/src/subsidence/data/engine.py` migration/backfill path
- `app/src/subsidence/api/wells.py` response and patch models
- `frontend/src/types/well.ts`
- `frontend/src/components/layout/settings/WellSettings.tsx`
- multi-well chart color selection in `MultiWellPanel.tsx`

Tests:

- Backend: new well receives `color_hex`; existing project without color backfills a valid color.
- Backend: patching well color persists across save/reopen.
- Frontend: Well settings displays and updates the color.
- Frontend: multi-well chart uses stored well colors instead of index-only palette colors.

Implemented notes:

- Added nullable `wells.color_hex` with schema version 13 migration and backfill for missing colors.
- New wells receive a persisted pseudo-random color from a categorical palette through `create_empty_well`.
- Well list, inventory, detail, create, and patch API responses expose `color_hex`.
- `WellSettings` exposes a color picker plus hex text field; Save Well sends `color_hex`.
- The Wells tree shows a well color swatch, and `MultiWellPanel` uses stored well colors with the old palette only as fallback.
- Covered by backend lifecycle/backfill/patch persistence test plus frontend build and Data Manager / well-switching integration tests.

#### BF3-006-H: Display sea-level curve on single-well subsidence chart (done)

Add an optional sea-level curve overlay to the top single-well subsidence chart.

Purpose:

- The user should be able to visually compare selected eustatic sea level with burial/subsidence curves for the active well.
- The overlay uses the sea-level curve selected in model/chart settings, falling back to the active well sea-level curve when no model override is set.

Required behavior:

- Single-well chart settings include a toggle: show/hide sea-level curve.
- Single-well chart settings show the resolved sea-level curve, reusing the seeded/user `SeaLevelCurve` list.
- Per-model sea-level curve selection remains in Model settings; the chart overlay resolves the active model override first, then falls back to the active well sea-level curve.
- The plotted sea-level curve uses age on the same X axis as the subsidence chart.
- The Y representation must be explicit in the UI/legend because sea level is a signed elevation/relative level series, not burial depth.
- Draw sea level as a secondary/right-axis overlay with `Sea level (m)` label and a distinct dashed line.
- When no curve is selected, the overlay is hidden and the chart behaves as it does now.
- The overlay does not change auto depth range.

Data/API requirements:

- The frontend needs access to sea-level curve points, not only curve summaries.
- Add or extend API support to fetch one curve with points if not already available.
- Keep built-in curves read-only.

Implemented notes:

- Added persisted `subsidenceSingleShowSeaLevel` to the project visual config payload and dirty-state tracking.
- Added the single-well chart overlay toggle and resolved-curve status in `SubsidenceChartSettings`.
- The single-well subsidence canvas loads selected curve points through `/api/sea-level-curves/{id}/points`.
- The overlay uses the active model's sea-level curve override when set, otherwise the active well default curve.
- The sea-level curve is rendered on the same age X axis with an independent right-side sea-level axis and does not expand the depth range.
- The overlay follows the active subsidence model type instead of being hard-wired to the total model.

Tests:

- Backend/API: fetch selected sea-level curve with ordered points. Covered by BF3-007 API tests.
- Frontend: chart settings can toggle sea-level visibility and report the selected/resolved curve.
- Frontend: single-well chart draws a distinct sea-level overlay when enabled.
- Verified with frontend build and Data Manager / well-switching integration tests.

---

### BF3-007: Built-in sea-level curves — seeding, UI, and formation integration

**Type:** Feature  
**Priority:** Medium  
**Scope:** Backend seeding + API + StratCharts UI + WellSettings + TopPickSettings

#### Source data

4 curves from `repos/sea_level/1-s2.0-S1342937X22001563-mmc1_binned_models.csv`
(Kocsis & Scotese 2022, PALAEO3 supplement), copied to
`app/src/subsidence/data/dictionaries/sea_level_binned_models.csv`:

| Curve name | Points |
|---|---|
| Haq composite curve (binned 10 Myrs) | 53 |
| Van der Meer et al. (2017) | 53 |
| Kocsis & Scotese (2020) | 53 |
| Verard (2015) | 53 |

All points are 10 Myr bins from 0 to 520 Ma. Values in meters (relative sea level).

#### Backend

- `_seed_builtin_sea_level_curves(session, csv_path)` in `dict_seeder.py`, called from
  `seed_dictionaries()` (idempotent: upsert by name).
- `is_builtin=True` on all 4 curves; `source` = publication reference string.
- Add `GET /sea-level-curves/{curve_id}/points` endpoint returning
  `[{age_ma, sea_level_m}]` ordered by `age_ma` descending (oldest first, consistent with
  subsidence chart X axis).
- Protect built-in curves in `DELETE /sea-level-curves/{curve_id}` — return 409 if
  `is_builtin=True`.

#### Frontend — types and store

- Add `SeaLevelPoint { age_ma: number; sea_level_m: number }` to `types/well.ts`.
- Add `seaLevelCurves: SeaLevelCurve[]` to `WellDataStore` state and `emptyState`.
- Modify `loadSeaLevelCurves()` to store result in `seaLevelCurves` state (currently returns
  without storing).
- Call `loadSeaLevelCurves()` from `loadWellInventories()` (so curves are always fresh when
  wells load).
- Add `loadSeaLevelPoints(curveId: number): Promise<SeaLevelPoint[]>` method (fetch-only, no
  caching needed — only called on-demand from settings).
- Add `SelectedObject` variants: `{ type: 'sea-level-curves-root' }` and
  `{ type: 'sea-level-curve'; curveId: number }`.

#### Frontend — StratCharts tab

- Add a **Sea-level curves** section below the strat-chart list in `StratChartTab.tsx`.
- Each curve shows name + point count + built-in badge.
- User curves show a delete button (disabled if in use, blocked server-side if builtin).
- Clicking a curve selects `{ type: 'sea-level-curve'; curveId }` → opens
  `SeaLevelCurveSettings`.

#### Frontend — SeaLevelCurveSettings (new)

- Shows: name, source, built-in flag, point count.
- For user curves: rename input and delete button.
- No point editor (points are uploaded via API separately; not exposed in UI for now).

#### Frontend — WellSettings

- Add **Sea-level curve** dropdown listing all `seaLevelCurves`.
- Reads `well.active_sea_level_curve_id` (via `wellInventories`); writes via
  `setWellActiveSeaLevelCurve`.
- Include a "— none —" option (sends `curve_id: null`).

#### Frontend — TopPickSettings (sea-level reference)

- When the formation has `age_ma != null` and the well has an active sea-level curve, show
  a read-only line: **Sea level at age: X m** (linear interpolation from curve points at
  `age_ma`).
- Interpolation is purely client-side from the loaded points; no extra API call per
  formation.
- Points are loaded once when `TopPickSettings` mounts with a non-null `active_sea_level_curve_id`
  and cached in component state (no store persistence needed).
- If `age_ma` is outside the curve's range, show "— (out of range)".
- If no active sea-level curve is assigned to the well, this line is hidden.

#### Model sea-level integration

- Covered by BF3-006-H (sea-level overlay on single-well chart with per-model curve
  dropdown). BF3-007 is the prerequisite — curves must exist before BF3-006-H can reference
  them.

#### Tests

- Backend seed test: 4 curves present after project create/open; point counts = 53 each.
- Backend protection: built-in curve cannot be deleted (409).
- API: `GET /sea-level-curves/{id}/points` returns ordered points.
- Frontend: StratCharts tab shows sea-level section; selecting curve opens settings.
- Frontend: WellSettings sea-level dropdown saves and reloads correctly.
- Frontend: TopPickSettings shows interpolated value when age_ma and active curve are set.

---

### BF3-008: Documentation synchronization for active contract 3 (done)

**Type:** Documentation  
**Priority:** Low  

After BF3 planning is accepted, update navigation docs:

- `todo.md` must point to `docs/contracts/bugs_and_features_3.md`.
- `docs/documentation-index.md` must list Bugs and Features 3 as the active contract.
- Bugs and Features 2 should be listed under implemented contracts only.

---

### BF3-009: Normalize built-in dictionaries and full Equinor lithology pattern catalogue

**Type:** Feature / Architecture cleanup  
**Priority:** High  
**Scope:** Built-in dictionary layout, seeding reliability, lithology visualization catalogue,
compaction preset links, and read-only protection.

#### Problem

Built-in reference data is currently split across multiple implicit sources:

- Most dictionaries live under `app/src/subsidence/data/dictionaries/`.
- The built-in stratigraphic chart is loaded from top-level `sample_data/ics_chart2023.csv`,
  not from the common dictionary tree.
- Lithology defaults are overloaded: one CSV feeds the legacy lithology dictionary, built-in
  compaction presets, the default lithology set, and the built-in compaction model.
- The built-in Equinor lithology pattern palette currently contains only a subset of the
  available SVG patterns, while `repos/lithology-patterns/assets/svg` contains the full visual
  catalogue.
- New project creation/open must reliably seed built-in strat charts, sea-level curves,
  compaction presets, lithology sets, and lithology pattern palettes. A project with no wells
  must still show the built-in dictionaries.

#### Target dictionary layout

Move all built-in reference inputs under `app/src/subsidence/data/dictionaries/`:

- `strat_charts/ics_2023.csv`
- `sea_level/sea_level_binned_models.csv`
- `lithology/lithology_core.csv`
- `lithology_sets/default_lithologies.csv`
- `compaction/compaction_presets.csv`
- `lithology_patterns/equinor/manifest.csv`
- `lithology_patterns/equinor/svg/*.svg`
- existing mnemonic and unit dictionaries remain in the dictionary tree.

The old top-level `sample_data/ics_chart2023.csv` can remain as sample/demo data, but seeding
must use the dictionary copy.

#### Lithology model split

Separate computational lithologies from visual lithology patterns:

- **Computational lithologies**: the 9 core classes used by decompaction/backstripping:
  `sandstone`, `shale`, `limestone`, `dolomite`, `evaporite`, `coal`, `igneous`,
  `conglomerate`, `metamorphic`.
- **Compaction presets**: one built-in preset per computational lithology, loaded from
  `compaction/compaction_presets.csv` and linked by stable `source_lithology_code`.
- **Default lithology set**: 9 entries loaded from `lithology_sets/default_lithologies.csv`,
  each linked to a computational lithology and a built-in compaction preset.
- **Visual lithology patterns**: the full Equinor SVG catalogue. These are display assets and
  must not automatically become computational lithologies.

Visual patterns may optionally carry a `base_lithology_code` such as:

- Equinor sandstone variants -> `sandstone`
- Equinor shale variants -> `shale`
- Equinor limestone variants -> `limestone`

This lets a lithology log or imported categorical code choose a rich visual pattern while the
engine still maps decompaction parameters through one of the 9 computational lithologies.

#### Full Equinor palette

- Source: `repos/lithology-patterns/assets/svg`.
- Expected current full catalogue: 74 SVG files.
- Generate or maintain a manifest from `repos/lithology-patterns/patterns.md` with:
  `code`, `display_name`, `group_name`, `base_lithology_code`, `source_code`,
  `source_name`, `svg_path`, `tile_width`, `tile_height`, `sort_order`.
- Seed all SVGs into the built-in `Equinor Lithology Patterns` palette.
- Keep palette metadata:
  `origin='equinor'`, `is_builtin=True`, source URL
  `https://github.com/equinor/lithology-patterns`, license `MIT`.

#### Seeding behavior

Built-in seeding must be idempotent and must run on both project creation and project open.
After seeding a new project, these objects must be present:

- one built-in strat chart: `ICS 2023`;
- four built-in sea-level curves, each with 53 points;
- one built-in Equinor lithology pattern palette with the full SVG catalogue;
- nine built-in compaction presets;
- one built-in `Default Lithologies` set with nine entries;
- the built-in compaction model populated from the nine computational lithologies;
- built-in units and mnemonic set.

Seeder files should be split into small functions/modules by domain:

- `seed_strat_charts`
- `seed_sea_level_curves`
- `seed_lithologies`
- `seed_lithology_sets`
- `seed_lithology_patterns`
- `seed_compaction_presets`
- `seed_compaction_models`
- `seed_units`
- `seed_mnemonics`

#### Frontend loading behavior

- `App` must load sea-level curves explicitly when a project opens, not only through
  `loadWellInventories()`, so a project without wells still shows built-in sea-level curves.
- `App` must load strat charts, compaction presets, lithology dictionary, lithology sets,
  and lithology pattern palettes on project open.
- Data Manager should continue to keep top-level tabs unchanged, but built-in dictionaries
  should be visible from their existing sections:
  - StratCharts tab: strat charts and sea-level curves.
  - Templates tab: compaction presets, lithology sets, lithology pattern palettes, mnemonic
    sets, units.

#### Read-only protection

Built-in data must be read-only at API level:

- built-in sea-level curves cannot be deleted;
- built-in sea-level curve points cannot be overwritten;
- built-in strat charts cannot be deleted or edited;
- built-in lithology pattern palettes and patterns cannot be edited/deleted;
- built-in compaction presets cannot be edited/deleted;
- built-in compaction model parameters cannot be edited;
- built-in lithology sets cannot be edited directly.

User workflow must be clone/copy first, then edit the user copy.

#### Tests

- Backend project-create test: new project contains all required built-in objects.
- Backend project-open migration/seed test: old project missing built-ins gets them on open.
- Backend full Equinor test: built-in Equinor palette contains all expected SVG patterns.
- Backend read-only tests for sea-level point upload, strat chart delete, pattern palette edit,
  compaction preset edit/delete, lithology set edit.
- Frontend integration test: project with zero wells still shows sea-level curves and
  strat-chart built-ins after open.
- Frontend integration test: Templates tab shows compaction presets and full lithology pattern
  palette metadata.

#### Implemented step 1

- Added dictionary paths for `strat_charts/ics_2023.csv` and
  `sea_level/sea_level_binned_models.csv`, with fallback to legacy locations.
- Expanded the built-in Equinor lithology pattern manifest/assets to the full current
  `repos/lithology-patterns/assets/svg` catalogue: 74 SVG patterns.
- Kept legacy main pattern codes such as `sandstone`, `shale`, `limestone`, `dolomite`,
  and `conglomerate` for existing lithology dictionary compatibility; variant patterns use
  their Equinor numeric codes.
- Added API protection so built-in sea-level curve points cannot be overwritten.
- Added backend seed coverage for new projects: built-in strat chart, sea-level curves,
  computational lithologies, compaction presets, default lithology set, compaction model, and
  full Equinor palette.
- Added frontend project-open loading for sea-level curves so projects without wells still
  expose built-in sea-level dictionaries.

#### Implemented step 2

- Split the legacy overloaded lithology defaults into explicit seed files:
  - `lithology/lithology_core.csv`
  - `compaction/compaction_presets.csv`
  - `lithology_sets/default_lithologies.csv`
- Updated the seeder so computational lithologies, built-in compaction presets, and the
  built-in `Default Lithologies` set are loaded from their own files.
- Kept `lithology_defaults.csv` as a legacy fallback path for compatibility.
- Kept the current schema bridge: `LithologyDictEntry` still receives compaction values from
  `compaction_presets.csv` until the schema no longer stores compaction parameters on the
  flat lithology dictionary row.
- Added project-open self-heal coverage for missing built-in strat chart and sea-level curve
  rows.

Remaining BF3-009 work:

- Add explicit persisted metadata for visual pattern `group_name` / `base_lithology_code` if
  the UI needs to filter or map variants by computational lithology.

---

## Implementation order

1. BF3-008 - synchronize navigation docs after this contract is accepted. (done)
2. BF3-006-A - add WELLS root without changing backend behavior. (done)
3. BF3-006-B/D - add ZONES root and ZoneSet settings using existing TopSet/ZoneWellData APIs where possible. (done)
4. BF3-006-C - extend tops import to assign imported tops to an existing/new ZoneSet. (done)
5. BF3-006-G - add persisted well colors before model/multi-well chart styling depends on them. (done)
6. BF3-007 - seed built-in sea-level curves and expose them in StratCharts. (partial; revisit under BF3-009)
7. BF3-006-E/F - add Models root, model settings, chart display rules, and persisted model config. (done)
8. BF3-006-H - add optional sea-level curve overlay to the single-well subsidence chart. (done)
9. BF3-009 - normalize built-in dictionaries, full Equinor pattern catalogue, and seed reliability.

---

## Notes

- `bugs_and_features.md` and `bugs_and_features_2.md` are in `docs/contracts/implemented/`.
- This file lives in `docs/contracts/` until all items are complete, then moves to `implemented/`.
- Do not remove or rename the current top-level Data Manager tabs as part of BF3-006.
