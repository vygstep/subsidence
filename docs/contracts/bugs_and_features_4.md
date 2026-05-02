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

## BF4-025: Durable per-curve settings and dictionary mnemonic assignment (todo)

**Problem**: BF4-004 preserves curve settings when a curve is hidden, but viewer settings are still
owned by `TrackConfig.curves[*]`. If the user deletes a track, every curve placement inside that
track is deleted, and the curve's visual settings are lost. Re-adding the same curve creates a new
default config through `buildCurveDefaults(...)`.

**Second problem**: the loaded source mnemonic is currently treated as both the source column name
and the semantic identity of the curve. The user needs to assign a built-in dictionary mnemonic /
canonical mnemonic from a dropdown, without renaming the original loaded curve column.

**Design decision**:
- Track membership and curve visual settings must be separated.
- `TrackConfig.curves[*]` should represent placement of a curve in a track.
- Durable per-curve viewer settings should live at the well visual-config level, keyed by source
  mnemonic.
- Semantic dictionary assignment is not a viewer-only setting. It belongs in backend
  `curve_metadata`, because compute, lithology, future import validation, and semantic grouping
  need to read it without depending on viewer layout.

### BF4-025-A: Well-level curve visual settings

Add to `WellViewState`:

```ts
curveSettingsByMnemonic: Record<string, CurveConfig>
```

Rules:
- `curveSettingsByMnemonic[mnemonic]` is the canonical viewer style for that curve in the well.
- `TrackConfig.curves[*]` should keep only placement data long-term. During migration it may still
  contain the full `CurveConfig` shape, but the settings source of truth must be
  `curveSettingsByMnemonic`.
- Deleting a track removes placement only. It must not delete
  `curveSettingsByMnemonic[mnemonic]`.
- Adding a curve to a track uses:
  1. existing `curveSettingsByMnemonic[mnemonic]`, if present;
  2. migrated settings from an existing `TrackConfig.curves[*]`, if present;
  3. `buildCurveDefaults(...)`, if no user settings exist.
- Editing settings in `CurveSettings` updates `curveSettingsByMnemonic[mnemonic]`.
- Rendered track configs are resolved by merging placement with
  `curveSettingsByMnemonic[mnemonic]` before passing to `DataTrack`.

Migration:
- In `coerceWellViewState`, populate `curveSettingsByMnemonic` from existing
  `TrackConfig.curves[*]` when the new field is absent.
- If the same mnemonic appears in multiple tracks with different settings, prefer the first
  occurrence in `trackOrder`; document this as the migration rule.
- Keep old projects valid and do not delete legacy curve config fields until a later cleanup.

### BF4-025-B: Restore defaults

Add a `Restore defaults` action to `CurveSettings`.

Behavior:
- Recompute defaults using `buildCurveDefaults(curveData, indexOrStableSeed)`.
- Replace `curveSettingsByMnemonic[mnemonic]` with the default style.
- Keep the curve placement in its current track.
- If the curve is hidden, it remains hidden.
- The button affects viewer style only; it must not alter backend semantic metadata.

### BF4-025-C: Dictionary mnemonic assignment

Add a dropdown in `CurveSettings`:

```text
Dictionary mnemonic
```

Behavior:
- Options come from the built-in/user curve mnemonic dictionary entries.
- The original loaded mnemonic remains unchanged and continues to identify the data column.
- Store selected semantic assignment in backend curve metadata, not visual config.
- Extend backend `CurveMetadata` if needed with fields such as:
  - `canonical_mnemonic`
  - `family_code`
  - `canonical_unit`
  - `mnemonic_entry_id` (optional FK if stable dictionary row identity is needed)
- `PATCH /api/wells/{well_id}/curves/{mnemonic}` must support updating the semantic assignment.
- Frontend inventory/detail responses must expose the selected semantic assignment.
- Dictionary matching can still provide an initial suggestion, but the user assignment is explicit
  and must survive save/reopen.

Validation:
- If the selected dictionary row has a canonical unit, show it in settings.
- Do not force unit conversion in this task; only store the semantic assignment.
- If the user clears the dropdown, backend metadata returns to source-only semantics.

### Affected files

- `frontend/src/stores/workspaceStore.ts`
- `frontend/src/components/layout/dataManagerVisibility.ts`
- `frontend/src/components/layout/useDataManagerController.ts`
- `frontend/src/components/layout/ViewerWorkspace.tsx`
- `frontend/src/components/layout/settings/CurveSettings.tsx`
- `frontend/src/utils/curvePresets.ts`
- `frontend/src/types/tracks.ts`
- `frontend/src/types/well.ts`
- `app/src/subsidence/data/schema.py`
- `app/src/subsidence/data/engine.py`
- `app/src/subsidence/api/wells.py`
- backend tests for curve metadata patching
- frontend tests for visual-config migration and restore defaults

**Complexity**: M/L — visual-config migration plus backend metadata extension.

**Verification**:
- Change curve color/scale/line style, delete the track, create a new track, add the same curve:
  settings should be restored from `curveSettingsByMnemonic`.
- Click `Restore defaults`; style returns to dictionary/default preset values without moving the
  curve between tracks.
- Hide a curve, change settings, delete another track, save/reopen: hidden state and settings both
  survive.
- Assign a dictionary mnemonic from the dropdown, save/reopen, and verify the assignment remains.
- Clear dictionary assignment and verify the curve returns to source-only metadata.

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

## BF4-010: Move top-management buttons to side track toolbar (done)

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

### Implemented

- Added zoom presets (1:200, 1:500, 1:1000), Add top, Link top, Set age, Set type, Move top
  buttons to the existing `WellViewerToolbar` component rather than creating a new file — the
  component already provided the vertical side toolbar pattern with identical CSS.
- `SetFormationTypeDialog` and `LinkStratChartDialog` handling moved from `ProjectToolbar` into
  `WellViewerToolbar` with local `activeDialog` / `formationLinkTarget` state; dialogs render
  via an inline `project-dialog-overlay`.
- `ProjectToolbar` secondary toolbar row now only shows file-import actions (Create well, Load
  logs, Load tops, Load deviation) with no top-management or zoom buttons.
