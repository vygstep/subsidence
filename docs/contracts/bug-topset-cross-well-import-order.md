# Bug: TopSet Cross-Well Import Order Stability

Branch: `bug/topset-cross-well-import-order`

## Status

`in_progress`

## Problem

Importing tops for one well into an existing TopSet, then importing tops for another
well into the same TopSet can corrupt the shared TopSet order and downstream
single-well subsidence display.

Observed with:

- `sample_data/BUR-2_tops.txt`
- `sample_data/DUN-99_tops.txt`

The two wells share some markers, but each also has markers missing from the
other well. New markers imported into an existing TopSet are currently appended
after existing horizons instead of being inserted into the correct stratigraphic
position. Zones are then rebuilt from the wrong `sort_order`, which can make
subsidence zones overlap and make marker ordering unstable.

## Existing Behavior To Preserve

- Imported picks with duplicate ages inside the same import are normalized by
  `_normalize_duplicate_imported_ages(...)`:
  - the shallower pick keeps the age;
  - deeper duplicate-age picks get `age_top_ma = None`.
- Pick-to-horizon linking prioritizes normalized name match.
- Age floor-match is used only as fallback when no name match exists.
- Manual top picking can insert before/after a horizon or split a zone.

## Product Rules

- A TopSet is a shared marker framework across wells.
- Importing tops into an existing TopSet must update picks for the target well
  without unexpectedly rewriting existing shared horizons.
- Existing horizons matched by name must keep their shared identity:
  - keep `id`;
  - keep `sort_order`;
  - do not overwrite shared `age_ma`, `kind`, or `color` from a later well import.
- New horizons imported into an existing TopSet must be inserted into a stable
  stratigraphic order:
  - first prefer insertion between neighboring existing markers found in the
    target well import sequence/depth order;
  - if multiple new markers fall between the same neighboring existing markers,
    order them by `age_ma`, falling back to imported depth and row order;
  - if neighbors cannot be resolved, fall back to global age ordering against
    existing TopSet horizons;
  - if age is missing too, append after the nearest available context without
    disrupting existing markers.
- After the shared TopSet horizon order changes, zones must be rebuilt once.
- After zones are rebuilt, all wells linked to that TopSet must be refreshed:
  - active TopSet link;
  - ghost picks;
  - zone well rows;
  - zone thickness;
  - auto lithology aggregation.
- Refresh must include wells where the TopSet is active and wells that already
  have picks linked to any horizon in the TopSet.

## Implementation Plan

### S1: Reproduce and lock the failure

- Add a backend integration test using BUR-2 and DUN-99 style tops.
- Import BUR-2 into a new TopSet.
- Import DUN-99 into the same existing TopSet.
- Assert that TopSet horizons are ordered stratigraphically, not by second import
  append order.
- Assert that BUR-2 still has valid zone inputs after DUN-99 import.

Status: done.

### S2: Stabilize existing horizon updates during import

- Change existing TopSet horizon match behavior in `import_tops_csv(...)`.
- Name-matched existing horizons must not be overwritten by later imports.
- Imported pick values for the target well still update normally.
- Keep duplicate-age normalization for imported picks.

Status: done.

### S3: Insert new imported horizons into correct order

- Add import-order placement for new horizons in existing TopSets.
- Use neighboring existing markers in the target well import sequence/depth order
  as the preferred insertion context.
- Use age ordering fallback when neighbor context is incomplete.
- Normalize resulting `sort_order` values to contiguous integers.

Status: done.

### S4: Refresh all linked wells after TopSet structure changes

- After horizon order or membership changes, rebuild zones once.
- Refresh all wells connected to the TopSet, not only the imported target well.
- Preserve manual zone lithology where existing merge/split policies already do.

Status: done.

### S5: Verification

- Backend tests pass.
- Frontend tests are run only if frontend code changes.
- Manual smoke:
  - import `BUR-2_tops.txt` into a new TopSet;
  - import `DUN-99_tops.txt` into the same TopSet;
  - marker order stays stratigraphic;
  - single-well subsidence for BUR-2 does not overlap after DUN-99 import;
  - both wells show expected active TopSet markers/zones.

Status: backend tests passed; manual smoke pending.

## Non-goals

- No frontend redesign.
- No changes to TopSet UI interactions except data correctness.
- No change to the duplicate-age import rule unless tests prove the existing
  behavior is inconsistent with the desired stratigraphic order.
