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

#### BF3-006-A: Add WELLS root inside the Wells tab

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

#### BF3-006-B: Add top-level ZONES root and ZoneSet browser

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

#### BF3-006-C: Tops import must ask for target ZoneSet

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
- `frontend/src/stores/wellDataStore.ts` top-set/zone-set loading actions
- `frontend/src/components/layout/DataManagerTopPane.tsx`
- `frontend/src/components/layout/WellDataPanel.tsx`

#### BF3-006-D: Zone settings for all wells in a ZoneSet

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

#### BF3-006-E: Add Models root inside the Wells tab

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
- display toggles
- Y-axis depth range
- model-specific parameters

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
- per-model depth min/max when overridden

Persistence can initially use existing visual config plumbing if no new table is required.

#### BF3-006-G: Well color setting and default well colors

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

#### BF3-006-H: Display sea-level curve on single-well subsidence chart

Add an optional sea-level curve overlay to the top single-well subsidence chart.

Purpose:

- The user should be able to visually compare selected eustatic sea level with burial/subsidence curves for the active well.
- The overlay uses the sea-level curve selected in model/chart settings, falling back to the active well sea-level curve when no model override is set.

Required behavior:

- Single-well chart settings include a toggle: show/hide sea-level curve.
- Single-well chart settings include a sea-level curve dropdown, reusing the seeded/user `SeaLevelCurve` list.
- The plotted sea-level curve uses age on the same X axis as the subsidence chart.
- The Y representation must be explicit in the UI/legend because sea level is a signed elevation/relative level series, not burial depth.
- If using the existing depth axis, document and label the sign convention clearly.
- Preferred display: draw sea level as a secondary/right-axis overlay or a clearly styled line with legend label and units.
- When no curve is selected, the overlay is hidden and the chart behaves as it does now.
- The overlay must not change auto depth range unless the user explicitly enables "include sea level in range".

Data/API requirements:

- The frontend needs access to sea-level curve points, not only curve summaries.
- Add or extend API support to fetch one curve with points if not already available.
- Keep built-in curves read-only.

Tests:

- Backend/API: fetch selected sea-level curve with ordered points.
- Frontend: chart settings can toggle sea-level visibility and select a curve.
- Frontend: single-well chart draws a distinct sea-level overlay when enabled.

---

### BF3-007: Built-in sea-level curves in StratCharts

**Type:** Feature  
**Priority:** Medium  
**Scope:** Backend seeding + StratCharts UI

The project already has `sea_level_curves`, `sea_level_points`, and `well_active_sea_level_curves`
tables plus `/api/sea-level-curves` endpoints. Add a built-in sea-level dictionary based on:

```text
repos/sea_level/1-s2.0-S1342937X22001563-mmc1_binned_models.csv
```

CSV shape observed in the source file:

- row 1: column names
- row 2: units
- first data column: `Age` in `Ma`
- remaining numeric columns: separate sea-level curve candidates in meters

Required behavior:

- Seed one built-in `SeaLevelCurve` per usable sea-level column.
- Mark seeded curves `is_builtin=True`.
- Store source metadata pointing to the source CSV / publication supplement.
- Seed points as `(age_ma, sea_level_m)`.
- Seed idempotently on project create/open, similar to other built-in dictionaries.
- Built-in sea-level curves must be read-only/deletion-protected.
- User-created sea-level curves remain supported by the existing API.

StratCharts tab UI:

- Keep the **StratCharts** top-level Data Manager tab.
- Add a sea-level curves section/tree inside the StratCharts tab.
- Built-in curves should be visible with point counts.
- Selecting a curve opens Settings with name, source, built-in flag, point count, and optionally a compact preview/table.

Model integration:

- Model settings sea-level dropdown uses these seeded curves.
- Existing per-well sea-level selection may remain in Well settings, but model settings should be able to override/choose the curve used for model computation when applicable.

Tests:

- Backend seed test: curves are present after project create/open and point counts match the CSV.
- Backend protection test: built-in sea-level curve cannot be deleted or mutated.
- API test: `/api/sea-level-curves` returns built-in curves with point counts.
- Frontend test: StratCharts tab displays sea-level curves and selecting one routes to Settings.

---

### BF3-008: Documentation synchronization for active contract 3

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