- `ZoomControl` import removed from `ProjectToolbar`; zoom logic inlined in `WellViewerToolbar`.
- Added `.well-viewer-toolbar__divider` and `:disabled` opacity rule to `log-view.css`.

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

## BF4-018: Unified 2-step import — inline column mapping in remaining tabular dialogs (done)

**Context**: BF4-016 collapses the LAS and CSV-logs dialogs to 2 steps. This item applies the same
pattern to the remaining tabular import dialogs (Tops, Deviation) and introduces a
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

### BF4-018-D: Backend — store `depth_unit` as metadata, no conversion on import

**Important**: data is stored exactly as loaded — **no unit conversion during import**.
The `depth_unit` field is metadata that tells the engine what unit the stored values are in,
so it can convert correctly at compute time (e.g., ft → m before backstripping).

Add `depth_unit: 'm' | 'ft' | 'km'` (default `'m'`) to the import endpoints:
- `POST /api/projects/import-tops`
- `POST /api/projects/import-deviation`
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

### BF4-018-E: Remove `MappingPane` and `MAPPING_STEP_LABELS` after migration

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
- `app/src/subsidence/api/wells.py` + import handlers (BF4-018-D)
- `frontend/src/components/layout/importWizard/MappingPane.tsx` — delete (BF4-018-E)
- `frontend/src/components/layout/importWizard/importWizardUtils.ts` — remove constant (BF4-018-E)

**Complexity**: M — two dialogs + shared component change + backend depth_unit field

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

## BF4-021: Rebuild zones after formation top delete (done)

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

### Implemented

- After `RemoveFormation` executes in `DELETE /api/wells/{well_id}/formations/{formation_id}`,
  a second session block looks up the well's active `top_set_id`, then calls
  `recalculate_zone_thickness` and `aggregate_zone_lithology_from_curve` for that well.
- Zones whose upper/lower pick no longer exists (deleted or depth_md is None) get
  `thickness_md = None` and `thickness_tvd = None`; auto lithology is unchanged (no valid slice
  to aggregate from, so the previous value persists until next import or manual override).
- All three zone-service helpers were already imported in `formations.py` — no new imports needed.
- Delete-all-tops in the frontend loops over individual delete calls, so each call triggers a
  recalculation; after the last one all zone thicknesses for that well are null.

---

## BF4-016: Simplified LAS/CSV import — options on preview step, direct Load (done)

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

---

### BF4-016-H: Curve type selection per curve in LAS/CSV preview

In the LAS and CSV preview step, add a **Type** column to the curve list so the user can override
the auto-detected `curve_type` before loading.

**LAS preview** — `LasPreviewPane` renders a table of curves (`lasPreview.curves`). Add a `Type`
column after the mnemonic/unit columns with a `<select>` per row:

```tsx
<select
  value={curveTypes[curve.mnemonic] ?? 'continuous'}
  onChange={(e) => setCurveTypes((prev) => ({ ...prev, [curve.mnemonic]: e.target.value }))}
>
  <option value="continuous">continuous</option>
  <option value="discrete">discrete</option>
</select>
```

State: `const [curveTypes, setCurveTypes] = useState<Record<string, 'continuous' | 'discrete'>>({})`.

**Auto-detect on preview load** (populate `curveTypes` from `lasPreview`):
```tsx
useEffect(() => {
  if (!lasPreview) return
  const detected: Record<string, 'continuous' | 'discrete'> = {}
  for (const curve of lasPreview.curves) {
    // Skip the depth curve (first in list)
    if (curve === lasPreview.curves[0]) continue
    detected[curve.mnemonic] = detectCurveType(curve)
  }
  setCurveTypes(detected)
}, [lasPreview])
```

**CSV preview** — add the same per-column Type selector row in `TabularPreviewPane` (or inline in
`ImportLasDialog`), skipping the depth column.

**`detectCurveType` heuristic**:
```tsx
function detectCurveType(curve: LasPreviewCurve): 'continuous' | 'discrete' {
  // All sample values in preview are integers → discrete
  if (curve.sample_values?.every((v) => Number.isFinite(v) && Number.isInteger(v))) return 'discrete'
  return 'continuous'
}
```

**Pass `curveTypes` to the import payload**: when submitting, include `curve_types` in the POST
body. Backend already stores `curve_type` per curve in `curve_metadata`; extend the LAS/CSV import
endpoint to accept and apply the override map.

**Backend** (`wells.py` or import handler):
- Accept optional `curve_types: dict[str, Literal['continuous', 'discrete']]` in the import
  request body.
- After writing curve metadata rows, patch `curve_type` for any mnemonic present in the map.
- Default remains `'continuous'` for curves not in the map.

**Affected files**:
- `frontend/src/components/layout/ImportLasDialog.tsx` (sub-items A–E)
- `frontend/src/components/layout/importWizard/LasPreviewPane.tsx` (sub-item H — Type column)
- `frontend/src/components/layout/importWizard/TabularPreviewPane.tsx` (sub-items F, H)
- `frontend/src/components/layout/importWizard/ImportWizardShell.tsx` (sub-item G)
- CSS file where `.import-preview__table` styles live (sub-item F)
- `app/src/subsidence/api/wells.py` or the LAS/CSV import endpoint (sub-item H — backend)

**Complexity**: S — frontend only for A–G; sub-item H adds a small backend touch.

**Implemented** (commit `c30c805`):
- A: `ImportLasDialog` uses `['File', 'Preview']` step labels; options block rendered inline after preview.
- B: `detectLasDepthRef()` on `lasPreview.curves[0].mnemonic` pre-fills depth reference.
- C: `lasPreview.well_name` matched case-insensitively against wells list; auto-selects well or falls back to `wellPolicy='file'`. Replaces old `fileWellSource` effect.
- D: CSV path uses same 2-step flow; `MappingPane` block removed; `mapping['depth']` taken from auto-map.
- E: `detectCsvDepthRef()` on `mapping['depth']` change pre-fills depth reference.
- F: `TabularPreviewPane` gains `depthColumn` prop; depth column header and cells get `.import-preview__col--depth` highlight.
- G: `ImportWizardShell` header Close button removed; Cancel in footer is sufficient.
- H: `LasPreviewPane` gains `curveTypes` / `onCurveTypeChange` props; Type column with `<select>` per data curve (depth curve at index 0 shows "depth" label). CSV curve types auto-detected from preview rows (all-integer → discrete). `curve_types` passed in POST body; backend applies to `curve_metadata` after import.

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

