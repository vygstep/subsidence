# Bug: TopSet Marker Rename Must Sync Linked Picks

Status: implemented

## Problem

When two or more wells use the same active TopSet, renaming a linked marker pick in one well updates the shared `TopSetHorizon.name`, but other wells can keep stale `FormationTopModel.name` values for picks linked to the same `horizon_id`.

This makes the same TopSet marker appear under different names across wells.

## Desired Model

TopSet marker identity is shared:

- `TopSet` owns shared marker set metadata.
- `TopSetHorizon` owns marker identity, name, age, color, kind, sort order.
- `FormationTopModel` stores per-well pick data, including `well_id`, depth fields, water depth, lithology, and other well-specific values.
- Linked picks use `FormationTopModel.horizon_id` to point at the shared marker.

## Expected Behavior

1. Renaming a linked pick (`FormationTopModel.horizon_id != null`) renames the shared `TopSetHorizon`.
2. All `FormationTopModel` rows with the same `horizon_id` get the same `name`.
3. Picks in other wells keep their own depths and well-specific fields.
4. Zones display the new marker name through their shared horizon references.
5. Renaming an unlinked pick (`horizon_id == null`) remains local to that well only.

## Non-goals

- No schema changes.
- No separate editable zone name field.
- No changes to depth, thickness, lithology, or active TopSet assignment semantics.

## Implementation Plan

1. Add backend integration coverage for linked marker rename across two wells.
2. Add backend integration coverage that unlinked pick rename remains local.
3. Update `formations.update_formation` so linked name changes propagate to every pick with the same `horizon_id`.
4. Ensure zone/inventory responses use the renamed horizon and refreshed pick names.
5. Run targeted backend tests.

## Verification

- Rename linked marker in well A.
- The same marker in well B shows the new name.
- Adjacent zone labels display the new marker name.
- Unlinked pick rename stays local.

Verified:

- `pytest tests/integration/test_project_api_workflows.py -k "linked_top_set_marker_rename_syncs_all_well_picks or unlinked_top_rename_stays_local"` - 2 passed.
- Manual UI check: Data Manager and Settings show the renamed marker across wells.
