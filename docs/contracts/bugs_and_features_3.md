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

## Implementation order

1. BF3-008 - synchronize navigation docs after this contract is accepted.
2. BF3-006-A - add WELLS root without changing backend behavior.
3. BF3-006-B/D - add ZONES root and ZoneSet settings using existing TopSet/ZoneWellData APIs where possible.
4. BF3-006-C - extend tops import to assign imported tops to an existing/new ZoneSet.
5. BF3-006-G - add persisted well colors before model/multi-well chart styling depends on them.
6. BF3-007 - seed built-in sea-level curves and expose them in StratCharts.
7. BF3-006-E/F - add Models root, model settings, chart display rules, and persisted model config.
8. BF3-006-H - add optional sea-level curve overlay to the single-well subsidence chart.

---

## Notes

- `bugs_and_features.md` and `bugs_and_features_2.md` are in `docs/contracts/implemented/`.
- This file lives in `docs/contracts/` until all items are complete, then moves to `implemented/`.
- Do not remove or rename the current top-level Data Manager tabs as part of BF3-006.