## BF4-019: Delete log curve / delete all logs from Data Manager (done)

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

### Implemented

- `DELETE /api/wells/{well_id}/curves/{mnemonic}` — removes the `CurveMetadata` row; deletes the
  Parquet file only if no other `CurveMetadata` rows share the same `data_uri` (checked via
  `session.flush()` + existence query).
- `DELETE /api/wells/{well_id}/curves` — removes all `CurveMetadata` rows for the well with the
  same shared-Parquet safety check.
- Frontend: `×` button on the `Logs` group row (shown when curves exist) and on each individual
  curve row; wired through `dataManagerActions.ts` → `useDataManagerController` →
  `DataManagerTopPane` → `WellDataPanel`.
- State cleanup: removes deleted mnemonics from `tracks[].curves` and `hiddenCurveMnemonics` in
  `workspaceStore`; clears `selectedObject` if it pointed to the deleted curve.

---

## BF4-020: Delete deviation survey from Data Manager (done)

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

### Implemented

- `DELETE /api/wells/{well_id}/deviation` — deletes `DeviationSurveyModel` row and its payload
  file; resets all `FormationTopModel` rows for the well to vertical: `depth_tvd = depth_md`,
  `depth_tvdss = depth_md - kb_elev`; idempotent (returns `204` when no survey exists).
- Frontend: `×` button on the `DEV` group row, shown only when `item.deviation` is set; wired
  through the same handler chain as BF4-019.
- State cleanup: sets `deviationVisible = false` in `workspaceStore` for that well; refreshes
  inventory and well detail.

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
| 15 | BF4-018 | M | Inline column mapping + 2-step for Tops/Deviation |
| 17 | BF4-010 | M | New side toolbar component | done |
| 18 | BF4-007-B | M | Sea level override per top (backend + frontend) |
| 19 | BF4-011 | M | API audit (research task) |
| 20 | BF4-019 | M | Delete log curves from Data Manager | done |
| 21 | BF4-020 | S/M | Delete deviation survey from Data Manager | done |
| 22 | BF4-021 | S/M | Rebuild zones after formation top delete | done |
| 23 | BF4-022 | XS | Restore shared Data Manager style primitives |
| 24 | BF4-023 | S | Separate sea-level compute selector from overlay checkboxes |
| 25 | BF4-024 | XS | Single-well labels show upper marker only |
| 26 | BF4-025 | M/L | Durable curve style settings + dictionary mnemonic assignment |
| 27 | BF4-005 | L | Lithology discrete/fraction (multi-step) |
| 28 | BF4-026 | S | Simplify curve_type taxonomy: remove lithology_discrete/fraction types |
| 29 | BF4-029 | M/L | Edit tops redesign — click-to-place, DM context menu add, cursor tooltip |

---

## BF4-026: Simplify curve_type taxonomy (todo)

**Context**: BF4-005 introduced `lithology_discrete` and `lithology_fraction` as explicit
`curve_type` values. After review, the simpler two-type taxonomy is sufficient and cleaner.

**Decision**:
- `curve_type` has exactly two valid values: `continuous` and `discrete`.
- "Lithology fraction" behaviour = `continuous` curve + `lithology_code` set in visual config
  (`TrackConfig.curves[*].lithology_code`). This was already the pre-BF4-005 implementation.
- "Lithology discrete" behaviour = `discrete` curve + `lithology_set_id` filled in
  `curve_metadata`. The renderer checks `lithologyFillStyles` to determine whether to draw
  lithology blocks or plain discrete blocks.
- "Point" rendering mode = display option within `continuous` curves; will be a new value of
  `lineStyle` or a separate `renderMode` field in `CurveConfig`, not a curve type.

**Required changes**:

### Backend
- `schema.py`: revert `curve_type` column width back to `String(16)` and remove
  `'lithology_discrete'` and `'lithology_fraction'` from the docstring allowed values.
- `wells.py`: remove `'lithology_discrete'` and `'lithology_fraction'` from PATCH validation;
  migrate any existing rows with these values to `'continuous'` and `'discrete'` respectively
  in `migrate_schema()`.

### Frontend types
- `types/tracks.ts`, `types/well.ts`, `stores/wellDataStore.ts`: revert `curve_type` union to
  `'continuous' | 'discrete'`.

### CurveSettings
- Remove `'lithology_fraction'` and `'lithology_discrete'` options from Rendering dropdown.
- "Lithology composition" section (lithology code picker) shows when
  `containingTrack.track_type === 'lithology'` OR `!!selectedCurveConfig.lithology_code` —
  same as pre-BF4-005 behaviour.
- For `discrete` curves: show lithology mapping table when `curve.lithology_set_id` is set
  (same UI as the BF4-005 `lithology_discrete` section, but triggered by `lithology_set_id`
  presence, not by `curve_type`).

### DataTrack / renderer
- Remove `lithology_fraction` dispatch path (was a no-op since it still went to composition bands
  via `lithology_code`).
- Keep `drawLithologyDiscrete`; change dispatch condition in DataTrack from
  `style.curve_type === 'lithology_discrete'` to
  `style.curve_type === 'discrete' && !!curve.lithology_set_id`.

**Affected files**:
- `app/src/subsidence/data/schema.py`
- `app/src/subsidence/data/engine.py`
- `app/src/subsidence/api/wells.py`
- `frontend/src/types/tracks.ts`
- `frontend/src/types/well.ts`
- `frontend/src/stores/wellDataStore.ts`
- `frontend/src/components/layout/settings/CurveSettings.tsx`
- `frontend/src/components/logview/DataTrack.tsx`

**Complexity**: S — mostly revert of BF4-005 type additions; renderer condition change is one
line; no data migration needed in practice (no real data has `lithology_discrete` values yet).

**Verification**:
- `discrete` curve with `lithology_set_id` set → renders lithology blocks in DataTrack.
- `discrete` curve without `lithology_set_id` → renders plain discrete blocks.
- `continuous` curve with `lithology_code` in visual config → renders as fraction band in
  lithology track.
