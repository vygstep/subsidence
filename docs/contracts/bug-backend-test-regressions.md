# BUG: Backend Test Regressions

## Status

`todo`

Branch: `bug/backend-test-regressions`

## Current Test Baseline

Backend:

- Command: `pytest tests` in `app`
- Result: `85 passed, 11 failed`

Frontend:

- Command: `npm run test -- --run` in `frontend`
- Result: `49 passed`

## Problems

### 1. Explicit tops CSV colors are overwritten

`import_tops_csv()` reads explicit CSV colors and writes them to `FormationTopModel.color`, but new picks are created with `color_source='auto'`.

After import, `link_picks_to_horizons()` updates any `auto` color from the matched horizon or active strat chart. This overwrites user-supplied CSV colors during initial import and repeated import into an existing TopSet.

Failing test:

- `tests/integration/test_project_api_workflows.py::test_tops_import_into_top_set_is_idempotent`

Desired behavior:

- If a tops CSV row contains an explicit `color`, preserve that color and mark the pick as `color_source='user'`.
- If a tops CSV row does not contain an explicit `color`, keep automatic color behavior with `color_source='auto'`.
- Repeated import into the same TopSet updates depth, age, attributes, and explicit color without creating duplicate picks.

### 2. Duplicate imported ages are not normalized

The tops importer currently writes every parsed `age_ma` / `strat_age_ma` value directly to `FormationTopModel.age_top_ma`.

Existing tests require duplicate-age cleanup:

- for the same imported age, the shallowest pick keeps the age;
- deeper picks with the same age are set to `age_top_ma = None`;
- unique ages are unchanged.

Failing tests:

- `tests/integration/test_tops_import.py::test_duplicate_ages_shallower_keeps_age`
- `tests/integration/test_tops_import.py::test_three_same_ages_only_shallowest_keeps`

Desired behavior:

- Normalize duplicate ages during tops import after rows are parsed and before final flush/logging.
- Use measured depth ordering; the shallowest `depth_md` wins for each duplicate age.
- Preserve existing water-depth auto-set behavior for age `0.0`.
- Keep `qc_warnings` collection compatible with existing importer QC output.

### 3. Base curve is now required, but tests still expect old result count

`backstrip()` now returns an extra base curve for the deepest lower boundary. This is required product behavior and should remain.

Current implementation:

- creates `base_result` in `app/src/subsidence/data/backstrip.py`;
- returns `[base_result] + results`;
- API `/api/wells/{well_id}/subsidence` returns the base curve together with layer/zone curves.

Failing tests still expect the old two-result model:

- `tests/unit/test_backstrip.py::test_two_formation_returns_two_results`
- `tests/unit/test_backstrip.py::test_unknown_lithology_uses_default`
- `tests/unit/test_backstrip.py::test_zone_layer_input_returns_two_results`
- `tests/unit/test_backstrip.py::test_zone_layer_input_matches_formation_input`
- `tests/integration/test_project_api_workflows.py::test_zone004_legacy_path_requires_no_top_set`
- `tests/integration/test_project_api_workflows.py::test_zone004_zone_path_used_when_top_set_active`
- `tests/integration/test_project_api_workflows.py::test_zone004_zone_path_matches_legacy_for_single_lithology`
- `tests/integration/test_project_api_workflows.py::test_zone004_zones_without_lithology_use_default`

Desired behavior:

- Keep the base curve in `backstrip()` and API results.
- Update unit and integration tests to assert the new result count and the expected base curve name/path.
- Preserve existing equivalence assertions between legacy formation path and TopSet zone path for the actual layer/zone curves.
- Do not hide, remove, or make the base curve optional in this contract.

### 4. Create-new TopSet allows duplicate names during tops import

The tops import dialog has two distinct workflows:

- create a new TopSet;
- import into an existing TopSet by `zone_set_id`.

The backend currently accepts `create_zone_set=true` with a `zone_set_name` that already exists. Since `TopSet.name` is not unique, this creates another TopSet with the same display name. In the UI this looks like the existing TopSet was overwritten or corrupted because the active TopSet switches to a different id with the same name.

Desired behavior:

- `create_zone_set=true` with an existing TopSet name must be rejected.
- The response should clearly instruct the user to choose the existing TopSet or use a different name.
- Importing into an existing TopSet via `zone_set_id` remains allowed for the current well and for other wells.
- Do not auto-rename duplicate TopSets; require an explicit user choice.

### 5. Deleting a well can fail with related calculation results

The well delete route uses `RemoveWell`, which snapshots the well and then deletes the `WellModel`.

Most well-owned data is removed through ORM relationships or database cascades, but `calculation_results.well_id` is a direct foreign key without a `WellModel` relationship or `ON DELETE CASCADE`. If a well has stored calculation results, deleting the well can fail with a database integrity error and the frontend shows `Failed to delete well '<name>' (500)`.

Desired behavior:

- Deleting a well succeeds when the well has stored calculation results.
- Well-scoped calculation result rows are removed with the well.
- Result files owned only by the deleted well are removed from the project bundle.
- Undo/redo for `RemoveWell` remains coherent by snapshotting and restoring deleted result rows and files.

