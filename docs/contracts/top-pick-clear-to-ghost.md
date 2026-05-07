# TOP PICK: Clear Linked Pick Back to Ghost

## Status

`todo`

## Problem

When an active TopSet is assigned to a well, the well can contain ghost picks for TopSet horizons that do not yet have a placed depth. A placed pick and a ghost pick should be two states of the same per-well marker slot.

Deleting a visible top pick from the track view should not remove the TopSet horizon or make future placement behave differently from first placement.

## Desired Behavior

### Keyboard Delete

When a visible top pick is selected/active in the track view and the user presses `Delete`:

- If the pick is linked to a `TopSetHorizon`, clear the pick back to ghost state:
  - `depth_md = null`
  - `depth_tvd = null`
  - `depth_tvdss = null`
  - keep `well_id`
  - keep `horizon_id`
  - keep marker identity and metadata
- If the pick is unlinked to a `TopSetHorizon`, delete the pick row physically.
- Clear active pick/selection in the UI.
- Refresh well data and Data Manager inventory.
- Recalculate current-well zone thickness/state after the clear/delete.

### Placement Lifecycle

For linked TopSet markers, placement should always follow the same lifecycle:

`ghost -> placed -> ghost -> placed`

The user experience for placing a marker should not depend on whether the marker was never placed before or was placed and then cleared.

## Non-Goals

- Do not delete `TopSetHorizon` rows.
- Do not delete or change picks in other wells.
- Do not solve separate management UI for null-depth ghost picks.
- Do not change TopSet assignment behavior.

## Implementation Plan

### Step 1: Read Existing Top Pick Flows

Files:

- `frontend/src/components/logview/LogViewPanel.tsx`
- `frontend/src/components/interaction/InteractionOverlay.tsx`
- `frontend/src/components/interaction/FormationTopLine.tsx`
- `frontend/src/hooks/useKeyboardShortcuts.ts`
- `frontend/src/stores/wellDataStore.ts`
- `app/src/subsidence/api/formations.py`
- `app/src/subsidence/api/top_sets.py`
- `app/src/subsidence/data/zone_service.py`

Confirm current behavior for selecting, dragging, creating, and deleting picks.

### Step 2: Backend Clear-to-Ghost Behavior

Expected change:

- Existing formation delete endpoint should clear linked picks to ghost state.
- Unlinked picks can still be physically deleted.
- Zone well data and zone thickness should be refreshed after clear/delete.

### Step 3: Frontend Delete Key

Expected change:

- `Delete` key should act on the currently active visible top pick in the active well.
- The action should call the existing pick delete/remove store method once backend semantics are correct.
- Ignore `Delete` when no active visible pick is selected.

### Step 4: Verification

- Place a TopSet marker on the track.
- Select it so it is active/ready for drag.
- Press `Delete`.
- Confirm the visible line disappears.
- Confirm the TopSet marker remains in Data Manager/settings as missing/ghost.
- Place the same marker again on the track.
- Confirm placement works exactly like first placement.
- Confirm other wells and TopSet horizons are unchanged.

Automated tests:

- Backend test for linked pick delete clearing depth and keeping `horizon_id`.
- Frontend/store or integration test for Delete key invoking the remove action for active pick.