- PATCH curve with `curve_type='lithology_discrete'` → rejected with 422.
- Old projects with `curve_type='continuous'` or `'discrete'` → work unchanged.

---

## BF4-027: Unconformity model redesign — unified picks with hiatus_duration_ma (done)

### Context and motivation

Currently unconformities live in `formation_tops` with `kind='unconformity'` but with **inverted
age semantics**: `age_top_ma` holds the *younger* bound (when deposition resumed) and `age_base_ma`
holds the *older* bound (when the erosion surface formed). This is the opposite of the strat-top
convention where `age_top_ma` = age of the surface itself (the *older* bound of the interval
above it).

The consequence: the compute engine in `subsidence.py` has to invert the ages for unconformities
(`age_top = f.age_base_ma`), and there is a special `_is_undated_unconformity` path that skips
picks with missing or zero-gap ages. A separate CSV importer (`import_unconformities_csv`) and
toolbar button exist only to populate `age_top_ma`/`age_base_ma` after tops are loaded.
Unconformities are linked to nearby strat tops by writing the unconformity name into the strat
top's `note` field via `link_tops_to_unconformities` — a fragile side-channel.

### Goal

Make unconformities first-class picks with the **same age convention as strat tops**:

- `age_top_ma` = stratigraphic age of the erosion surface (the same meaning as for any pick).
- A new field `hiatus_duration_ma` (default `0.0`) = duration of missing time at this surface.
  If `0`, the unconformity is structurally present but carries no time gap (e.g. a diastem).
- `age_base_ma` for an unconformity is **not stored** — it is derived on demand as
  `age_top_ma - hiatus_duration_ma` if ever needed for display.
- `eroded_thickness_m` stays, default `0.0` — physical thickness of eroded section, used in
  backstripping as a ghost solid-matrix addition.

Remove the `note`-based linking mechanism and the separate unconformities importer entirely.
Unconformities can be imported as rows in the standard tops CSV (with `boundary_type=unconformity`
and optional age columns), or created/edited manually in the UI.

### New data model illustrated

```
Paleogene pick:      age_top_ma = 40 Ma  (kind='strat')
                     age_base [derived] = unconformity.age_top_ma − hiatus = 145 − 79 = 66 Ma

Jurassic uncf.:      age_top_ma = 145 Ma  (kind='unconformity')
                     hiatus_duration_ma = 79 Ma  (entire Cretaceous eroded)
                     eroded_thickness_m = X m
                     age_base [derived] = 66 Ma  (= 145 − 79, when Paleogene deposition began)

Jurassic pick:       age_top_ma = 201 Ma  (kind='strat')
                     age_base [derived] = 251 Ma  (= next strat pick below, Triassic)
```

In backstripping the 79 Ma Cretaceous gap appears automatically: the Paleogene interval ends at
66 Ma (not 145 Ma), and the next active interval starts at 145 Ma (the Jurassic unconformity
surface), leaving a 79 Ma void between them.

---

### BF4-027-A: Schema and data migration

**`app/src/subsidence/data/schema.py`**

Add to `FormationTopModel`:
```python
hiatus_duration_ma: Mapped[float] = mapped_column(Float, default=0.0, server_default='0.0')
```

`age_base_ma` stays in the schema (used by strat tops) but is no longer written for
unconformities after this change.

**`app/src/subsidence/data/engine.py`** — add migration:
```python
_run_if_missing(conn, 'formation_tops', 'hiatus_duration_ma',
    "ALTER TABLE formation_tops ADD COLUMN hiatus_duration_ma REAL NOT NULL DEFAULT 0.0")
```

Then migrate existing unconformity rows (old semantics → new semantics):
```python
conn.execute(text("""
    UPDATE formation_tops
    SET    hiatus_duration_ma = COALESCE(age_base_ma, age_top_ma) - COALESCE(age_top_ma, 0),
           age_top_ma         = COALESCE(age_base_ma, age_top_ma),
           age_base_ma        = NULL
    WHERE  kind = 'unconformity'
      AND  age_top_ma IS NOT NULL
      AND  age_base_ma IS NOT NULL
      AND  age_base_ma > age_top_ma
"""))
```

This converts: old `age_top_ma`=66 Ma (young), old `age_base_ma`=145 Ma (old) →
new `age_top_ma`=145 Ma, `hiatus_duration_ma`=79 Ma, `age_base_ma`=NULL.

Unconformity rows without valid ages are left with `hiatus_duration_ma=0` and whatever
`age_top_ma` they had.

---

### BF4-027-B: Compute engine — `subsidence.py`

**File**: `app/src/subsidence/api/subsidence.py`

Replace the `_is_undated_unconformity` helper and the age-resolution block (lines ~152–177)
with the new logic:

```python
def _unconformity_is_active(pick: FormationTopModel) -> bool:
    """Unconformity counts for backstripping if it has a known surface age."""
    return pick.kind == 'unconformity' and pick.age_top_ma is not None

for idx, f in enumerate(formations):
    next_f = formations[idx + 1] if idx + 1 < len(formations) else None
    base_m = next_f.depth_md if next_f is not None else max(td_m, f.depth_md + 1.0)

    # age_top of this interval — same convention for both strat and unconformity
    age_top = f.age_top_ma

    # age_base of this interval = age of the surface below
    if next_f is None:
        age_base = None
    elif next_f.kind == 'unconformity' and next_f.age_top_ma is not None:
        # Pick above an unconformity ends at the age when deposition resumed:
        #   unconformity.age_top_ma − hiatus_duration_ma
        age_base = next_f.age_top_ma - (next_f.hiatus_duration_ma or 0.0)
    else:
        age_base = next_f.age_top_ma

    inputs.append(FormationInput(
        name=f.name,
        color=f.color,
        lithology=f.lithology or '',
        age_top_ma=age_top,
        age_base_ma=age_base,
        current_top_m=f.depth_md,
        current_base_m=base_m,
        water_depth_m=f.water_depth_m,
    ))
```

