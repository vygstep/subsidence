# Bug: TopSet Row Should Open Per-Well Settings When Active

Status: implemented

## Problem

Clicking a TopSet row in `STRATIGRAPHY` now opens the generic `TopSetSettings` inspector. This regressed the previous per-well TopSet settings workflow:

- choose linked/current well;
- switch between marker and zone inspection;
- toggle marker labels;
- toggle zone labels.

The old controls still exist in `ZoneSettings`, but the tree selection no longer routes active TopSets there.

## Scope

Restore selection behavior without changing backend data or TopSet visibility semantics.

## Expected Behavior

1. Clicking a TopSet that is active for the current well opens per-well `zone-set` settings.
2. The settings panel shows the well selector, marker/zone inspect mode, marker label controls, and zone label controls.
3. Clicking an inactive TopSet opens generic `TopSetSettings` with status and activation controls.
4. Activating an inactive TopSet for the current well switches selection to per-well `zone-set` settings after activation.

## Non-goals

- No backend schema/API changes.
- No changes to marker or zone visibility logic.
- No changes to TopSet delete behavior.

## Verification

- Select active TopSet row in `STRATIGRAPHY`; old per-well settings are visible.
- Select inactive TopSet row; activation UI is visible.
- Activate inactive TopSet; per-well settings are selected.
- Existing Data Manager integration tests still pass.

Verified:

- `npm run test -- --run DataManagerTree.integration.test.tsx` - 18 passed.
