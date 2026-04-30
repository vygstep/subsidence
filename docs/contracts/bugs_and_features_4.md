# Bugs and Features — Contract 4

## Status legend
`todo` · `partial` · `done`

---

## BF4-001: Marker lines clipped to track area (done)

**Problem**: Formation top lines in `FormationTopLine.tsx` draw an SVG `<line x1={0} x2="100%">`.
The container SVG in `InteractionOverlay.tsx` has `overflow: 'visible'`, so lines extend into
empty space to the right of the last track.

**Root cause**: `InteractionOverlay` SVG (`frontend/src/components/interaction/InteractionOverlay.tsx`)
sets `overflow: 'visible'` so that floating labels can render near SVG edges. But the actual horizontal
line is supposed to stop at the right edge of the tracks, not overflow.

**Fix**:
- Add a `<clipPath id="track-bounds">` inside the InteractionOverlay SVG that defines a rect from
  `(0, 0)` to `(100%, 100%)` — i.e., the SVG's own bounding box.
- Apply `clipPath="url(#track-bounds)"` on the `<line>` element only inside each `FormationTopLine`,
  leaving the label `<rect>` and `<text>` elements unclipped (they're already within bounds).
- Alternative simpler fix: change the outer SVG style to `overflow: 'hidden'` if labels do not
  render outside the SVG bounding box. Verify that right-position labels use
  `transform="translate(-122, 0)"` (they do) and are therefore inside the bounding box — if
  confirmed, `overflow: 'hidden'` is sufficient and no clipPath is needed.

**Affected files**:
- `frontend/src/components/interaction/InteractionOverlay.tsx` (SVG overflow)
- `frontend/src/components/interaction/FormationTopLine.tsx` (line element)

**Implemented**:
- `LogViewPanel` now computes the actual rendered track-strip width from the depth track,
  formation track, data tracks, and resize handles.
- `InteractionOverlay` receives that pixel width instead of spanning the whole flex workspace.
- Formation top lines and the edit-mode ghost line are clipped to the real track strip while labels
  and popovers can still render normally.

**Manual check**:
- Open a well with formation tops in a wide viewport; marker lines must stop at the right edge of
  the last visible track and must not continue into blank workspace.
- Switch top label positions left/center/right and verify labels remain visible.
- In edit-tops mode, activate a not-picked top and verify the ghost cursor line also stops at the
  last track edge.

---

## BF4-002: Remove object counters from data manager tree (done)

**Problem**: Every tree root node in the data manager shows a count badge next to its label
(e.g., `WELLS (3)`, `ZONES (2)`, `Models (5)`). These are visual noise the user wants removed.

**Remove `tree-node__count` spans from**:
- `WellDataPanel.tsx` line ~278: `WELLS` root — `<span className="tree-node__count">{wells.length}</span>`
- `WellDataPanel.tsx` line ~489: `ZONES` root — `<span className="tree-node__count">{zoneSets.length}</span>`
- `WellDataPanel.tsx` line ~511: each ZoneSet child — `<span className="tree-node__count">{zoneSet.zones.length}</span>`
- `WellDataPanel.tsx` `ModelsRoot` component line ~169: `<span className="tree-node__count">{MODEL_NODES.length}</span>`

**Remove `tree-node__item-meta` spans from `StratChartTab.tsx`**:
- Per-chart item: `<span className="tree-node__item-meta">{chart.unit_count} units</span>` (line ~60)
- Sea level curves root: `<span className="tree-node__item-meta">{seaLevelCurves.length}</span>` (line ~87)
- Per-curve: `<span className="tree-node__item-meta">{curve.point_count} pts</span>` (line ~105)

**Affected files**:
- `frontend/src/components/layout/WellDataPanel.tsx`
- `frontend/src/components/layout/StratChartTab.tsx`

**Implemented**:
- Removed root/child count badges from WELLS, ZONES, ZoneSet rows, and Models.
- Removed tree metadata counters from StratChart rows, Sea level curves root, and Sea level curve rows.
- Kept badges that communicate state, such as `built-in` and `planned`.

**Manual check**:
- Open Data Manager and verify WELLS, ZONES, Models, StratCharts, and Sea level curves no longer
  show numeric counters in the tree.
- Verify radio buttons, checkboxes, delete buttons, built-in badges, and planned model badges still
  behave as before.

---

## BF4-003: StratCharts tab restructure (done)

### BF4-003-A: Rename tab label globally

Current tab label in `DataManagerTopPane.tsx` line 169: `"StratCharts"`.
Rename to `"Charts"` everywhere:
- `DataManagerTopPane.tsx`: the `<button>` text and the `activeSidebarTab === 'strat-charts'` type literal
- Propagate the type `'strat-charts'` string value — keep the internal key unchanged (`'strat-charts'`)
  to avoid a cascade of store/prop refactors; only the display label changes.

### BF4-003-B: Strat Charts root node with collapsible children

Currently `StratChartTab.tsx` renders a flat list of charts. Restructure to match the WELLS/ZONES
pattern in `WellDataPanel.tsx`:

```
▶ STRAT CHARTS                   ← expandable root row (toggle triangle)
    ○ ICS 2023  [built-in]       ← radio for active selection
    ○ My custom chart            ← user chart
```

Implementation:
- Wrap the chart list in a root node styled like `tree-node--root` with a `TreeToggleButton`
  (same component as used in `WellDataPanel`) using key `'strat-charts-root'` in `DataManagerContext`.
- On click of the root label: set selected object `{ type: 'strat-charts-root' }` (for future use).
- Charts appear only when expanded; expanded by default.
- Charts still use radio buttons for active selection (no change to that logic).
- Delete button per chart stays on each chart row.

### BF4-003-C: Sea level curves as collapsible root

Currently in `StratChartTab.tsx` the "Sea level curves" section is a root label followed by an
always-visible flat list. Restructure to match the pattern used for ZoneSets (expandable):

```
▶ SEA LEVEL CURVES               ← expandable root row (toggle triangle)
    Haq 1987  [built-in]
    My curve
```

Implementation:
- Add a `TreeToggleButton` to the "Sea level curves" root row using key `'sea-level-curves-root'`
  in `DataManagerContext`.
- Show curve list only when expanded; expanded by default.
- Each curve row layout stays the same (name, built-in badge, delete button).
- Root row click: `setSelectedObject({ type: 'sea-level-curves-root' })` (already works).

**Affected files**:
- `frontend/src/components/layout/DataManagerTopPane.tsx` (tab label)
- `frontend/src/components/layout/StratChartTab.tsx` (all three sub-items)
- `frontend/src/components/layout/dataManager/DataManagerContext.tsx` (new expand keys)

**Implemented**:
- Renamed the visible sidebar tab label from `StratCharts` to `Charts`; internal tab key remains
  `strat-charts`.
- `StratChartTab` now renders `STRAT CHARTS` and `SEA LEVEL CURVES` as root nodes with expand
  toggles.
- Both roots are expanded by default and use `DataManagerContext` node IDs
  `strat-charts-root` and `sea-level-curves-root`.
- Added `strat-charts-root` to `SelectedObject` so clicking the root row can select it.
- Chart and curve row behavior is preserved: radio activation, selection, built-in badges, and
  delete buttons remain on the rows.

**Manual check**:
- Confirm the top sidebar tab now reads `Charts`, while opening it still shows strat charts and
  sea-level curves.
- Collapse/expand `STRAT CHARTS` and `SEA LEVEL CURVES`; children should hide/show independently.
- Select a chart, activate a chart radio, select a sea-level curve, and verify delete buttons/badges
  still behave as before.

---

## BF4-004: Curve settings accessible when log is disabled (done)

**Problem**: When a log curve's visibility checkbox is unchecked, the user cannot change the
curve's settings. The exact failure mode needs investigation.

**Hypothesis**: In `CurveSettings.tsx`, the `containingTrack` is found by searching
`viewState.tracks` for a track that contains the curve. When a curve is unchecked (invisible),
it may be absent from `viewState.tracks[*].curves`, making `containingTrack` null. Some settings
(e.g., lithology section) depend on `containingTrack` but the core rendering settings (color,
scale, line style) do not — so they should still work.

**Investigation step**: Check whether `onToggleCurve` in the workspace store removes the curve
from the track config when unchecking, or merely hides it. If it removes the config, the curve's
`selectedCurveConfig` passed to `CurveSettings` would lose persisted values on next select.

**Fix requirements**:
1. Curve visibility (checked/unchecked) must NOT affect the ability to view or edit settings
   in `CurveSettings.tsx`.
2. If unchecking removes the curve config from the track: stop doing that. Only hide it via a
   separate visibility flag; keep the config entry in the track.
3. `CurveSettings` must always render fully (no read-only or disabled mode based on visibility).
4. Clicking on an unchecked curve item in the tree must reliably trigger `onSelectCurve` and
   show its settings panel.

**Affected files**:
- `frontend/src/components/layout/settings/CurveSettings.tsx`
- Workspace store / `onToggleCurve` implementation (investigate first)

**Implemented**:
- Added `hiddenCurveMnemonics` to per-well visual config (`WellViewState`) as the source of truth
  for log-curve visibility.
- Curve visibility toggles no longer remove curve configs from `TrackConfig.curves`; they only add
  or remove mnemonics from `hiddenCurveMnemonics`.
- Rendering filters hidden curves before passing track configs to `DataTrack`, so invisible curves
  do not draw while their settings remain available.
- Data Manager visible-curve counts and checkboxes now derive from configured curves minus
  `hiddenCurveMnemonics`.
- Selecting a curve that has no stored config yet still shows default curve settings; the first
  settings edit creates a hidden config so user edits are not lost.

**Manual check**:
- Turn off a visible log curve in Data Manager; the curve should disappear from the track.
- Click that disabled curve row; Settings should still show Color, Min/Max, Line width, Line style,
  and Rendering.
- Change a setting while the curve is disabled, then turn it back on; the edited setting should be
  preserved.
- Use the Logs group checkbox to hide/show all curves; settings for individual curves should remain
  accessible after hiding.

---

## BF4-005: Lithology curve types — discrete vs fraction (done)

**Problem**: The "Lithology composition" section in `CurveSettings.tsx` (line 184) shows a
lithology code picker for ALL curves, including GR, RHOB, etc. This is confusing. Lithology
is only meaningful for specific curve families.

**Current storage model**:
- Curve payload values are stored in Parquet and referenced by `curve_metadata.data_uri`.
- Durable curve metadata is stored in `curve_metadata` (`curve_type`, `family_code`,
  `discrete_code_map`, etc.).
- Per-well viewer layout is stored in `visual_config` as `TrackConfig` / `CurveConfig`.
- Lithology sets are stored in `lithology_sets` and `lithology_set_entries`.
- Fraction lithology curve styling currently uses `TrackConfig.curves[*].lithology_code`, which is
  visual metadata and is saved through well-scoped visual config.

**Design decision**: durable lithology classification and code mapping must live in backend curve
metadata, not only in visual config. Visual config may control how a curve is shown, but the meaning
of a loaded lithology curve must survive save/reopen and be available to zone aggregation and future
compute code without requiring the viewer layout to be loaded.

**User requirement**: Two distinct lithology curve types:

| Type | Family code | Description | Setup |
|---|---|---|---|
| `lithology_discrete` | `lithology` | Each sample value is an integer source code (e.g., 1=sand, 2=shale). Always 100% one lithology. | Assign a lithology set and map source integer code -> lithology code in that set. |
| `lithology_fraction` | `lithology_fraction` | Each sample is a fraction (0-1 v/v) for one lithology component. Multiple fraction curves combine in a lithology track. | Current implementation — assign one lithology code per curve in visual config. |

**Backend contract**:
- Extend `curve_metadata.curve_type` allowed values from `continuous | discrete` to:
  `continuous | discrete | lithology_discrete | lithology_fraction`.
- Add nullable `curve_metadata.lithology_set_id` FK to `lithology_sets.id`.
- Reuse `curve_metadata.discrete_code_map` for `lithology_discrete`, but define stricter semantics:
  JSON object `{ "<source integer code>": "<lithology_set_entries.lithology_code>" }`.
- For generic `discrete`, `discrete_code_map` remains a display label map.
- `lithology_discrete` requires `family_code = 'lithology'`, `lithology_set_id != null`, and every
  mapped lithology code must exist in the selected lithology set.
- Migration: add `lithology_set_id` to `curve_metadata` if missing.
- Existing projects remain valid: `continuous` and `discrete` keep current behavior; no automatic
  conversion is performed.

**Implementation plan**:

### Step 1: Backend — durable curve metadata
- Update `app/src/subsidence/data/schema.py`:
  - add `CurveMetadata.lithology_set_id`;
  - document the four allowed `curve_type` values.
- Update `app/src/subsidence/data/engine.py` migration:
  - `ALTER TABLE curve_metadata ADD COLUMN lithology_set_id INTEGER REFERENCES lithology_sets(id)`.
- Update `app/src/subsidence/api/wells.py`:
  - add `lithology_set_id` to `CurveInventoryItem`, `CurveResponse`, and `CurvePatchRequest`;
  - validate `curve_type`;
  - validate `lithology_set_id`;
  - validate `discrete_code_map` as source-code -> lithology-code map when
    `curve_type === 'lithology_discrete'`.
- Update `zone_service.aggregate_zone_lithology_from_curve()`:
  - search for `CurveMetadata.curve_type == 'lithology_discrete'`;
  - use `discrete_code_map` to map source integer values to lithology codes;
  - ignore source codes that are not mapped, and report them in logs/warnings later if needed.

### Step 2: Frontend — CurveSettings conditional sections

Change `CurveSettings.tsx`:
- Remove the always-visible "Lithology composition" section header and the single lithology code
  picker that currently appears for all curves.
- Determine rendering mode from `selectedCurveConfig.curve_type`, falling back to
  `dictMatch.family_code` only for suggestions/defaults.
- **If `curve_type === 'lithology_discrete'`**:
  - Show "Lithology set" selector from `useWellDataStore().lithologySets`.
  - Show a code-mapping table for unique integer values in the curve:
    source integer value -> lithology entry from selected set.
  - Persist mapping changes through `PATCH /api/wells/{well_id}/curves/{mnemonic}` by updating
    `lithology_set_id` and `discrete_code_map`.
- **If `curve_type === 'lithology_fraction'` (or `isLithologyTrack`)**:
  - Show the existing "Lithology code" picker (assigns this fraction curve to one component).
  - Store the selected `lithology_code` in `TrackConfig.curves[*].lithology_code` as today.
- **Otherwise**: hide the lithology section entirely.

### Step 3: Rendering — discrete lithology track
- `lithologyCompositionRenderer.ts` currently handles fraction bands.
- Add a `drawLithologyDiscrete` path: for each depth interval, look up the integer source code in
  `discrete_code_map`, resolve the lithology style from the selected lithology set, and fill the
  full track width with that lithology's color/pattern (no stacking).
- In `DataTrack.tsx`, detect `style.curve_type === 'lithology_discrete'` before the generic
  `discrete` renderer and use the lithology renderer.
- If a track contains a `lithology_discrete` curve, render only the first such curve in that track
  and show a warning in settings if multiple discrete lithology curves are present.

### Step 4: Rendering mode selector
- In `CurveSettings`, add `'lithology_discrete'` as a new option in the "Rendering" dropdown
  (currently Line / Blocks). Label: "Lithology (discrete)". Add "Lithology (fraction)" option too.
- The "Blocks" mode (generic discrete blocks) remains as-is.

### Step 5: Types and tests
- Update frontend types:
  - `CurveData.curve_type`
  - `CurveInventoryItem.curve_type`
  - `TrackConfig.curves[*].curve_type`
  - add `lithology_set_id?: number | null` where curve metadata is represented.
- Add backend tests:
  - PATCH accepts valid `lithology_discrete` metadata;
  - PATCH rejects unknown lithology set and mappings to lithology codes not in the selected set;
  - zone aggregation uses `lithology_discrete` mapping.
- Add frontend tests for `CurveSettings` visibility rules:
  - no lithology section for GR/RHOB continuous curves;
  - fraction picker only for `lithology_fraction` / lithology track curves;
  - discrete mapping UI for `lithology_discrete`.

**Affected files**:
- `frontend/src/components/layout/settings/CurveSettings.tsx`
- `frontend/src/components/logview/DataTrack.tsx`
- `frontend/src/renderers/lithologyCompositionRenderer.ts`
- `frontend/src/types/tracks.ts`
- `frontend/src/types/well.ts`
- `app/src/subsidence/data/schema.py`
- `app/src/subsidence/data/engine.py`
- `app/src/subsidence/api/wells.py`
- `app/src/subsidence/data/zone_service.py`

**Implemented** (commit `85a2a82`):
- `schema.py`: `CurveMetadata.lithology_set_id` FK added; `curve_type` column widened to 24 chars with all four values documented.
- `engine.py`: `migrate_schema` adds `lithology_set_id` column on open.
- `wells.py`: `CurveInventoryItem`, `CurveResponse`, `CurvePatchRequest` include `lithology_set_id`; PATCH validates all four `curve_type` values.
- `types/tracks.ts`, `types/well.ts`: `curve_type` union extended; `lithology_set_id` added.
- `wellDataStore.ts`: `lithology_set_id` threaded through all curve loading; `patchCurveDiscreteCodeMap` action added for optimistic code-map updates.
- `CurveSettings.tsx`: Rendering dropdown has four options; continuous shows scale/color/line controls; `lithology_fraction` shows lithology code picker; `lithology_discrete` shows per-integer-code mapping table.
- `lithologyCompositionRenderer.ts`: `drawLithologyDiscrete` fills full-width blocks by resolving integer code → `discrete_code_map` → `lithologyFillStyles`.
- `DataTrack.tsx`: `lithology_discrete` curves dispatched to `drawLithologyDiscrete` before the generic discrete-blocks path.
- *Not implemented*: `zone_service.py` support for `lithology_discrete` aggregation (deferred).
- *Not implemented*: backend validation of `lithology_set_id` referential integrity on PATCH (deferred).

---

## BF4-006: Well color — swatch only, oval marker (done)

### BF4-006-A: Remove hex code text input in WellSettings

In `WellSettings.tsx` lines 62–74:

```tsx
<div className="sf-color-field">
  <input type="color" ... />
  <input type="text" value={wellInspectorDraft.color_hex} ... />  ← remove this
</div>
```

Remove the `<input type="text">` for the hex code. Keep only the `<input type="color">` swatch.
The color picker itself already shows the current color visually.

### BF4-006-B: Oval/pill well color marker in tree

In `WellDataPanel.tsx` line 324:
```tsx
<span className="tree-node__color-swatch" style={{ backgroundColor: item.color_hex }} />
```

Change `tree-node__color-swatch` to render as a horizontal pill/ellipse instead of a square.
CSS update in `data-manager.css` (or whichever file defines `.tree-node__color-swatch`):
```css
.tree-node__color-swatch {
  display: inline-block;
  width: 18px;
  height: 10px;           /* shorter height → pill shape */
  border-radius: 5px;     /* oval/pill */
  flex-shrink: 0;
}
```

**Affected files**:
- `frontend/src/components/layout/settings/WellSettings.tsx`
- `frontend/src/styles/data-manager.css` (or wherever `.tree-node__color-swatch` is defined)

**Implemented**:
- Removed the hex text input from Well settings; the native color picker remains the only visible
  well color editor.
- Changed `.tree-node__color-swatch` from a small circle into a horizontal pill marker.

**Manual check**:
- Select a well, open Well settings, and verify the Color row shows only the color swatch picker,
  not a hex text field.
- Change the color and save the well; the pill marker in the WELLS tree should update to the new
  color.

---

## BF4-007: Tops settings — dropdown arrow overlap + sea level override (todo)

### BF4-007-A: Select dropdown arrow overlaps text (done)

In `TopPickSettings.tsx`, the native `<select>` elements ("Kind" and "Marker position") suffer from
the browser arrow overlapping the selected text due to insufficient `padding-right`.

Fix via CSS: wherever `.sf-row select` or the global `select` style is defined, add:
```css
select {
  padding-right: 24px;   /* or 2rem — reserve space for the native arrow */
  text-overflow: ellipsis;
}
```

Check if this also affects other `<select>` elements elsewhere in the UI (WellSettings, ZoneSettings,
CurveSettings). Apply globally to all `<select>` within `.sf-row` or the settings panel scope.

**Affected files**:
- `frontend/src/styles/settings.css` or `frontend/src/styles/app.css` (wherever `select` is styled)

**Implemented**:
- Added scoped `.sf-row select` padding-right and text overflow handling in `data-manager.css`.
- Kept the broader `.sf-row input, .sf-row select` sizing rule unchanged.

**Manual check**:
- Open TopPick settings and verify the "Kind" and "Marker position" dropdown text no longer sits
  under the native arrow.
- Check Well/Curve/Zone settings dropdowns for any visible width regression.

### BF4-007-B: Sea level value override per formation

Currently `TopPickSettings.tsx` lines 163–168 show the sea level value as read-only:
```tsx
{activeCurveId !== null && (
  <div className="sf-row">
    <span>Sea level (m)</span>
    <span>{seaLevelAtAge.toFixed(1)}</span>
  </div>
)}
```

The value is calculated from the active curve and the formation's `age_ma`. The user wants the
ability to override this per-formation, with a reset button to return to the curve-calculated value.

**Backend**:
- Add `sea_level_m_override: float | None` field to the formation schema
  (`app/src/subsidence/data/schema.py`, `FormationTop` model and DB table).
- Schema migration: add `ALTER TABLE formations ADD COLUMN sea_level_m_override REAL` if not exists.
- PATCH endpoint for formations (`/api/wells/{well_id}/formations/{formation_id}`) already exists;
  add `sea_level_m_override` to the accepted patch fields.

**Frontend**:
- In `TopPickSettings.tsx`, change the sea level row to an editable input with a reset button:
  ```tsx
  {activeCurveId !== null && (
    <div className="sf-row">
      <span>Sea level (m)</span>
      <input
        type="number"
        step="0.1"
        value={draftSeaLevel ?? ''}
        onChange={(e) => setDraftSeaLevel(e.target.value ? Number(e.target.value) : null)}
        onBlur={() => void saveSeaLevelOverride()}
      />
      <button type="button" onClick={() => void resetSeaLevelOverride()} title="Reset to curve">↺</button>
    </div>
  )}
  ```
- The "reset" button clears `sea_level_m_override` (sets to `null`) and restores display to the
  curve-calculated value.
- `draftSeaLevel` is initialized from `selectedFormation.sea_level_m_override ?? seaLevelAtAge`.
- `FormationTop` type in `frontend/src/types/` must add `sea_level_m_override: number | null`.

**Affected files**:
- `frontend/src/styles/app.css` or `settings.css` (BF4-007-A)
- `frontend/src/components/layout/settings/TopPickSettings.tsx`
- `frontend/src/types/` (FormationTop interface)
- `app/src/subsidence/data/schema.py`
- `app/src/subsidence/data/engine.py` (migration)
- `app/src/subsidence/api/` (formation PATCH)

---

## BF4-008: Sea level curve selector — move to Models only (done)

**Problem**: The eustatic curve selector currently lives in `WellSettings.tsx`. Per user decision,
it should only appear in the Models settings panel, not in well settings.

**Context**: Items BF4-007 and BF4-008 share the same underlying data (`active_sea_level_curve_id`
on the well / inventory). The curve is still stored on the well; only the UI location changes.

**Design decision**: the Models selector edits the well-wide active curve (`well_active_sea_level_curves`
through `setWellActiveSeaLevelCurve`). It does NOT edit per-model visual config. The existing
`viewStore.subsidenceModelConfigs[*].seaLevelCurveId` path is superseded and should be removed or
ignored during this task to avoid two independent sources of truth.

### BF4-008-A: Remove from WellSettings

In `WellSettings.tsx` lines 119–135, remove the entire "Sea level correction" section:
```tsx
<div className="template-panel__section-header">Sea level correction</div>
<div className="sf-row">
  <span>Eustatic curve</span>
  <select ...>...</select>
</div>
```
Remove all associated state and handlers:
`seaLevelCurves`, `setWellActiveSeaLevelCurve`, `activeCurveId`, `isSaving`, `handleSeaLevelChange`.

### BF4-008-B: Add to ModelSettings

In `frontend/src/components/layout/settings/SubsidenceModelSettings.tsx` (the settings component
for the upper `Models` tree), add a sea level section:

```tsx
<div className="template-panel__section-header">Sea level correction</div>
<div className="sf-row">
  <span>Eustatic curve</span>
  <select value={activeCurveId ?? ''} onChange={(e) => void handleSeaLevelChange(e.target.value)}>
    <option value="">None</option>
    {seaLevelCurves.map((c) => (
      <option key={c.id} value={c.id}>{c.name}</option>
    ))}
  </select>
</div>
```

- This section appears only when model type = `'total'` (the only implemented model).
- The handler calls `setWellActiveSeaLevelCurve(activeWellId, curveId)` — same backend call,
  different UI location.
- The curve is applied well-wide (architecture does not change for now).
- Remove or ignore `config.seaLevelCurveId` in `SubsidenceModelSettings`; `ZoneSet` can remain in
  `subsidenceModelConfigs`, but sea level must not remain per-model.
- Update `SubsidenceCanvas.tsx` to resolve the sea level curve from
  `wellInventories.find(w => w.well_id === well.well_id)?.active_sea_level_curve_id` only.
- Update `viewStore.ts` / `projectStore.ts` so new visual config no longer writes
  `subsidenceModelConfigs[*].seaLevelCurveId`. Reading old visual config should not crash; old
  `seaLevelCurveId` values may be ignored.

### BF4-008-C: Add sea level display in ZoneSettings

Per user: zones must show which sea level curve is active (read-only, synchronized with the
curve set in Models). Add to `ZoneSettings.tsx`:

```tsx
<div className="sf-row">
  <span>Eustatic curve</span>
  <span>{activeCurveName ?? 'None'}</span>
</div>
```

Where `activeCurveName` is derived from `wellInventories.find(w => w.well_id === wellId)?.active_sea_level_curve_id`
and looked up in `seaLevelCurves`. This is read-only — user must go to Models to change it.

**Affected files**:
- `frontend/src/components/layout/settings/WellSettings.tsx` (remove section)
- `frontend/src/components/layout/settings/SubsidenceModelSettings.tsx` (add well-wide selector)
- `frontend/src/components/layout/settings/ZoneSettings.tsx` (add read-only display)
- `frontend/src/components/subsidence/SubsidenceCanvas.tsx` (resolve well-wide curve only)
- `frontend/src/stores/viewStore.ts` and `frontend/src/stores/projectStore.ts` (remove/ignore per-model sea level config)

**Implemented**:
- Removed the sea-level correction selector from Well settings.
- Added the eustatic curve selector to `SubsidenceModelSettings` for the implemented `total`
  model; it writes the well-wide active curve through `setWellActiveSeaLevelCurve`.
- `SubsidenceCanvas` and chart settings now resolve the sea-level curve only from the active well
  inventory.
- `SubsidenceModelConfig` now stores only `zoneSetId`; legacy visual config `seaLevelCurveId`
  values are ignored during hydration.
- `ZoneSettings` shows the active eustatic curve as a read-only well-wide value.

**Manual check**:
- Select a well: Well settings should no longer show "Sea level correction".
- Select `Models -> Total burial / total subsidence`: choose an eustatic curve and verify the
  selected curve persists as the well-wide active curve.
- Open Single Well chart settings and Zone settings; both should display the same curve selected
  from Models.
- Toggle sea-level overlay on the Single Well chart and verify it uses the model-selected well-wide
  curve.

---

## BF4-009: Models tree — computed state and active indicator (done)

**Problem**: Model nodes in `WellDataPanel.tsx` `ModelsRoot` component are plain tree-leaf items
styled only with a CSS highlight class. There is no visual indicator for:
1. Whether the model has been computed (has the necessary data to run)
2. Whether the model is the currently active (displayed) model

**Requirements**:

### Computed state (text style)
- `total` model: computed when the active well has ≥ 1 formation with `depth_md != null`.
  Show normal (non-muted) text.
- All other models (`decompaction`, `airy`, `stepwise`, `thermal`): not yet implemented.
  Show muted text + `"planned"` badge (already the case).
- If no well is active: all models show muted text.

### Active indicator
- In single-well chart mode (current): show a radio-button-style circle indicator next to computed
  models. The circle is filled when that model is the active model type
  (`viewStore.activeSubsidenceModelType`).
- The `ModelsRoot` component must read `activeSubsidenceModelType` from `viewStore`.
- CSS: add a small circle before the model label:
  ```css
  .tree-leaf__radio {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid var(--dm-fg-muted);
    flex-shrink: 0;
  }
  .tree-leaf__radio--active {
    background: var(--accent);
    border-color: var(--accent);
  }
  ```
- In multi-well mode (future): replace radio with checkbox (square). No implementation needed now.

### ModelsRoot changes
```tsx
// add to ModelsRoot:
const activeModelType = useViewStore((s) => s.activeSubsidenceModelType)
const formations = useWellDataStore((s) => s.formations)  // active well formations
const isComputed = (type: SubsidenceModelType) => type === 'total' && formations.length > 0
```

Each model leaf:
```tsx
<span className={`tree-leaf__radio${activeModelType === model.type ? ' tree-leaf__radio--active' : ''}`} />
```
Show the radio span only for computed models (hide for planned).

**Affected files**:
- `frontend/src/components/layout/WellDataPanel.tsx` (`ModelsRoot` component)
- `frontend/src/styles/data-manager.css` (new radio CSS)

**Implemented**:
- `ModelsRoot` reads active well formations and treats `total` as computed only when at least one
  picked formation has `depth_md != null`.
- Computed models show a radio-style indicator; the active model indicator is filled from
  `viewStore.activeSubsidenceModelType`.
- Planned/unimplemented models stay muted and keep the `planned` badge.
- Clicking a computed model also updates `activeSubsidenceModelType`; clicking planned models still
  opens their settings without activating them.

**Manual check**:
- With an active well that has picked tops, `Models -> Total burial / total subsidence` should show
  a filled radio indicator.
- Remove/no-load tops case should mute the total model and hide its radio indicator.
- Planned models should remain muted with `planned` badges and no radio indicator.

---

## BF4-010: Move top-management buttons to side track toolbar (todo)

**Problem**: Toolbar buttons for zoom presets (1:200, 1:500, 1:1000) and top management
(Add top, Link top, Set age, Set type, Move top) are located in
`ProjectToolbar.tsx` at the top of the application. User wants them in a vertical side panel
adjacent to the well tracks, following the pattern of `SubsidenceToolbar.tsx`.

**Decision**: Delete actions stay in the Data Manager tree (BF4-017). Do not move `Delete well`,
`Delete top`, or `Delete all tops` into the side toolbar.

### What to move
From `ProjectToolbar.tsx` lines ~495–503:
- `ZoomControl` component (1:200, 1:500, 1:1000 presets)
- `Add top`
- `Link top`
- `Set age`
- `Set type`
- `Move top`

### What stays in ProjectToolbar
File operations (Load LAS, Load tops, Load unconformities, Load deviation, Load StratChart, etc.)
and project-level actions (New project, Open project, Save project). These are not track-specific.

### New component: WellTrackSideToolbar
Create `frontend/src/components/layout/WellTrackSideToolbar.tsx`:
- Vertical layout, same CSS pattern as `SubsidenceToolbar` (`subsidence-toolbar` → new `well-toolbar`
  class, or reuse the same class if styling is identical).
- Sections:
  1. **Zoom** — three buttons: 1:200, 1:500, 1:1000 (from `ZoomControl` — reuse or inline)
  2. **Divider**
  3. **Tops** — Add top, Link top, Set age, Set type, Move top
     (same `onClick` handlers as current toolbar; extract or pass as props)
- Disabled states match existing toolbar: `disabled={!well}` for Add top, `disabled={!selectedFormation}`
  for the rest.
- Dialog state (`activeDialog`, etc.) should be lifted to the parent or shared via a store if
  currently local to `ProjectToolbar`.

### Placement
Render `WellTrackSideToolbar` to the right of the last track (or as a thin panel to the left/right
of the well track container). Confirm with user if positioning is unclear.

### Duplication check
- "Set type" dialog allows selecting `strat` vs `unconformity` — same as the "Kind" dropdown in
  `TopPickSettings.tsx`. Redundant. Keep in side toolbar (convenient when a top is selected in the
  track without opening settings), leave the dropdown in settings panel too.
- "Set age" opens a prompt dialog — not duplicated elsewhere. Keep.
- "Move top" opens a prompt dialog — redundant with depth input in `TopPickSettings.tsx`. Can remove
  from toolbar or keep for convenience; note the redundancy in code comments.

**Affected files**:
- `frontend/src/components/layout/ProjectToolbar.tsx` (remove moved buttons)
- `frontend/src/components/layout/WellTrackSideToolbar.tsx` (new file)
- Parent layout component that renders the well track area (add `WellTrackSideToolbar` to layout)

---

## BF4-011: Backend API audit — frontend coverage (todo)

**Goal**: Review all backend API endpoints and identify which ones have corresponding frontend UI
actions, which are accessible only via the backend CLI, and which may be dead code. Produce a
reference table in the contract update.

**Scope**: All `@router` route declarations in `app/src/subsidence/api/`.

**Audit method**:
1. List all routes (method + path) from each API file.
2. For each route, search `frontend/src/` for a `fetch` call or store action that calls it.
3. Mark as:
   - `ui` — reachable from a frontend user action or store effect.
   - `internal` — called by backend, tests, or app lifecycle but not directly by a visible UI button.
   - `dev-only` — useful for scripts/manual debugging but not part of current UI.
   - `unreachable` — no known caller and no clear current purpose.

**Files to audit**:
- `app/src/subsidence/api/projects.py`
- `app/src/subsidence/api/projects_config.py`
- `app/src/subsidence/api/projects_imports.py`
- `app/src/subsidence/api/projects_export.py`
- `app/src/subsidence/api/import_preview.py`
- `app/src/subsidence/api/wells.py`
- `app/src/subsidence/api/formations.py`
- `app/src/subsidence/api/sea_level.py`
- `app/src/subsidence/api/strat_chart.py`
- `app/src/subsidence/api/lithology_patterns.py`
- `app/src/subsidence/api/compaction.py` (compaction presets, mnemonic sets, lithology sets,
  measurement units, legacy compaction models)
- `app/src/subsidence/api/top_sets.py`
- `app/src/subsidence/api/subsidence.py`

**Deliverable**: Update this section with a table of all endpoints + coverage status after audit.

---

---

## BF4-012: Sea level curve — same depth scale as burial data (done)

**Problem**: On the single-well subsidence chart, the sea level line currently uses a **secondary
independent Y axis** (right side, teal, `SEA_LEVEL_AXIS_EXTRA = 70 px` of extra right padding).
This double scale is misleading. The user wants the sea level curve plotted on the **same depth
scale** as the burial depth axis.

**Current implementation** in `SubsidenceCanvas.tsx`:
- `SEA_LEVEL_AXIS_EXTRA = 70` — extra right padding when sea level is shown
- `SeaLevelAxisData.slToY` — independent linear mapping from `[minSL, maxSL]` to plot height
- `drawSeaLevelAxis()` — draws the right teal axis with its own tick marks and rotated "Sea level (m)" label
- `pad` computed with extra right padding when `showSeaLevel` is true

**Required changes** (all in `SubsidenceCanvas.tsx`):

1. **Delete** the `SEA_LEVEL_AXIS_EXTRA` constant.
2. **Delete** the `SeaLevelAxisData` interface.
3. **Delete** the `drawSeaLevelAxis()` function entirely.
4. **Simplify** sea level data in `draw`: replace the entire `slData` computation with a single
   sorted-points array:
   ```tsx
   const slPoints = showSeaLevel && seaLevelPoints.length > 0
     ? [...seaLevelPoints]
         .filter((p) => p.age_ma >= 0 && p.age_ma <= maxAge)
         .sort((a, b) => a.age_ma - b.age_ma)
     : []
   ```
5. **Remove** the dynamic `pad` computation — `pad` is always `PADDING_BASE` regardless of `showSeaLevel`.
6. **Update** `paddingRightRef.current` — always `PADDING_BASE.right` (remove the conditional).
7. **Update** `paddingRight` variable used for `GeologicalTimescale` — always `PADDING_BASE.right`.
8. **Draw sea level line** using `depthToY(pt.sea_level_m)` directly (sea level in meters maps
   naturally to the depth axis):
   ```tsx
   if (slPoints.length > 0) {
     ctx.strokeStyle = '#0891b2'
     ctx.lineWidth = 1.5
     ctx.setLineDash([4, 3])
     ctx.beginPath()
     let started = false
     for (const pt of slPoints) {
       const x = timeToX(pt.age_ma)
       const y = depthToY(pt.sea_level_m)
       if (!started) { ctx.moveTo(x, y); started = true }
       else ctx.lineTo(x, y)
     }
     ctx.stroke()
     ctx.setLineDash([])
   }
   ```
9. Remove the `drawSeaLevelAxis(ctx, slData, width, height, pad)` call.

**Note**: Sea level values (m) and burial depth (m) share units so the same `depthToY` mapping is
correct. Typical Haq-style curves span ±200 m, so the sea level line will appear near the top of
the chart — this is geologically correct and expected.

**Affected files**:
- `frontend/src/components/subsidence/SubsidenceCanvas.tsx`

**Implemented**:
- Removed the independent sea-level Y axis, extra right padding, and `slToY` mapping.
- Single-well sea level overlay now uses the same `depthToY(pt.sea_level_m)` mapping as burial
  curves.
- Crosshair bounds and geological timescale padding now stay on the base chart padding regardless
  of sea-level visibility.

**Manual check**:
- In Single Well subsidence chart, enable the sea-level overlay and verify the right teal sea-level
  axis is gone.
- Verify the cyan dashed sea-level line appears near the top of the depth chart and is clipped by
  the normal plot area.
- Toggle the overlay on/off and verify the geological timescale and crosshair width do not shift.

---

## BF4-013: Use marker names (not zone names) on burial chart labels (done)

**Problem**: In `SubsidenceCanvas.tsx` `drawFormationLabels()` (line 129), labels are drawn as
`curve.formation_name`. When subsidence is computed using zone intervals, the name can be a
combined string like `"Permian -> Jurassic"` — too long to display legibly as a chart annotation.
The user wants the **upper marker name** only (e.g., just `"Permian"`).

**Where the name comes from** (backend):
- `backstrip.py` line 196: `formation_name=f.name` where `f` is `FormationInput` or `ZoneLayerInput`.
- For `FormationInput`, `f.name` is a formation top pick name (already short).
- For `ZoneLayerInput`, `f.name` could be a zone description combining two horizon names.

**Fix** in `drawFormationLabels()` in `SubsidenceCanvas.tsx`:
```tsx
function displayLabel(fullName: string): string {
  const arrowIdx = fullName.indexOf(' -> ')
  const name = arrowIdx !== -1 ? fullName.slice(0, arrowIdx) : fullName
  return name.length > 18 ? name.slice(0, 17) + '…' : name
}
```
Use `displayLabel(curve.formation_name)` instead of `curve.formation_name` at line 129.

This:
- Strips everything after ` -> ` (keeps only the upper/older horizon name).
- Truncates names longer than 18 characters with `…` as a safety net.

**Affected files**:
- `frontend/src/components/subsidence/SubsidenceCanvas.tsx` (`drawFormationLabels` function)

**Implemented**:
- Single-well burial chart labels now display only the name before ` -> `.
- Labels longer than 18 characters are truncated with an ellipsis.

**Manual check**:
- Compute/show a chart from zone-based intervals and verify labels display the upper marker name
  only, e.g. `Permian` instead of `Permian -> Jurassic`.
- Verify long marker names are shortened and do not run deep into the right margin.

---

## BF4-014: Horizontal km gridlines on single-well subsidence chart (done)

**Requirement**: Draw very thin horizontal gridlines behind the chart content at exact whole-km
depth values: 0 km, 1 km, 2 km, 3 km … (i.e., 0 m, 1000 m, 2000 m, 3000 m, …).

**Appearance**:
- `lineWidth = 0.5`
- `strokeStyle = 'rgba(148, 163, 184, 0.3)'` — very faint slate blue (barely visible background)
- Full plot width (from left edge `pad.left` to right edge `pad.left + plotW`)
- No labels (depth axis tick marks already annotate the same depths)

**Placement in draw order**: inside the `ctx.save() / ctx.clip()` block, **before**
`drawFormationFills` and `drawBurialCurves`, so gridlines appear behind all data.

**Implementation** — add a `drawKmGridlines` function:
```tsx
function drawKmGridlines(
  ctx: CanvasRenderingContext2D,
  plotLeft: number,
  plotWidth: number,
  minDepthM: number,
  maxDepthM: number,
  depthToY: (d: number) => number,
) {
  ctx.save()
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)'
  ctx.lineWidth = 0.5
  const firstKm = Math.ceil(minDepthM / 1000) * 1000
  for (let d = firstKm; d <= maxDepthM; d += 1000) {
    const y = depthToY(d)
    ctx.beginPath()
    ctx.moveTo(plotLeft, y)
    ctx.lineTo(plotLeft + plotWidth, y)
    ctx.stroke()
  }
  ctx.restore()
}
```

Call it in the `draw` callback inside the clip region:
```tsx
ctx.save()
ctx.beginPath()
ctx.rect(pad.left, pad.top, plotW, plotH)
ctx.clip()

drawKmGridlines(ctx, pad.left, plotW, effectiveMinDepthM, effectiveMaxDepthM, depthToY)  // ← new, first
if (showFormationFills) drawFormationFills(...)
if (showBurialCurves)   drawBurialCurves(...)
// ... sea level line ...

ctx.restore()
```

**Affected files**:
- `frontend/src/components/subsidence/SubsidenceCanvas.tsx`

**Implemented**:
- Added `drawKmGridlines()` for exact whole-km horizontal gridlines.
- Gridlines are drawn inside the plot clip before formation fills, burial curves, and sea-level
  overlay.

**Manual check**:
- Open Single Well subsidence chart and verify faint horizontal lines appear at 0, 1, 2, 3 km, etc.
- Verify the lines stay behind formation fills, burial curves, and sea-level overlay.

---

## BF4-018: Unified 2-step import — inline column mapping in all tabular dialogs (todo)

**Context**: BF4-016 collapses the LAS and CSV-logs dialogs to 2 steps. This item applies the same
pattern to the remaining tabular import dialogs (Tops, Deviation, Unconformities) and introduces a
new **inline column-mapping** UI: instead of a separate Mapping step, field-assignment dropdowns
appear directly above each column in the preview table.

After BF4-016 + BF4-018, **every** import dialog is 2-step (File → Preview) with a single "Load"
button. `MappingPane.tsx` and `MAPPING_STEP_LABELS` become unused and can be deleted.

`LoadStratChartDialog.tsx` is already single-step (no wizard) — no changes needed.

---

### BF4-018-A: Inline column mapping in `TabularPreviewPane`

Add three optional props to `TabularPreviewPane` in
`frontend/src/components/layout/importWizard/TabularPreviewPane.tsx`:

```tsx
interface TabularPreviewPaneProps {
  // ... existing props unchanged ...
  fields?: FieldDefinition[]
  mapping?: ColumnMapping
  onMappingChange?: (fieldId: string, colName: string | null) => void
}
```

When `fields`, `mapping`, and `onMappingChange` are all provided, render an extra `<tr>` as the
**first row of `<thead>`** containing a `<select>` per column:

```tsx
{fields && mapping && onMappingChange && preview && (
  <tr className="import-preview__mapping-row">
    {preview.columns.map((col, colIdx) => {
      const assignedFieldId = Object.entries(mapping).find(([, v]) => v === col)?.[0] ?? ''
      return (
        <th key={colIdx} className="import-preview__mapping-cell">
          <select
            value={assignedFieldId}
            onChange={(e) => {
              const nextFieldId = e.target.value
              // Un-assign previous field pointing to this column
              const prevFieldId = Object.entries(mapping).find(([, v]) => v === col)?.[0]
              if (prevFieldId) onMappingChange(prevFieldId, null)
              // Assign new field
              if (nextFieldId) onMappingChange(nextFieldId, col)
            }}
          >
            <option value="">—</option>
            {fields.map((f) => (
              <option
                key={f.id}
                value={f.id}
                disabled={mapping[f.id] !== null && mapping[f.id] !== col}
              >
                {f.label}{f.required ? ' *' : ''}
              </option>
            ))}
          </select>
        </th>
      )
    })}
  </tr>
)}
```

The second `<tr>` in `<thead>` is the existing column-name row (unchanged).

**Required-field indicator**: below the table, show an inline warning for any required field not yet
mapped (reuse `.project-dialog__validation`):
```tsx
{fields && mapping && (() => {
  const missing = fields.filter(f => f.required && !mapping[f.id])
  return missing.length > 0 ? (
    <div className="project-dialog__validation" aria-label="Mapping validation">
      {missing.map(f => <span key={f.id}>Required: {f.label}</span>)}
    </div>
  ) : null
})()}
```

**CSS** — add to the import preview stylesheet:
```css
.import-preview__mapping-row th {
  padding: 2px 4px;
  vertical-align: bottom;
}
.import-preview__mapping-row select {
  width: 100%;
  font-size: 11px;
}
```

**Affected file**: `frontend/src/components/layout/importWizard/TabularPreviewPane.tsx`

---

### BF4-018-B: Tops dialog — 2-step with inline mapping

In `ImportTopsDialog.tsx`:
- Change step labels to `['File', 'Preview']` (remove `MAPPING_STEP_LABELS`)
- Remove: `{currentStepIndex === 2 ? <MappingPane ...> : null}` (Mapping step)
- Remove: `{currentStepIndex === 3 ? ...options... : null}` (Options step)
- Remove: `{currentStepIndex === 4 ? ...summary... : null}` (Import/Summary step)

New step 1 renders everything inline:
```tsx
{currentStepIndex === 1 ? (
  <>
    <TabularPreviewPane
      isLoading={previewLoading}
      error={previewError}
      preview={tabularPreview}
      settings={parserSettings}
      onSettingsChange={updateParserSettings}
      fields={TOPS_FIELDS}
      mapping={mapping}
      onMappingChange={(fieldId, col) => setMapping((prev) => ({ ...prev, [fieldId]: col }))}
    />

    {!previewLoading && tabularPreview && (
      <div className="import-wizard__options">
        <ImportWizardTargetWellFields
          wells={wells}
          wellId={wellId}
          createNewWell={createNewWell}
          emptyLabel="Create or match by file well_name"
          fileWellSource={fileWellSource}
          wellPolicy={wellPolicy}
          onWellIdChange={setWellId}
          onCreateNewWellChange={setCreateNewWell}
          onWellPolicyChange={setWellPolicy}
        />
        <label className="project-dialog__field">
          <span>Depth reference</span>
          <select value={depthRef} onChange={(e) => setDepthRef(e.target.value as 'MD' | 'TVD' | 'TVDSS')}>
            <option value="MD">MD</option>
            <option value="TVD">TVD</option>
            <option value="TVDSS">TVDSS</option>
          </select>
        </label>
        <label className="project-dialog__field">
          <span>Depth unit in file</span>
          <select value={depthUnit} onChange={(e) => setDepthUnit(e.target.value as 'm' | 'ft' | 'km')}>
            <option value="m">m — metres</option>
            <option value="ft">ft — feet</option>
            <option value="km">km — kilometres</option>
          </select>
        </label>
        {/* ZoneSet policy section — unchanged, moved here */}
        <div className="project-dialog__field">
          <span>ZoneSet</span>
          ...existing ZoneSet radio group...
        </div>
      </div>
    )}
  </>
) : null}
```

**New state**: `const [depthUnit, setDepthUnit] = useState<'m' | 'ft'>('m')`

**Submit payload**: add `depth_unit: depthUnit` to the JSON body.

`canSubmit`: `sourceIsValid && mappingOk && zoneSetOk`
(same condition as before — `mappingOk` derives from `validateTopsMapping(mapping)`)

---

### BF4-018-C: Deviation dialog — 2-step with inline mapping

In `ImportDeviationDialog.tsx`:
- Change step labels to `['File', 'Preview']`
- Remove Mapping, Options, Summary steps
- Render all inline in step 1:

```tsx
<TabularPreviewPane
  ...
  fields={DEVIATION_FIELDS}
  mapping={mapping}
  onMappingChange={...}
/>
{!previewLoading && tabularPreview && (
  <div className="import-wizard__options">
    <ImportWizardTargetWellFields ... />
    <label className="project-dialog__field">
      <span>Depth unit in file</span>
      <select value={depthUnit} ...>
        <option value="m">m — metres</option>
        <option value="ft">ft — feet</option>
        <option value="km">km — kilometres</option>
      </select>
    </label>
  </div>
)}
```

Note: deviation has no `depth_ref` selector — all depth types (MD, TVD, TVDSS) are columns in the
file and mapped individually via inline mapping.

**New state**: `const [depthUnit, setDepthUnit] = useState<'m' | 'ft' | 'km'>('m')`
**Submit payload**: add `depth_unit: depthUnit` — stored as metadata, no conversion
`canSubmit`: `sourceIsValid && mappingOk`

---

### BF4-018-D: Unconformities dialog — 2-step with inline mapping

In `ImportUnconformitiesDialog.tsx`:
- Same pattern as B/C above
- Fields: `UNCONFORMITIES_FIELDS`
- Options: target well (required) + depth unit
- No depth reference dropdown (unconformities have a fixed depth field)

`canSubmit`: `sourceIsValid && mappingOk && !!wellId`

---

### BF4-018-E: Backend — store `depth_unit` as metadata, no conversion on import

**Important**: data is stored exactly as loaded — **no unit conversion during import**.
The `depth_unit` field is metadata that tells the engine what unit the stored values are in,
so it can convert correctly at compute time (e.g., ft → m before backstripping).

Add `depth_unit: 'm' | 'ft' | 'km'` (default `'m'`) to the import endpoints:
- `POST /api/projects/import-tops`
- `POST /api/projects/import-deviation`
- `POST /api/projects/import-unconformities`
- `POST /api/projects/import-logs-csv` (also affects BF4-016-D)

Backend behaviour: store depth values verbatim as received. Persist `depth_unit` in the
database alongside the formation/deviation/curve records so the compute engine can read it
and apply the appropriate conversion factor when needed.

**Schema changes** (investigate before implementing):
- Formation top: add `depth_unit` column (default `'m'`), persisted per-well or per-import
- Deviation survey: add `depth_unit` column
- Log curves: `depth_unit` may already be implied by the LAS `depth_unit` header field
  (`lasPreview.depth_unit`) — verify whether it is stored; if not, add it

**Backend files to check**:
- `app/src/subsidence/api/wells.py` — import endpoints
- `app/src/subsidence/data/schema.py` — add `depth_unit` columns
- Compute engine — wherever depth values are read back for backstripping/subsidence calculation

---

### BF4-018-F: Remove `MappingPane` and `MAPPING_STEP_LABELS` after migration

Once BF4-016 and BF4-018 are all implemented:
- Delete `frontend/src/components/layout/importWizard/MappingPane.tsx`
- Remove `MAPPING_STEP_LABELS` from `importWizardUtils.ts`
- Remove `MappingPane` from `index.ts` exports
- Remove `MappingPane` imports from all dialog files

Do this last, as a cleanup step, to avoid blocking the other items.

---

**Affected files**:
- `frontend/src/components/layout/importWizard/TabularPreviewPane.tsx` (BF4-018-A)
- `frontend/src/components/layout/ImportTopsDialog.tsx` (BF4-018-B)
- `frontend/src/components/layout/ImportDeviationDialog.tsx` (BF4-018-C)
- `frontend/src/components/layout/ImportUnconformitiesDialog.tsx` (BF4-018-D)
- `app/src/subsidence/api/wells.py` + import handlers (BF4-018-E)
- `frontend/src/components/layout/importWizard/MappingPane.tsx` — delete (BF4-018-F)
- `frontend/src/components/layout/importWizard/importWizardUtils.ts` — remove constant (BF4-018-F)

**Complexity**: M — three dialogs + shared component change + backend depth_unit field

---

## BF4-017: Delete well / delete top / delete all tops — ✕ buttons in data manager tree (done)

**Problem**: "Delete well", "Delete top", and "Delete all tops" are currently only accessible via
the main project toolbar. The toolbar is already crowded; the data manager tree is the natural
home for per-item delete actions, following the pattern already used for Strat Charts and Sea
Level Curves (red `✕` ghost buttons).

**Goal**: Add red `✕` buttons to three places in the data manager WELLS tree:
1. The well root row → **Delete well**
2. The TOPS group row → **Delete all tops** (only visible when there are tops)
3. Each individual formation row → **Delete top**

Then remove those three buttons from `ProjectToolbar.tsx`.

---

### Existing pattern (reference)

`StratChartTab.tsx` already uses:
```tsx
<button
  type="button"
  className="dm-action dm-action--ghost dm-action--danger"
  title="Delete this chart"
  disabled={chart.is_builtin}
  style={{ marginLeft: 'auto' }}
  onClick={(event) => {
    event.stopPropagation()
    if (window.confirm(`Delete strat chart "${chart.name}"?`)) {
      onDeleteById(chart.id, chart.name, chart.is_builtin)
    }
  }}
>
  ✕
</button>
```

All three new buttons follow this exact pattern.

---

### BF4-017-A: ✕ on the well root row (delete well)

**Location in `WellDataPanel.tsx`**: the `tree-node__row--root` div for each well (line ~309).
Add a delete button as the last child of that row:

```tsx
<button
  type="button"
  className="dm-action dm-action--ghost dm-action--danger"
  title={`Delete well "${item.well_name}"`}
  style={{ marginLeft: 'auto' }}
  onClick={(event) => {
    event.stopPropagation()
    if (window.confirm(`Delete well "${item.well_name}"?`)) {
      onDeleteWell(item.well_id, item.well_name)
    }
  }}
>
  ✕
</button>
```

**New prop**: `onDeleteWell: (wellId: string, wellName: string) => void`

**Wire-up in `DataManagerPane.tsx`**:
```tsx
onDeleteWell={(wellId, wellName) => controller.onDeleteWellById(wellId, wellName)}
```

`controller.onDeleteWellById` already exists and handles the API call + view state cleanup.

---

### BF4-017-B: ✕ on the TOPS group row (delete all tops)

**Location in `WellDataPanel.tsx`**: the `tree-node__row` div for the TOPS section (line ~391).
Add a delete-all button that only renders when there are formations:

```tsx
{item.formations.length > 0 && (
  <button
    type="button"
    className="dm-action dm-action--ghost dm-action--danger"
    title="Delete all tops"
    style={{ marginLeft: 'auto' }}
    onClick={(event) => {
      event.stopPropagation()
      if (window.confirm(`Delete all ${item.formations.length} tops for "${item.well_name}"?`)) {
        onDeleteAllFormations(item.well_id)
      }
    }}
  >
    ✕
  </button>
)}
```

**New prop**: `onDeleteAllFormations: (wellId: string) => void`

**Wire-up in `DataManagerPane.tsx`**: add `controller.onDeleteAllFormations(wellId)` call, or
implement inline by calling the existing `removeFormation` store action in a loop. Reuse the logic
from `handleDeleteAllFormations` in `ProjectToolbar.tsx` (move it to the controller):

```tsx
onDeleteAllFormations: async (wellId: string) => {
  const formations = wellInventories.find(w => w.well_id === wellId)?.formations ?? []
  for (const f of formations) {
    await removeFormation(f.id)
  }
  updateWellViewState(wellId, (state) => ({ ...state, visibleFormationIds: [] }))
}
```

---

### BF4-017-C: ✕ on each individual formation row (delete top)

**Location in `WellDataPanel.tsx`**: each `top-leaf` div (line ~414). Currently it contains only
`<CheckboxLeaf .../>`. Add the ✕ button alongside it:

```tsx
<div
  key={formation.id}
  className={`top-leaf ${...}`}
  style={{ ['--top-leaf-color' as string]: topBackgroundColor(formation) }}
  onClick={() => onSelectFormation(item.well_id, formation.id)}
  onContextMenu={...}
>
  <CheckboxLeaf
    checked={...}
    label={formation.name}
    secondary={formatNumber(formation.depth_md)}
    onChange={...}
  />
  <button
    type="button"
    className="dm-action dm-action--ghost dm-action--danger"
    title={`Delete "${formation.name}"`}
    onClick={(event) => {
      event.stopPropagation()
      if (window.confirm(`Delete top "${formation.name}"?`)) {
        onDeleteFormation(item.well_id, formation.id)
      }
    }}
  >
    ✕
  </button>
</div>
```

The `top-leaf` div must be flex with `align-items: center` for the button to sit inline. Check
whether `.top-leaf` already has this; add it to `log-view.css` or `data-manager.css` if not.

**New prop**: `onDeleteFormation: (wellId: string, formationId: string) => void`

**Wire-up in `DataManagerPane.tsx`**:
```tsx
onDeleteFormation={(wellId, formationId) =>
  controller.onDeleteFormation(wellId, formationId, /* name */ '')
}
```

`controller.onDeleteFormation` already exists (used by the context menu, line ~139).

---

### BF4-017-D: Remove deleted buttons from ProjectToolbar

Remove these three buttons from `ProjectToolbar.tsx`:
- Line ~489: `<button ... onClick={() => void handleDeleteWell()}>Delete well</button>`
- Line ~501: `<button ... onClick={() => ... handleRemoveFormation(...)}>Delete top</button>`
- Line ~502: `<button ... onClick={() => void handleDeleteAllFormations()}>Delete all tops</button>`

The associated handler functions (`handleDeleteWell`, `handleRemoveFormation`,
`handleDeleteAllFormations`) can also be removed if they are not called from anywhere else.
Verify with a grep before deleting.

---

**Affected files**:
- `frontend/src/components/layout/WellDataPanel.tsx` (3 buttons + 3 new props)
- `frontend/src/components/layout/DataManagerPane.tsx` (wire new props to controller)
- `frontend/src/components/layout/ProjectToolbar.tsx` (remove 3 buttons + handlers)
- `frontend/src/styles/data-manager.css` or `log-view.css` (ensure `.top-leaf` is flex)

**Complexity**: XS — all frontend, no backend changes. Controller callbacks already exist for
well delete and single formation delete; only "delete all" needs a new controller entry.

**Implemented**:
- Added Data Manager tree delete buttons for well rows, TOPS groups, and individual top rows.
- Wired tree buttons through `DataManagerTopPane` / `DataManagerPane` to controller actions.
- Added controller-level delete-all-tops action.
- Removed Delete well / Delete top / Delete all tops from `ProjectToolbar.tsx`.

---

## BF4-021: Rebuild zones after formation top delete (todo)

**Problem**: BF4-017 moved top deletion into the Data Manager tree, but deleting a formation top
through `DELETE /api/wells/{well_id}/formations/{formation_id}` can leave zone data stale. ZoneSets
are defined by horizons/markers, and per-well zone data depends on the available picks for those
horizons. After deleting one pick, the affected well may no longer have a valid upper/lower pick
pair for one or more zones.

**Goal**: Any delete-top operation must refresh the affected well's zone state so ZoneSettings and
future calculations do not read stale zone thickness/lithology.

### Required behavior

Single top delete:
- Delete the `FormationTopModel` row as today.
- If the deleted top belongs to a `horizon_id` and the well has an active top set:
  - rebuild/recalculate zone well data for that well/top set;
  - zones whose upper/lower pick is now missing should show null thickness and no auto-derived
    lithology for that well.
- Refresh well inventory response so Data Manager/Settings receive the updated zone list.

Delete all tops:
- Delete all formation tops for the well.
- Clear visibleFormationIds in visual config as BF4-017 already does.
- Rebuild/recalculate zones for the affected well so every zone in the active ZoneSet has null
  per-well thickness/lithology for that well.

### Implementation options

Preferred backend fix:
- Update `app/src/subsidence/api/formations.py` delete endpoint to call a zone-service helper after
  deleting a top.
- Add/extend a helper in `app/src/subsidence/data/zone_service.py`, for example
  `rebuild_well_zones_after_pick_change(session, well_id)`, that:
  - finds the active top set for the well;
  - calls existing `recalculate_zone_thickness(...)` / zone rebuild logic;
  - clears auto lithology where valid pick pairs no longer exist.

Frontend fallback if backend cannot own it cleanly:
- After delete-top/delete-all-tops, call the existing zone recalculation endpoint for the well.
- This is weaker because backend consistency depends on UI behavior, so use only if backend helper
  becomes too invasive.

### Affected files

- `app/src/subsidence/api/formations.py`
- `app/src/subsidence/data/zone_service.py`
- `frontend/src/components/layout/dataManagerActions.ts` only if a frontend fallback is needed
- Backend tests for formation delete + zone refresh

**Complexity**: S/M — mostly backend consistency, small frontend only if needed.

**Verification**:
- Create/import a ZoneSet with two or more tops for a well.
- Delete one top used by a zone.
- ZoneSettings should no longer show stale thickness/lithology for zones that require the deleted
  pick.
- Delete all tops; zones remain as ZoneSet definitions, but per-well zone values are empty/null.

---

## BF4-016: Simplified LAS/CSV import — options on preview step, direct Load (todo)

**Summary**: The LAS and CSV log import dialogs have too many wizard steps. Both should collapse to
two steps: File → Preview (with options inline) + Load button. The separate Options and
Import/Summary steps are removed. Additionally, the duplicate Close/Cancel buttons should be
resolved.

---

### BF4-016-A: Collapse LAS wizard to 2 steps

**Current**: File(0) → Preview(1) → Options(2) → Import/Summary(3)
**New**: File(0) → Preview+Options(1)

In `ImportLasDialog.tsx`:
- Replace step labels: use `['File', 'Preview']` for LAS instead of `DEFAULT_STEP_LABELS`
- Remove `optionsStep` and `summaryStep` variables
- Remove the `{currentStepIndex === optionsStep ? ...}` and `{currentStepIndex === summaryStep ? ...}` blocks
- Move Target well fields + Depth reference dropdown into the Preview step, rendered below `<LasPreviewPane>`:

```tsx
{currentStepIndex === 1 ? (
  <>
    <LasPreviewPane isLoading={previewLoading} error={previewError} preview={lasPreview} />

    {!previewLoading && (lasPreview !== null || previewError !== null) && (
      <div className="import-wizard__options">
        <ImportWizardTargetWellFields
          wells={wells}
          wellId={wellId}
          createNewWell={createNewWell}
          emptyLabel="Create or match by LAS well name"
          fileWellSource={fileWellSource}
          wellPolicy={wellPolicy}
          onWellIdChange={setWellId}
          onCreateNewWellChange={setCreateNewWell}
          onWellPolicyChange={setWellPolicy}
        />
        <label className="project-dialog__field">
          <span>Depth reference</span>
          <select value={trustedDepthRef} onChange={(e) => setTrustedDepthRef(e.target.value as 'MD' | 'TVD' | 'TVDSS')}>
            <option value="MD">MD — measured depth</option>
            <option value="TVD">TVD — true vertical depth</option>
            <option value="TVDSS">TVDSS — TVD subsea</option>
          </select>
        </label>
      </div>
    )}
  </>
) : null}
```

Step 1 is now the final step → `ImportWizardShell` renders Cancel / Back / Load (submit) automatically.
`canSubmit`: `sourceIsValid && previewReady`.

---

### BF4-016-B: Auto-detect LAS depth reference from curve mnemonic

LAS files always place the depth curve first in the curve list (`lasPreview.curves[0]`).
Auto-populate `trustedDepthRef` when the preview loads:

```tsx
function detectLasDepthRef(mnemonic: string): 'MD' | 'TVD' | 'TVDSS' {
  const m = mnemonic.toUpperCase().trim()
  if (m.startsWith('TVDSS')) return 'TVDSS'
  if (m.startsWith('TVD')) return 'TVD'
  return 'MD'   // DEPT, DEPTH, MD, MEASURED_DEPTH, etc.
}

useEffect(() => {
  if (lasPreview?.curves.length) {
    setTrustedDepthRef(detectLasDepthRef(lasPreview.curves[0].mnemonic))
  }
}, [lasPreview])
```

Dropdown stays editable — auto-detect is just a pre-fill.

---

### BF4-016-C: Auto-match LAS well name to existing project wells

When `lasPreview` loads with a `well_name`, try a case-insensitive name match against the `wells`
list. If a match is found, auto-select it in the dropdown (`wellPolicy='override'`). If no match,
fall back to `wellPolicy='file'` (backend will use the LAS name to create or match).

```tsx
useEffect(() => {
  if (!lasPreview?.well_name) return
  const normalized = lasPreview.well_name.trim().toLowerCase()
  const match = wells.find((w) => w.well_name.trim().toLowerCase() === normalized)
  if (match) {
    setWellId(match.well_id)
    setWellPolicy('override')
  } else {
    setWellId('')
    setWellPolicy('file')
  }
}, [lasPreview, wells])
```

**Remove** the existing `useEffect(() => { setWellPolicy(fileWellSource ? 'file' : 'override') }, [fileWellSource])` —
BF4-016-C replaces it.

---

### BF4-016-D: Collapse CSV wizard to 2 steps — remove Mapping step entirely

**Current**: File(0) → Preview(1) → Mapping(2) → Options(3) → Import(4)
**New**: File(0) → Preview+Options(1)

In `ImportLasDialog.tsx`:
- Use `['File', 'Preview']` as step labels for CSV too; remove usage of `MAPPING_STEP_LABELS`
- Remove `{currentStepIndex === 2 && sourceType === 'csv' ? <MappingPane ...> : null}` block
- Remove `mappingErrors` / `mappingOk` variables (no longer used for step gating; still needed for `canSubmit`)
- The depth column is taken directly from `mapping['depth']` (already auto-mapped by the existing `useEffect`)

New step 1 for CSV:
```tsx
{currentStepIndex === 1 && sourceType === 'csv' ? (
  <>
    <TabularPreviewPane
      isLoading={previewLoading}
      error={previewError}
      preview={tabularPreview}
      settings={parserSettings}
      onSettingsChange={updateParserSettings}
      depthColumn={mapping['depth'] ?? null}
    />

    {!previewLoading && tabularPreview && (
      <div className="import-wizard__options">
        <ImportWizardTargetWellFields
          wells={wells}
          wellId={wellId}
          createNewWell={createNewWell}
          emptyLabel="Select target well"
          onWellIdChange={setWellId}
          onCreateNewWellChange={setCreateNewWell}
        />
        <div className="project-dialog__field">
          <span>Depth column</span>
          <span>{mapping['depth'] ?? <em>not detected</em>}</span>
        </div>
        <label className="project-dialog__field">
          <span>Depth reference</span>
          <select value={trustedDepthRef} onChange={(e) => setTrustedDepthRef(e.target.value as 'MD' | 'TVD' | 'TVDSS')}>
            <option value="MD">MD — measured depth</option>
            <option value="TVD">TVD — true vertical depth</option>
            <option value="TVDSS">TVDSS — TVD subsea</option>
          </select>
        </label>
      </div>
    )}

    {!previewLoading && tabularPreview && !mapping['depth'] && (
      <p className="project-dialog__error">
        No depth column detected. Rename a column to DEPT, DEPTH, MD, TVD, or TVDSS and reload.
      </p>
    )}
  </>
) : null}
```

`canSubmit` for CSV: `sourceIsValid && tabularPreview !== null && !!mapping['depth']`

---

### BF4-016-E: Auto-detect CSV depth reference from column name

When `mapping['depth']` changes after auto-mapping, infer `trustedDepthRef`:

```tsx
function detectCsvDepthRef(columnName: string): 'MD' | 'TVD' | 'TVDSS' {
  const c = columnName.toLowerCase().replace(/[_\s-]/g, '')
  if (c.includes('tvdss')) return 'TVDSS'
  if (c.includes('tvd')) return 'TVD'
  return 'MD'
}

useEffect(() => {
  const col = mapping['depth']
  if (col) setTrustedDepthRef(detectCsvDepthRef(col))
}, [mapping])
```

---

### BF4-016-F: Highlight depth column in CSV preview table

Add `depthColumn?: string | null` prop to `TabularPreviewPane`.
Mark the matched column's header and body cells with a CSS class:

```tsx
// TabularPreviewPane.tsx — inside the table render:
const depthColIndex = depthColumn != null ? preview.columns.indexOf(depthColumn) : -1

// <th>:
<th key={i} className={i === depthColIndex ? 'import-preview__col--depth' : undefined}>

// <td>:
<td key={ci} className={ci === depthColIndex ? 'import-preview__col--depth' : undefined}>
```

CSS (wherever `.import-preview__table` is styled):
```css
.import-preview__col--depth {
  background: rgba(186, 230, 253, 0.35);   /* very faint sky-blue */
}
```

---

### BF4-016-G: Remove Close / Cancel duplication

The dialog header in `ImportWizardShell.tsx` has a "Close" link (`project-dialog__link`) and the
footer already has a "Cancel" button — both call `onClose`. Remove the header "Close" button:

```tsx
// Remove from ImportWizardShell.tsx header:
<button type="button" className="project-dialog__link" onClick={onClose}>
  Close
</button>
```

`ImportWizardShell` is shared by tops, deviation, unconformities, and strat-chart dialogs —
the removal affects all of them. None have special logic in the header close; the footer Cancel
is sufficient.

**Affected files**:
- `frontend/src/components/layout/ImportLasDialog.tsx` (sub-items A–E)
- `frontend/src/components/layout/importWizard/TabularPreviewPane.tsx` (sub-item F)
- `frontend/src/components/layout/importWizard/ImportWizardShell.tsx` (sub-item G)
- CSS file where `.import-preview__table` styles live (sub-item F)

**Complexity**: S — frontend only, no backend changes. All sub-items are independent.

---

## BF4-015: Track resize — narrowing only updates header, not canvas (done)

**Problem**: When dragging the right edge of a track to the **right** (widening), the track header
and canvas both update correctly. When dragging **left** (narrowing) — including reversing direction
mid-drag — the header shrinks but the canvas content stays at its original width.

**Repro steps**:
1. Open a project with one or more log tracks.
2. Drag the right edge of a track to the right — both header and canvas widen correctly.
3. In the same drag (or a new drag), pull the edge to the left — the header collapses but the
   canvas (curve data, depth scale, formation column) does not follow.

**Root cause** (confirmed hypothesis):

Canvas elements inside a flex row have `min-width: auto` by default. When a canvas is used for
HiDPI rendering, `useCanvasRenderer.ts` sets `canvas.width = Math.round(clientWidth * devicePixelRatio)`.
This raises the *intrinsic* HTML canvas bitmap width (e.g., 300 px becomes 600 px at 2× DPR).

In a flex container, `min-width: auto` evaluates to the element's *intrinsic content size*. After
`canvas.width` is raised by the HiDPI write, the intrinsic size is now the bitmap pixel width
(interpreted in CSS px). Even though `style.width = '150px'` is set by the parent, the flex engine
refuses to shrink the element below its intrinsic minimum. The header (`<button>` elements) has a
small intrinsic size (text content) and therefore *does* shrink, which creates the split behaviour.

**Fix** — add `min-width: 0` to every canvas-wrapper in the track row:

In `frontend/src/styles/log-view.css`:
```css
.data-track,
.formation-column,
.depth-track {
  min-width: 0;    /* allow flex container to shrink canvas below intrinsic width */
}
```

`min-width: 0` is the standard fix for this well-known flex-container / canvas intrinsic-size
problem. Setting it to `0` does **not** change any visible behaviour when the track width is
increasing — it only removes the hidden lower bound that prevents shrinking.

**Affected files**:
- `frontend/src/styles/log-view.css`

**Complexity**: XS — single CSS rule addition, no JS changes.

**Verification**: After the fix, drag a track right edge left; the canvas should collapse in
lockstep with the header. Check at both 1× and 2× devicePixelRatio (browser zoom 100% and 200%).

**Implemented**:
- Added `min-width: 0` to `.depth-track`, `.data-track`, and `.formation-column` in
  `frontend/src/styles/log-view.css`.

---

## BF4-019: Delete log curve / delete all logs from Data Manager (todo)

**Problem**: BF4-017 added delete buttons for wells and tops, but log curves still cannot be
deleted from the Data Manager tree. The Logs group and individual curve rows only support visibility
toggling and selection.

**Goal**: Add explicit delete actions for:
1. A single log curve under `Logs`.
2. All log curves for a well from the `Logs` group row.

This is intentionally separate from BF4-017 because deleting log data affects backend metadata,
Parquet payload storage, visual config, lithology/zone aggregation, and recalculation state.

### Backend contract

Add endpoints in `app/src/subsidence/api/wells.py`:

```http
DELETE /api/wells/{well_id}/curves/{mnemonic}
DELETE /api/wells/{well_id}/curves
```

Single-curve delete:
- Validate that the well and curve exist.
- Remove the `CurveMetadata` row.
- Rewrite the well Parquet payload without that curve column.
- If no curves remain, keep a valid Parquet payload with only `DEPT` or remove the payload file
  consistently; choose one behavior and document it in code/tests.
- Return `204`.

Delete-all logs:
- Remove all `CurveMetadata` rows for the well.
- Remove or rewrite the well Parquet payload consistently with the single-curve behavior.
- Return `204`.

Safety:
- Built-in dictionaries are not affected.
- Formation tops, deviation survey, zones, and well metadata are not deleted.
- Deleting a curve used for lithology aggregation must leave existing manual zone lithology intact,
  but auto-derived zone lithology should become stale/recalculated as empty if no lithology curve
  remains.

### Frontend contract

Data Manager tree:
- Add red `✕` to each curve row under `Logs`.
- Add red `✕` to the `Logs` group row when at least one curve exists.
- Match the BF4-017 button style:
  `dm-action dm-action--ghost dm-action--danger`.
- Confirm before deleting:
  - single curve: `Delete log curve "GR"?`
  - all logs: `Delete all 12 log curves for "Well A"?`

State cleanup after delete:
- Remove deleted curve mnemonics from every `TrackConfig.curves` entry for that well.
- If a track becomes empty, keep the track shell for now unless existing store helpers already
  remove empty tracks safely.
- Clear selected curve if it was deleted.
- Refresh well detail and well inventory.
- Trigger subsidence recalculation / stored result invalidation through existing store paths.

### Affected files

- `app/src/subsidence/api/wells.py`
- `app/src/subsidence/data/loaders.py` or a new helper near import payload writing if Parquet
  rewrite logic should be shared
- `frontend/src/stores/wellDataStore.ts`
- `frontend/src/components/layout/WellDataPanel.tsx`
- `frontend/src/components/layout/DataManagerTopPane.tsx`
- `frontend/src/components/layout/DataManagerPane.tsx`
- `frontend/src/components/layout/dataManagerActions.ts`
- `frontend/src/components/layout/useDataManagerController.ts`
- `frontend/src/styles/data-manager.css`

**Complexity**: M — backend payload rewrite + frontend tree actions + visual config cleanup.

**Verification**:
- Delete one log curve; it disappears from Data Manager and track rendering after refresh.
- Save/reopen project; deleted curve does not return.
- Delete all logs; well remains, tops remain, deviation remains, log tracks do not render deleted
  curves.
- Delete a lithology curve used for auto zones; manual zone lithology stays, auto aggregation no
  longer uses the deleted curve.

---

## BF4-020: Delete deviation survey from Data Manager (todo)

**Problem**: Deviation/inclinometry can be imported and shown under the `DEV` group, but there is no
explicit delete action. If a deviation survey is removed, the well must behave as vertical again:
MD, TVD, and TVDSS calculations should no longer use the deleted survey.

**Goal**: Add a delete action for the `DEV` group in the Data Manager tree.

### Backend contract

Add endpoint in `app/src/subsidence/api/wells.py`:

```http
DELETE /api/wells/{well_id}/deviation
```

Behavior:
- Validate that the well exists.
- If no deviation survey exists, return `204` (idempotent delete) or `404`; choose one behavior and
  document it in the test. Preferred: `204`, because the requested final state is already true.
- Delete the `DeviationSurveyModel` row.
- Delete the referenced deviation payload file if it exists.
- Recalculate formation TVD/TVDSS fields back to vertical-well behavior:
  - `depth_tvd = depth_md`
  - `depth_tvdss = depth_md - kb_elev` (or the existing vertical convention in
    `deviation_transform.py`; confirm before implementation)
- Trigger/save dirty project state through the existing backend mutation path.

### Frontend contract

Data Manager tree:
- Add red `✕` to the `DEV` group row when `item.deviation` exists.
- Match BF4-017 delete button style:
  `dm-action dm-action--ghost dm-action--danger`.
- Confirm before deleting: `Delete deviation survey for "Well A"?`

State cleanup after delete:
- Hide deviation overlay for that well.
- Refresh well detail and well inventory.
- Keep logs, tops, zones, and well metadata.
- Clear selected object if it points to the deleted DEV group.
- Recalculation should run through existing store refresh/recalculation paths.

### Affected files

- `app/src/subsidence/api/wells.py`
- `app/src/subsidence/data/deviation_transform.py` if a helper is needed for vertical reset
- `frontend/src/stores/wellDataStore.ts`
- `frontend/src/components/layout/WellDataPanel.tsx`
- `frontend/src/components/layout/DataManagerTopPane.tsx`
- `frontend/src/components/layout/DataManagerPane.tsx`
- `frontend/src/components/layout/dataManagerActions.ts`
- `frontend/src/components/layout/useDataManagerController.ts`

**Complexity**: S/M — one backend delete endpoint, payload cleanup, TVD/TVDSS reset, frontend tree
action.

**Verification**:
- Import deviation, confirm well shows DEV metadata.
- Delete DEV from Data Manager; DEV disappears and the well behaves as vertical.
- Existing tops remain; their TVD/TVDSS values are reset according to the vertical convention.
- Save/reopen project; deleted deviation does not return.

---

## BF4-022: Data Manager style tokens and reusable object controls (done)

**Problem**: Recent small fixes introduced local styles for object markers and model active
indicators. This breaks the previously agreed Data Manager style unification:
- well color marker is a horizontal pill while formation/top markers are vertical bars;
- Models active indicator uses custom `.tree-leaf__radio` CSS instead of the same native radio
  control used by WELLS;
- future sea-level overlay checkboxes could easily add another visual style if not constrained.

**Design decision**: `frontend/src/styles/data-manager.css` remains the single source of truth for
Data Manager and Settings object controls. New shared controls must be defined near the existing
DM tokens/tree primitives, then reused by components. Component-specific styles are allowed only
when the component has a genuinely unique layout.

**Implementation requirements**:
- Add a reusable vertical object color marker class, e.g. `.dm-object-color-bar`, using the same
  proportions as `.top-leaf::before`.
- Replace the WELLS row color swatch with `.dm-object-color-bar`.
- Stop using custom `.tree-leaf__radio` / `.tree-leaf__radio--active` for Models. Use native
  `input type="radio"` in the same row pattern as WELLS.
- Keep checkboxes for chart overlay and tree visibility as native controls styled by existing
  `.sf-row` / tree rules unless a missing shared style is identified before implementation.
- Remove obsolete component-specific radio/marker styles if they are no longer used.

**Affected files**:
- `frontend/src/styles/data-manager.css`
- `frontend/src/components/layout/WellDataPanel.tsx`

**Verification**:
- WELLS color marker is vertical and visually matches top marker bars.
- Models -> Total active indicator is the same native radio style as WELLS.
- Planned model rows remain selectable for settings but cannot become active computed models.

**Implemented**:
- Added `.dm-object-color-bar` as the shared vertical object color marker in
  `frontend/src/styles/data-manager.css`.
- Replaced the WELLS color pill with `.dm-object-color-bar`.
- Replaced the custom Models radio indicator with a native `input type="radio"` row control.
- Removed obsolete `.tree-leaf__radio` styles.

---

## BF4-023: Sea-level correction recomputes model, overlay is independent (done)

**Problem**: Models -> Total can select a sea-level correction curve, but changing the curve only
updates the active curve link and does not recalculate the subsidence model. Separately, the
single-well chart overlay currently visualizes only the active correction curve, so visual overlay
and model correction are mixed together.

**Design decision**:
- `well_active_sea_level_curves.active_sea_level_curve_id` is the compute setting. `None` means the
  model ignores eustatic correction.
- Single-well chart sea-level overlay is a display setting stored in project visual config. It can
  show any subset of available curves, including all curves, and does not change model inputs.

**Implementation requirements**:
- After `setWellActiveSeaLevelCurve(wellId, curveId)` succeeds, refresh inventories and trigger
  the existing subsidence recalculation path for the active well.
- Add `subsidenceSingleSeaLevelOverlayCurveIds: number[]` to `viewStore` and project visual config.
- In `StratChartTab`, render per-curve overlay checkboxes under `Charts / SEA LEVEL CURVES` plus
  a root checkbox for "all curves".
- Each sea-level curve row in `Charts / SEA LEVEL CURVES` must show the same reusable vertical
  object color marker used by wells.
- Keep Single Well chart settings focused on chart-local options such as depth range; do not
  duplicate the sea-level curve checklist there.
- Selecting a sea-level curve opens its Settings panel, where the user can edit display `Color`
  and `Line style` (`solid | dashed | dotted`) for the overlay.
- Store sea-level overlay display styles in project visual config, not in the built-in dictionary
  rows.
- Preserve legacy behavior: if old projects have `subsidenceSingleShowSeaLevel=true` and no explicit
  overlay ids, show the active correction curve.
- In `SubsidenceCanvas`, load and draw all selected overlay curves using their configured color and
  line style. Overlay curves must remain clipped to the plot area and use the depth axis, as
  BF4-012 established.

**Affected files**:
- `frontend/src/stores/viewStore.ts`
- `frontend/src/stores/projectStore.ts`
- `frontend/src/stores/wellDataStore.ts`
- `frontend/src/components/layout/StratChartTab.tsx`
- `frontend/src/components/layout/settings/SeaLevelCurveSettings.tsx`
- `frontend/src/components/subsidence/SubsidenceCanvas.tsx`
- `frontend/src/App.tsx`

**Verification**:
- In Models -> Total, select a sea-level correction curve and confirm the subsidence result
  recalculates.
- Set correction to `None`; model recalculates without eustatic correction.
- Select one overlay curve in `Charts / SEA LEVEL CURVES`; only that curve is drawn.
- Select "All curves"; all available curves are drawn.
- Overlay checkbox changes do not alter the Models -> Total correction selector.
- Select a sea-level curve row; Settings can change its color and line style.
- Data Manager sea-level curve row marker updates to the selected color.

**Implemented**:
- `setWellActiveSeaLevelCurve` now refreshes inventories and triggers subsidence recalculation for
  the active well after changing the compute correction curve.
- Added `subsidenceSingleSeaLevelOverlayCurveIds` to `viewStore` and project visual config.
- `Charts / SEA LEVEL CURVES` now exposes native checkboxes for all sea-level curves plus an
  all-curves root checkbox.
- Single Well chart settings no longer duplicate the sea-level curve checklist.
- Added `seaLevelOverlayStyles` to project visual config.
- `SeaLevelCurveSettings` now edits overlay color and line style for the selected curve.
- Data Manager sea-level curve rows now show reusable vertical color markers.
- `SubsidenceCanvas` now loads and draws all selected display overlay curves using configured
  colors and line styles.
- Legacy projects with `subsidenceSingleShowSeaLevel=true` and no explicit overlay ids still show
  the active Models correction curve.

---

## BF4-024: Single-well zone labels show upper marker only (done)

**Problem**: Single-well subsidence chart labels still show zone intervals such as
`Top -> Base` / `Top -> Base` variants. The user needs shorter labels: only the upper marker/top
name should be displayed.

**Implementation requirements**:
- Update the chart label formatter to split on both ASCII `->` and the Unicode arrow `→`.
- Trim whitespace and keep only the upper marker name.
- Keep a short length limit so labels do not overlap the chart margin.

**Affected files**:
- `frontend/src/components/subsidence/SubsidenceCanvas.tsx`

**Verification**:
- Single Well chart right-side labels show only the top marker name.
- Existing long top names are still truncated.

**Implemented**:
- `SubsidenceCanvas` label formatting now splits zone names on both `->` and `→`, trims the result,
  and draws only the upper marker name with a short length limit.

---

## Implementation order

| # | Item | Complexity | Notes |
|---|---|---|---|
| 1 | BF4-015 | XS | One CSS rule — highest priority, visible defect |
| 2 | BF4-017 | XS | ✕ delete buttons in data manager tree |
| 3 | BF4-001 | XS | SVG overflow fix, 1–2 lines |
| 4 | BF4-002 | XS | Remove span elements |
| 5 | BF4-006 | XS | Remove hex input, update CSS for oval |
| 6 | BF4-007-A | XS | CSS padding on select |
| 7 | BF4-012 | XS | Remove sea level dual axis in SubsidenceCanvas |
| 8 | BF4-013 | XS | Display label fix in drawFormationLabels |
| 9 | BF4-014 | XS | Add km gridlines in draw callback |
| 10 | BF4-003 | S | StratCharts hierarchy restructure |
| 11 | BF4-008 | S | Move sea level selector to Models |
| 12 | BF4-009 | S | Models computed state + radio |
| 13 | BF4-004 | S | Curve settings when disabled (investigate first) |
| 14 | BF4-016 | S | Simplified LAS/CSV import dialog (frontend only) |
| 15 | BF4-018 | M | Inline column mapping + 2-step for Tops/Deviation/Unconformities |
| 17 | BF4-010 | M | New side toolbar component |
| 18 | BF4-007-B | M | Sea level override per top (backend + frontend) |
| 19 | BF4-011 | M | API audit (research task) |
| 20 | BF4-019 | M | Delete log curves from Data Manager |
| 21 | BF4-020 | S/M | Delete deviation survey from Data Manager |
| 22 | BF4-021 | S/M | Rebuild zones after formation top delete |
| 23 | BF4-022 | XS | Restore shared Data Manager style primitives |
| 24 | BF4-023 | S | Separate sea-level compute selector from overlay checkboxes |
| 25 | BF4-024 | XS | Single-well labels show upper marker only |
| 26 | BF4-005 | L | Lithology discrete/fraction (multi-step) |