No inversion needed: the unconformity's interval in `FormationInput` runs from `age_top_ma`
down to `next_strat_pick.age_top_ma`, representing the eroded/missing section.
`eroded_thickness_m` is applied in `ZoneLayerInput` (zone-based path); for the picks-only path
it is not yet modelled — separate future item.

**Zone-based path** (`build_zone_layer_inputs` in `zone_service.py`): this path reads ages
directly from `TopSetHorizon.age_ma`, not from `FormationTopModel`. It is **not affected** by
the unconformity semantic change. Verify after migration that zone-based burial charts produce
the same output as before.

---

### BF4-027-C: Backend importers

**`app/src/subsidence/data/importers/tops.py`**

In `import_tops_csv`, extend the unconformity row handling:

```python
is_unconformity = boundary_type == 'unconformity'
age_ma = _extract_float(row, 'age_ma', 'strat_age_ma')
hiatus_ma = _extract_float(row, 'hiatus_duration_ma', 'hiatus_ma') or 0.0
eroded_m = _extract_float(row, 'eroded_thickness_m', 'eroded_m') or 0.0

top = FormationTopModel(
    ...
    kind='unconformity' if is_unconformity else 'strat',
    age_top_ma=age_ma,           # same convention for both
    age_base_ma=None,            # not stored; derived if needed
    hiatus_duration_ma=hiatus_ma if is_unconformity else 0.0,
    eroded_thickness_m=eroded_m if is_unconformity else 0.0,
    ...
)
```

Remove `import_unconformities_csv` and `link_tops_to_unconformities` functions from `tops.py`
entirely.

**`app/src/subsidence/data/importers/common.py`**

Remove two helper functions that only served the note-based linking mechanism:
- `_merge_note(note, unconformity_ref)` — wrote `unconformity_ref=X` into the note field
- `_extract_note_unconformity_ref(note)` — parsed that value back out

Also remove their call sites in `tops.py` (`_merge_note`, `_extract_note_unconformity_ref`).

**`app/src/subsidence/data/models.py`**

Remove the following dead models (only used by `link_tops_to_unconformities`):
- `TopLink` dataclass (fields: `well_name`, `top_name`, `unconformity_name`, `top_depth`,
  `unconformity_md`, `link_method`)
- `LinkResult` dataclass (if present)
- `unconformity_ref: str | None` field from any model that held it
- `BoundaryType.UNCONFORMITY` validation that required `unconformity_ref`

**`app/src/subsidence/data/importers/__init__.py`**

Remove `import_unconformities_csv` and `link_tops_to_unconformities` from exports.

**`app/src/subsidence/api/projects_imports.py`**

- Remove `import_unconformities_csv`, `link_tops_to_unconformities` imports.
- Remove the `import_unconformities` endpoint.
- Remove the `link_tops_to_unconformities(session, target_well_id)` call from the tops import
  handler (line ~194).

**`app/src/subsidence/api/projects.py`**

- Remove `ImportUnconformitiesRequest` and `ImportUnconformitiesResponse` classes.

---

### BF4-027-D: Frontend mapping fields

**`frontend/src/components/layout/importWizard/mapping.ts`**

Remove `UNCONFORMITIES_FIELDS`, `validateUnconformitiesMapping`.

Extend `TOPS_FIELDS` with optional columns:
```ts
export const TOPS_FIELDS: FieldDefinition[] = [
  { id: 'top_name',           label: 'Formation name',    required: true,  aliases: [...] },
  { id: 'depth_md',           label: 'Depth (MD)',         required: true,  aliases: [...] },
  { id: 'well_name',          label: 'Well name',          required: false, aliases: [...] },
  { id: 'boundary_type',      label: 'Boundary type',      required: false, aliases: ['boundary_type', 'kind', 'type'] },
  { id: 'age_ma',             label: 'Age (Ma)',           required: false, aliases: ['age_ma', 'strat_age_ma', 'age'] },
  { id: 'hiatus_duration_ma', label: 'Hiatus duration (Ma)', required: false, aliases: ['hiatus_duration_ma', 'hiatus_ma', 'hiatus'] },
  { id: 'eroded_thickness_m', label: 'Eroded thickness (m)', required: false, aliases: ['eroded_thickness_m', 'eroded_m', 'eroded'] },
]
```

---

### BF4-027-E: Backend PATCH endpoint — `formations.py`

**`app/src/subsidence/api/formations.py`**

`FormationTopPatch` currently has `age_base_ma: float | None`. Replace with
`hiatus_duration_ma: float | None = None` for the new field, and keep `age_base_ma` as
deprecated-but-accepted (or remove it — no frontend will send it after this change).

```python
class FormationTopPatch(BaseModel):
    ...
    age_ma: float | None = None
    hiatus_duration_ma: float | None = None  # new; replaces age_base_ma for unconformities
    is_locked: bool | None = None
    water_depth_m: float | None = None
    eroded_thickness_m: float | None = None
```

Add to the PATCH field map:
```python
'hiatus_duration_ma': ('hiatus_duration_ma', body.hiatus_duration_ma),
```

`FormationTopResponse` — add `hiatus_duration_ma: float` (default `0.0`), sourced from
`row.hiatus_duration_ma`. Keep `age_base_ma` in the response for now (strat tops may use it
in the future); for unconformities it will be `None` after migration.

**`app/src/subsidence/data/undo.py`**

The undo tracker currently snapshots `age_top_ma` only. Add `hiatus_duration_ma` to the
captured snapshot and restore it on undo:

```python
# in capture:
previous[formation.id] = {
    'color': formation.color,
    'age_top_ma': formation.age_top_ma,
    'hiatus_duration_ma': formation.hiatus_duration_ma,  # new
    'had_link': ...,
}

# in apply (undo):
formation.age_top_ma = change['old_age_top_ma']
formation.hiatus_duration_ma = change.get('old_hiatus_duration_ma', 0.0)  # new
```

**`app/src/subsidence/data/strat_link.py`**

`auto_link_to_active_chart` looks up a StratUnit by `formation.age_top_ma`. After migration,
an unconformity's `age_top_ma` is the **older** surface age (e.g. 145 Ma for J/K boundary)
instead of the younger bound (66 Ma). The linked StratUnit will now be the Jurassic period
rather than the Paleogene — which is the geologically correct result. No code change needed,
but verify with an existing project that unconformity picks receive the right strat unit color.