### 6. Creating a new TopSet can steal picks from an existing TopSet

The tops importer and TopSet activation link picks by name/horizon across all picks for the well. When a user imports tops into a newly created TopSet whose marker names match an existing TopSet, existing picks can be relinked to the new TopSet horizons instead of creating independent picks for the new TopSet.

Desired behavior:

- Importing into a new TopSet creates independent picks for that TopSet.
- Existing picks linked to another TopSet must keep their original `horizon_id`.
- Importing into an existing TopSet by `zone_set_id` still updates picks linked to that same TopSet.
- Unlinked picks may still be linked/imported into the selected TopSet.

### 7. Data Manager shows non-active TopSet picks inside the active TopSet

After independent picks are preserved for multiple TopSets, `/api/wells/inventory` still returns all tops for the well. The frontend STRATIGRAPHY tree builds the active TopSet from all `item.formations`, so picks linked to inactive TopSets can appear as duplicate markers in the active TopSet and break marker ordering.

Desired behavior:

- The active TopSet tree should include only markers belonging to that TopSet.
- Picks linked to another TopSet must not appear as extra markers under the active TopSet.
- Marker ordering should continue to follow active TopSet zone/horizon order.
- Showing all inactive TopSets is deferred to `docs/contracts/stratigraphy-multiple-topsets.md`.

## Implementation Plan

### Step 1: Preserve explicit imported colors

Files:

- `app/src/subsidence/data/importers/tops.py`
- existing tests in `app/tests/integration/test_project_api_workflows.py`

Expected change:

- Track whether `color` was explicitly present in the CSV row.
- Set `color_source='user'` for explicit colors.
- Set `color_source='auto'` when color is inferred from strat chart or fallback.
- On upsert/re-import, update `color_source` consistently with the incoming row.

### Step 2: Restore duplicate-age normalization

Files:

- `app/src/subsidence/data/importers/tops.py`
- existing tests in `app/tests/integration/test_tops_import.py`

Expected change:

- Before final flush/logging, group imported picks by non-null `age_top_ma`.
- For each age group with more than one pick, keep the age only on the shallowest `depth_md`.
- Set deeper duplicates to `None`.

### Step 3: Update base-curve tests

Files:

- `app/tests/unit/test_backstrip.py`
- `app/tests/integration/test_project_api_workflows.py`
- optionally `docs/modules/subsidence-panel.md` or `docs/modules/backend-data-layer.md` if behavior is not documented clearly.

Expected change:

- Update expected result counts from `2` to `3` where the base curve is required.
- Assert the base curve exists and is distinct from layer/zone curves.
- Keep comparisons focused on matching layer/zone curves when checking legacy-vs-zone equivalence.

### Step 4: Reject duplicate TopSet names on create

Files:

- `app/src/subsidence/api/projects_imports.py`
- `app/src/subsidence/api/top_sets.py`
- `app/tests/integration/test_project_api_workflows.py`

Expected change:

- Add a case-insensitive TopSet name uniqueness check for explicit create operations.
- Return `409 Conflict` when a duplicate name is submitted.
- Keep `zone_set_id=<existing id>` imports working as the supported way to append/load picks into an existing TopSet.

### Step 5: Delete wells with stored calculation results

Files:

- `app/src/subsidence/data/undo.py`
- `app/tests/integration/test_project_api_workflows.py`

Expected change:

- Include `CalculationResult` rows for the well in the `RemoveWell` snapshot.
- Include their `data_uri` files in the snapshot file payloads.
- Delete those rows before deleting the `WellModel`.
- Restore the rows and files on undo.
- Add an integration test that deletes a well with a stored calculation result and verifies the API returns success.

### Step 6: Scope TopSet pick linking to the selected TopSet

Files:

- `app/src/subsidence/data/importers/tops.py`
- `app/src/subsidence/data/zone_service.py`
- `app/tests/integration/test_project_api_workflows.py`

Expected change:

- When importing into a TopSet, only upsert picks already linked to horizons in that TopSet or unlinked picks.
- When activating/linking a TopSet, only relink picks that are unlinked or already linked to horizons in that TopSet.
- Add an integration test that imports the same marker names into two different TopSets and verifies both TopSets retain separate picks.

### Step 7: Scope active TopSet rendering in Data Manager

Files:

- `frontend/src/components/layout/WellDataPanel.tsx`
- `frontend/src/__tests__/integration/DataManagerTree.integration.test.tsx`

Expected change:

- Derive active TopSet horizon ids from active zones.
- Add markers from `item.formations` only when their `horizon_id` belongs to the active TopSet.
- Do not add unlinked or other-TopSet picks to the active TopSet STRATIGRAPHY tree.
- Add a frontend integration test that verifies inactive TopSet picks are not rendered as duplicate active markers.

## Verification

- `pytest tests` in `app`
- `npm run test -- --run` in `frontend`

## Non-Goals

- Do not remove the deepest base curve.
- Do not make the base curve optional.
- Do not change frontend rendering unless backend/API test updates reveal a concrete frontend contract mismatch.
- Do not commit `docs/contracts/bug-import-extends-well-td.md` in this branch unless explicitly requested.
