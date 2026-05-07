# STRATIGRAPHY: Multiple TopSets in Data Manager

## Status

`todo`

## Problem

The Data Manager STRATIGRAPHY tree is currently derived from `active_top_set_id` in `/api/wells/inventory`.

This means only TopSets that are active for at least one well are visible. When a user creates or activates a new TopSet for a well, the previous TopSet still exists in the backend but disappears from STRATIGRAPHY because it is no longer active for that well.

## Desired Behavior

- STRATIGRAPHY should show all project TopSets, including inactive TopSets.
- Active TopSets should be visually distinguishable per well.
- A user should be able to select a TopSet and assign/activate it for the current well.
- Existing active-well zone and marker visibility controls should keep working.
- Deleting a TopSet should remain explicit and should not be confused with deactivating it for a well.

## Proposed Implementation Plan

### Step 1: Extend Frontend Data Sources

Files:

- `frontend/src/stores/wellDataStore.ts`
- `frontend/src/components/layout/useDataManagerController.ts`
- `frontend/src/components/layout/WellDataPanel.tsx`

Expected change:

- Load `/api/top-sets` for project-level TopSet summaries.
- Keep `/api/wells/inventory` as the source for active TopSet links, well picks, and zone data.

### Step 2: Render Inactive TopSets

Files:

- `frontend/src/components/layout/WellDataPanel.tsx`
- `frontend/src/__tests__/integration/DataManagerTree.integration.test.tsx`

Expected change:

- Render project TopSets even when no well currently has them active.
- Show inactive TopSets without active well marker/zone rows until a well is selected or the TopSet is assigned.
- Preserve current active TopSet marker/zone rendering for the active well.

### Step 3: Add Activate/Assign Workflow

Files:

- `frontend/src/components/layout/WellDataPanel.tsx`
- `frontend/src/components/layout/useDataManagerController.ts`
- `frontend/src/stores/wellDataStore.ts`

Expected change:

- Provide an explicit action to activate a TopSet for the selected well.
- Reuse existing backend endpoint `PUT /api/wells/{well_id}/active-top-set`.
- Refresh well inventory and active well data after activation.

## Verification

- `npm run test -- --run DataManagerTree.integration.test.tsx`
- Manual check: create two TopSets for one well, switch active TopSet, confirm both remain visible in STRATIGRAPHY.

## Non-Goals

- Do not change backend TopSet storage.
- Do not merge TopSets with the same marker names.
- Do not make inactive TopSet markers editable until the assign/active-well behavior is defined.