---

### BF4-027-F: Frontend UI — TopPickSettings

**`frontend/src/components/layout/settings/TopPickSettings.tsx`**

For `kind === 'unconformity'` rows, replace the `age_base_ma` input with `hiatus_duration_ma`:

```
Age (Ma)             [age_top_ma input]       ← label unchanged ("Top age (Ma)")
Hiatus duration (Ma) [hiatus_duration_ma]     ← replaces "Base age (Ma)"
Eroded thickness (m) [eroded_thickness_m]     ← unchanged
```

Optionally show a read-only derived label below:
`Deposition resumed: {(age_top_ma - hiatus_duration_ma).toFixed(1)} Ma`

Update the `onFormationUpdate` patch interface:
```ts
patch: {
  name?: string
  age_ma?: number
  hiatus_duration_ma?: number   // new; replaces age_base_ma
  kind?: string
  color?: string
  water_depth_m?: number
  eroded_thickness_m?: number
}
```

---

### BF4-027-G: Frontend UI — remove unconformities import

**`frontend/src/components/layout/ProjectToolbar.tsx`**

- Remove `'load-unconformities'` from `DialogKind` union.
- Remove the `ImportUnconformitiesDialog` import and `case 'load-unconformities'` render.
- Remove the "Load unconformities" button from the toolbar action row.

**`frontend/src/components/layout/ImportUnconformitiesDialog.tsx`** — delete file.

**`frontend/src/components/layout/index.ts`** — remove `ImportUnconformitiesDialog` export.

**`frontend/src/components/layout/importWizard/importWizardPresets.ts`** — remove
`unconformities` preset entry.

---

### BF4-027-H: Frontend types

**`frontend/src/types/well.ts`**

Add `hiatus_duration_ma: number` to `FormationTop`. Keep `age_base_ma?: number | null` for
strat tops (sourced from backend response), but it will be `null` for all unconformity rows
after migration.

---

### Affected files summary

| File | Sub-item | Change |
|---|---|---|
| `app/src/subsidence/data/schema.py` | A | Add `hiatus_duration_ma` column |
| `app/src/subsidence/data/engine.py` | A | Migration: add column + convert existing rows |
| `app/src/subsidence/api/subsidence.py` | B | New age resolution logic; no change to zone path |
| `app/src/subsidence/data/importers/tops.py` | C | Read hiatus/eroded fields; remove `import_unconformities_csv`, `link_tops_to_unconformities` |
| `app/src/subsidence/data/importers/common.py` | C | Remove `_merge_note`, `_extract_note_unconformity_ref` |
| `app/src/subsidence/data/models.py` | C | Remove `TopLink`, `LinkResult`, `unconformity_ref` |
| `app/src/subsidence/data/importers/__init__.py` | C | Remove unconformities/link exports |
| `app/src/subsidence/api/projects_imports.py` | C | Remove unconformities endpoint + link call |
| `app/src/subsidence/api/projects.py` | C | Remove unconformities request/response models |
| `app/src/subsidence/api/formations.py` | E | Add `hiatus_duration_ma` to PATCH + response |
| `app/src/subsidence/data/undo.py` | E | Track `hiatus_duration_ma` in undo snapshots |
| `app/src/subsidence/data/strat_link.py` | E | No code change; verify strat link behavior |
| `frontend/src/types/well.ts` | H | Add `hiatus_duration_ma` field to `FormationTop` |
| `frontend/src/components/layout/importWizard/mapping.ts` | D | Remove `UNCONFORMITIES_FIELDS`; extend `TOPS_FIELDS` |
| `frontend/src/components/layout/settings/TopPickSettings.tsx` | F | Replace `age_base_ma` with `hiatus_duration_ma` |
| `frontend/src/components/layout/ProjectToolbar.tsx` | G | Remove unconformities dialog + button |
| `frontend/src/components/layout/ImportUnconformitiesDialog.tsx` | G | **Delete** |
| `frontend/src/components/layout/index.ts` | G | Remove unconformities dialog export |
| `frontend/src/components/layout/importWizard/importWizardPresets.ts` | G | Remove unconformities preset |

**Complexity**: L — schema migration + compute change + remove a complete import path.
Implement in order: A → B → C → E → D/F/G/H. Test compute on an existing project with
unconformities before and after migration to verify burial charts are numerically identical.

---

### Verification

- Existing project with unconformities: burial chart output must be numerically identical before
  and after migration (old `age_base_ma=145` → new `age_top_ma=145, hiatus=79`).
- Tops CSV with `boundary_type=unconformity, age_ma=145, hiatus_duration_ma=79` → creates
  unconformity row with correct field values.
- TopPickSettings for an unconformity pick: shows Age + Hiatus duration + Eroded thickness;
  no "Base age" input; editing any field PATCHes correctly.
- "Load unconformities" button gone from toolbar.
- Unconformity with `hiatus_duration_ma=0` → compute treats it as a zero-gap boundary
  (Paleogene ends at the unconformity surface age, no missing time).

**Implemented**:
- Added `formation_tops.hiatus_duration_ma` with migration from old inverted
  `age_top_ma`/`age_base_ma` unconformity semantics.
- Updated picks-only subsidence age resolution to use unified pick ages and derive the hiatus end
  from `age_top_ma - hiatus_duration_ma`.
- Removed the separate unconformities CSV importer, API endpoint, frontend dialog, toolbar button,
  mapping fields, and note-based top/unconformity linking helpers.
- Extended standard tops CSV import, formation PATCH/response types, frontend formation types, and
  TopPickSettings to use `hiatus_duration_ma`.
- Added backend coverage for importing unconformities through the standard tops CSV path.

**Verified**:
- `python -m compileall app/src/subsidence`
- `python -m pytest app/tests` (`80 passed`)
- `npm run build`

---

## BF4-028: Stratigraphy model redesign — TopSet as primary object, merge-by-marker-name import (done)

### Bug that triggered this

Loading tops twice into the same well created duplicate records even when "Create new ZoneSet" was
selected — the second import appended rather than merged. Loading a third time with a new name
renamed the existing set rather than creating a new one. Result: three copies of every marker at
slightly different depths.

Root cause: `import_tops_csv` always inserts new `FormationTopModel` rows; there is no
deduplication by marker name within a TopSet. The "create new ZoneSet" option creates a new set
but the insert loop still appends without checking for existing rows with the same `top_name`.

---

### Proposed redesign

#### Naming

Rename the primary stratigraphy collection from **ZoneSet** → **TopSet** everywhere (schema
column names, API fields, frontend labels). TopSet better reflects the source of truth: it is a
named set of formation tops (markers). Zones are derived from the intervals between markers and
are not stored independently.

#### Data model (project-level vs per-well)

A `TopSet` is a **project-level** object. It defines a list of named markers (horizons)
that may appear in multiple wells. Each well has its own depth value per marker, stored in
`FormationTopModel` (one row per well × marker × TopSet).

This is close to the current `TopSet` / `TopSetHorizon` / `FormationTop` structure in the
zone-based path. The redesign unifies both paths (direct pick workflow + zone workflow) under
this single model.

#### Import behaviour — merge by marker name

When importing a tops CSV into a TopSet:

- Match existing rows by `(well_id, zone_set_id, top_name)` (or `well_name` when using file well).
- If a matching row exists → **update** its depth and attributes (overwrite, no duplicate).
- If no matching row exists → **insert** as a new marker.
- The "Create new TopSet" option in the import dialog creates a brand-new TopSet first, then
  merges into it (so importing into an empty set is always clean).

This makes re-importing idempotent: running the same file twice produces the same state.

#### Data Manager tree structure

```
WELLS
  └─ Well A
  └─ Well B

STRATIGRAPHY
  └─ Regional Cretaceous     ← TopSet (project-level)
       ├─ Quaternary         ← marker / horizon
       │  └─ Quaternary -> Paleogene     ← derived zone below this marker
       ├─ Paleogene
       │  └─ Paleogene -> Cretaceous
       └─ Cretaceous
  └─ Local Jurassic          ← another TopSet
```

Clicking a TopSet in the tree selects it; its markers and derived zones appear in the settings
panel.

#### Data Manager visibility controls

The Data Manager tree is the primary visual control surface for TopSet rendering:

- TopSet checkbox toggles all child markers and zones.
- Marker checkbox toggles marker-line rendering.
- Zone checkbox toggles interval-fill rendering.

The underlying data is the same; these checkboxes only change visibility. Settings panels inspect
the selected object and should not own this visual mode.

---

### Design decisions

1. **TopSet scope** — a TopSet is a **project-level** named object (e.g. "my_strat"). It holds a
   list of markers (named horizons: "Cretaceous", "Paleogene", "Quaternary") and depth values for
   those markers per well. Multiple wells can belong to the same TopSet: loading tops from Well B
   into "my_strat" adds Well B's depths alongside Well A's. Markers are shared by name; depths are
   per-well. The `stratigraphy` section in the Data Manager tree is simply the grouping label for
   all TopSets in the project (not a stored entity itself).

2. **Data Manager owns visibility** — marker and zone visibility is controlled by checkboxes in
   the TopSet tree. Marker checkboxes affect marker lines; zone checkboxes affect interval fills.
   Settings panels inspect selected markers/zones but do not own visual mode switching.

3. **Delete behaviour** — deleting a marker from a TopSet removes it for **all wells** in that
   TopSet (the marker is a shared project-level concept). Removing a marker from a single well
   only is done via the Settings panel or the formation-top track in the Well Log view — not via
   the TopSet tree.

4. **TopSet visibility persistence** — marker visibility reuses per-well formation visibility;
   zone visibility is stored in the per-well visual config. Defaults: markers off unless enabled
   through `TOPS` / TopSet marker checkboxes, zones on unless hidden.

---

### Affected areas (preliminary)

| Area | Change |
|---|---|
| `schema.py` | Rename `zone_set_*` columns/tables to `top_set_*`; confirm Zone table fate |
| `engine.py` | Migration: rename columns; no data loss |
| `importers/tops.py` | Replace insert-only with upsert-by-marker-name |
| `api/projects_imports.py` | Update import handler for upsert logic |
| `WellDataPanel.tsx` | Restructure tree: WELLS section + STRATIGRAPHY section |
| `ImportTopsDialog.tsx` | "TopSet" label; dropdown options updated |
| Settings panel | Inspect selected TopSet / marker / zone objects |
| Log viewer | Marker checkboxes render marker lines; zone checkboxes render interval fills |

**Complexity**: XL — touches schema, import logic, data manager UI, settings, and log viewer.
Resolve the open questions above before starting implementation.

---

### Implemented so far

- Tops import is idempotent when importing into a TopSet:
  - existing horizons are matched by normalized marker name;
  - existing picks are matched by `(well_id, horizon_id)`;
  - repeated import updates depth/age/color/attributes instead of appending duplicate picks.
- Importing into an existing TopSet can add missing markers as new `TopSetHorizon` rows.
- Creating a new TopSet during import now creates the TopSet before merge/upsert, instead of
  inserting all picks first and extracting horizons afterwards.
- Data Manager now presents project-level stratigraphy as `STRATIGRAPHY -> TopSet -> marker -> zone below`;
  marker rows show a stratigraphy color marker, and zone rows use the stratigraphy color as their
  row background. Unconformity markers keep the existing red emphasis.
- User-facing labels in the import dialog, Data Manager, model settings, and TopSet settings now
  use `TopSet` wording instead of `ZoneSet`.
- Data Manager owns TopSet visual control: marker checkboxes toggle marker lines; zone checkboxes
  toggle interval fills.
- TopSet settings now own shared label controls for stratigraphy rendering: marker labels,
  marker label position, zone labels, and zone label position.
- TopSet marker visibility reuses per-well formation visibility; TopSet zone visibility is stored
  as `hiddenTopSetZoneIds` in the per-well visual config.
- The log viewer now renders marker lines and zone fills from separate visibility inputs, so a
  marker checkbox no longer implicitly controls interval fill visibility.
- Per-well `WELLS -> TOPS` was removed from the Data Manager tree; TopSet markers are now managed
  from `STRATIGRAPHY` only.
- Stratigraphy marker/zone rows no longer show linked-well statistics. Marker rows expose a delete
  action that removes the shared TopSet marker.
- TopSet rows expose a delete action that removes the whole TopSet, including active well links,
  linked top picks, horizons, zones, and zone well data.
- Added regression coverage for repeated tops import into the same TopSet.

### Verification

- `python -m compileall app/src/subsidence`
- `python -m pytest app/tests` (`81 passed`)
- `npm run build`
- `npx vitest run` (`48 passed`)

---

## BF4-029: Edit tops redesign — click-to-place, DM context menu add, cursor tooltip (done)

**Background**: The previous BF4-010 implementation added Add top / Set type / Set age / Link top
buttons to the side toolbar, but this was wrong. All per-top attribute editing (type, age,
strat link) already lives in the Settings panel when a top is selected. The "Add top" button's
direct-add-at-cursor behaviour bypasses the stratigraphy structure. This contract replaces that
approach with a structure-aware workflow.

### What was removed (done as part of this contract)

- Removed from `WellViewerToolbar`: Add top, Link top, Set age, Set type.
- `WellViewerToolbar` now contains only view controls (Overview, Tooltip, Edit tops, Fit well,
  Fit data) and zoom presets (1:200, 1:500, 1:1000).

### New Add top workflow

Tops are created from the Data Manager tree context menu, not from a toolbar button.

**ПКМ on a marker row in the TopSet tree:**
- "Add top above" — creates a new empty pick (depth_md = null) immediately above the
  selected marker in sort order; new marker gets an auto-name.
- "Add top below" — same, immediately below.

**ПКМ on a zone row in the TopSet tree:**
- "Add top inside" — creates a new empty pick (depth_md = null) that splits the zone;
  the zone is replaced by two new zones separated by the new marker.

After creation the new pick is automatically selected (becomes the active object in the
workspace). It has null depth and will not render as a positioned line until depth is assigned.

### Assigning depth to an empty pick via Edit tops mode

When Edit tops mode is active (`interactionMode === 'edit-tops'`):

1. **Click on empty track space** — if there is a currently selected empty pick (depth_md = null),
   that click assigns depth_md to it at the clicked depth. If no empty pick is selected, a click
   creates a new pick in the active TopSet at that depth (auto-name "Top N"). If the current well
   has no active TopSet, show an inline error/toast telling the user to choose an active TopSet.
   If no marker is selected and the click is inside an existing zone, insert the new marker inside
   that zone and split it. If a marker is selected but this well has no pick for that marker, a
   valid click between its bounding markers creates the missing pick and splits the zone
   consistently with wells that already have that marker.

2. **Hover over an existing pick line** — cursor becomes ↕ (ns-resize), the pick becomes the
   active pick. Drag moves it.

3. **Stratigraphic validation on placement**: if the clicked depth would place the new or moved
   pick outside its valid interval (e.g., below the lower bounding marker of its zone, or above
   the upper bounding marker), placement is rejected with an inline error toast. Picks without a
   zone constraint (outermost markers) are not validated against other TopSet markers. Validation
   is based on the nearest TopSet marker above and below the target marker/zone. If only one bound
   exists, validate against that single bound and still allow creating the corresponding zone. If
   both bounds are absent, allow placement.

4. **Cursor tooltip**: while Edit tops is active and there is an active (selected) pick, a
   floating label follows the horizontal depth cursor:
   - Content: the pick's name.
   - Style: black text, background = the pick's zone color (or marker color if no zone).
   - Rendered above the depth cursor line so it is always visible.
   - Disappears when Edit tops mode is off or no pick is selected.

### Settings panel (no change needed)

Set type, Set age, Link top remain in the Settings panel (TopPickSettings). They are accessible
by selecting any pick — either via the Data Manager tree or by clicking its line in the track.

### Affected files

- `frontend/src/components/layout/DataManagerPane.tsx` — add ПКМ context menu items for
  marker and zone rows: "Add top above", "Add top below", "Add top inside"
- `frontend/src/components/layout/WellDataPanel.tsx` — expose `onContextMenuZone` prop and
  emit zone context menu events from zone rows
- `app/src/subsidence/api/top_sets.py` or `formations.py` — new endpoint to create an empty
  pick in a TopSet: `POST /api/top-sets/{top_set_id}/picks` with `{ well_id, insert_before_horizon_id | insert_after_horizon_id | split_zone_id }`
- `frontend/src/components/interaction/InteractionOverlay.tsx` — handle click-on-empty-space in
  edit-tops mode; validate against zone bounds; call add-pick or assign-depth
- `frontend/src/components/interaction/FormationTopLine.tsx` — render cursor tooltip when edit
  mode is active and pick is selected

**Complexity**: M/L — new backend endpoint, DM context menu extension, interaction layer changes,
cursor tooltip rendering.

**Verification**:
- ПКМ on a marker in the TopSet tree shows "Add top above" / "Add top below"; created pick is
  selected and has null depth; it does not render a line in the track.
- ПКМ on a zone in the TopSet tree shows "Add top inside"; zone splits into two; new pick is
  selected.
- In Edit tops mode, clicking on the track assigns depth to the selected empty pick; the line
  appears at the clicked position.
- Clicking outside the valid zone interval shows an error and does not move the pick.
- Cursor tooltip appears when Edit tops is active and a pick is selected; it follows the cursor.

### Implemented so far

- Added `POST /api/top-sets/{top_set_id}/picks` for structure-aware TopSet pick creation:
  insert above marker, insert below marker, split zone, or append to active TopSet.
- Data Manager TopSet marker rows expose context menu actions `Add top above` / `Add top below`.
- Data Manager TopSet zone rows expose context menu action `Add top inside`.
- Created picks are selected immediately and made visible in the active well view.
- Edit tops mode can assign depth to the selected pick; placement is constrained by nearest
  TopSet markers above/below when available.
- Edit tops mode can create a new top by clicking inside an existing zone of the active TopSet.
- Clicking an existing top line now selects the same `top-pick` object used by the Settings panel.
- Cursor tooltip/ghost line now follows the depth cursor for the active pick in edit-tops mode.
