# REFACTOR-001: Documentation Normalization and Safe Cleanup

Separate branch from `main`.

## Status

`todo`

## Goal

Make the codebase easier to continue safely:

- reduce stale or conflicting documentation;
- collapse duplicate documentation layers into a clear canonical structure;
- remove low-risk duplicated helper code;
- record explicit product/architecture decisions before behavior changes;
- defer large structural splits until the app is more stable.

This contract is not a rewrite and not a broad structural refactor.

## Current Findings

### Documentation Drift

- `todo.md` has been normalized to point to this contract.
- Former `docs/maps/` audit files were moved to `docs/audits/2026-05-refactor-map/`
  so they no longer compete with canonical module docs.
- Active docs no longer reference non-existent `app/src/subsidence/api/projects_export.py`.
- `docs/modules/backend-api.md` documents `GET /api/wells/{well_id}/curves/full`.
- `docs/modules/backend-api.md` documents the strat chart CSV convention:
  `start_age_ma` = older/larger Ma, `end_age_ma` = younger/smaller Ma.
- `WellModel.lat`/`lon` have historical inverted semantics:
  `lon` stores X, `lat` stores Y. This is now noted near the schema fields.

### Code Organization

- API project-open helpers are duplicated across route modules:
  `wells.py`, `formations.py`, `top_sets.py`, `strat_chart.py`,
  `subsidence.py`, `sea_level.py`, `compaction.py`, `lithology_patterns.py`,
  and partially `projects.py`.
- `zone_service._floor_match_horizon` is imported by `api/formations.py`, so it is
  effectively public despite the private name.
- `api/wells.py` is still large: around 853 lines with Pydantic models and mixed endpoint groups.
- `api/compaction.py` is larger: around 1251 lines and should be treated as a future split target too.
- `frontend/src/stores/wellDataStore.ts` is around 1194 lines and has multiple dynamic imports to avoid store cycles.

### Confirmed Bugs

- `api/subsidence.py:ws_recalculate` ignores `water_depth_m` from the WebSocket payload.
- `api/subsidence.py:_store_results` hashes only `well_id`; `inputs_hash` does not represent real inputs.
- `zone_service.merge_zones_on_horizon_delete` creates merged `ZoneWellData` with
  `lithology_source='manual'`, which can freeze auto lithology after a horizon delete.

These are not all automatic fixes under this contract. `water_depth_m` and merged-zone
lithology both require explicit behavior decisions before implementation.

## Non-goals

- No frontend UI redesign.
- No model rewrite.
- No database schema change unless a specific later contract requires it.
- No `wellDataStore` split in the first branch.
- No removal of the legacy subsidence fallback path until a migration/default-TopSet decision is made.
- No `api/wells.py`, `api/compaction.py`, or store split in this contract.

## Stage 0: Documentation Normalization

Risk: zero.

Principle: keep one current source for each kind of knowledge. Do not keep parallel
maps and module docs that both claim to be canonical.

### D0.1 Fix active planning pointers

- Update `todo.md` so it points to this contract, not removed historical contracts.
- Keep `todo.md` compact: active items only.

Status: implementation done; backend test run pending.

### D0.2 Normalize `docs/maps/`

- Review each file in `docs/maps/`.
- Move durable information into canonical docs:
  - trigger/data/schema/API/settings guidance -> `docs/codebase-map.md` or `docs/modules/*`;
  - active risk list -> this contract or a dedicated active risk section;
  - stale audit details -> archive or remove.
- After consolidation, either:
  - remove `docs/maps/`, or
  - move it to an audit snapshot folder such as `docs/audits/2026-05-refactor-map/`.

Decision:

- `docs/maps/` should not remain a second permanent documentation layer unless the team
  explicitly decides it is canonical and updates `documentation-index.md` accordingly.

Status: done. The audit files were moved to `docs/audits/2026-05-refactor-map/`.

### D0.3 Fix stale backend docs

- Remove `projects_export.py` references from active docs.
- Add `GET /api/wells/{well_id}/curves/full` to `docs/modules/backend-api.md`.
- Add `start_age_ma`/`end_age_ma` CSV convention to `docs/modules/backend-api.md`.
- Add the `lat`/`lon` historical inversion note near `WellModel.lat`/`WellModel.lon` in `schema.py`.

Status: done.

Verification:

- `todo.md` and active `docs/contracts/` agree.
- No active docs reference `projects_export.py` except historical implemented contracts.
- `documentation-index.md` describes the current documentation structure.
- There is no unclear duplicate between `docs/maps/*` and `docs/modules/*`.

## Stage 1: Zero-behavior Refactors

Risk: low. These should preserve behavior exactly.

### R1: Extract shared API dependencies

Create `app/src/subsidence/api/_deps.py`:

```python
from fastapi import HTTPException, Request

from ..data.project_manager import ProjectManager


def get_manager(request: Request) -> ProjectManager:
    return request.app.state.project_manager


def require_open_project(request: Request) -> ProjectManager:
    manager = get_manager(request)
    if not manager.is_open:
        raise HTTPException(status_code=400, detail="No project is currently open")
    return manager


def manager_project_path(manager: ProjectManager) -> str | None:
    return str(manager.project_path) if manager.project_path else None
```

Replace local duplicated helpers where present:

- `api/wells.py`
- `api/formations.py`
- `api/top_sets.py`
- `api/strat_chart.py`
- `api/subsidence.py`
- `api/sea_level.py`
- `api/compaction.py`
- `api/lithology_patterns.py`
- evaluate `api/projects.py` separately because project-open semantics differ for some endpoints.

Verification:

- Backend tests pass.
- API smoke tests for open-project-required endpoints still return the same status/detail.

Status: done.

### R2: Make horizon floor matching public

Rename:

- `zone_service._floor_match_horizon` -> `zone_service.floor_match_horizon`

Update imports/call sites:

- `api/formations.py`
- internal uses in `zone_service.py`

Verification:

- Backend tests pass.
- No `_floor_match_horizon` references remain outside historical docs.

## Stage 2: Behavior Decisions Before Bug Fixes

Do not change behavior here until the decision is written down and confirmed.

### DEC-1: Water depth source of truth

Problem:

- `frontend/src/stores/computedStore.ts` sends `water_depth_m`.
- `api/subsidence.py:ws_recalculate` reads only `well_id`.
- Recalculation runs, but water-depth slider changes do not affect results.
- The app also has per-pick/per-zone paleobathymetry data. A global slider may be an
  override, a temporary scenario control, or stale UI.

Decision needed:

- Is the UI water-depth slider still a product feature?
- If yes, is it:
  - a temporary calculation override only;
  - persisted project/well setting;
  - or deprecated in favor of per-zone paleobathymetry?

Implementation only after decision:

- Add optional `water_depth_m` parameter to `_compute_subsidence`.
- In `ws_recalculate`, parse `water_depth_m` from payload and pass it to `_compute_subsidence`.
- Apply override only for the recalculation request. Do not persist it to DB from the slider.
- Preserve existing DB-driven per-zone/pick water depth when no override is supplied.

Test:

- WebSocket or direct compute-path test proving `water_depth_m=1000` produces different results from `water_depth_m=0`.

### DEC-2: Merged-zone lithology ownership

Problem:

- `merge_zones_on_horizon_delete` hardcodes `lithology_source='manual'` on the merged zone.
- Auto lithology aggregation skips non-auto zones, so merged zones can stop updating.
- This may be intentional protection if either source zone was manually edited.

Decision needed:

- If both source zones are `auto`, should the merged zone stay `auto`?
- If one source zone is `manual` and one is `auto`, should the merged zone be `manual`,
  `auto`, or ask/warn the user?
- If both source zones are `manual` with different fractions, what is the merge rule?

Likely rule to confirm:

- both `auto` -> merged `auto`;
- any `manual` -> merged `manual`, preserving the primary/manual fractions;
- future UI should make this visible to the user.

Implementation only after decision:

- Inspect adjacent `ZoneWellData` rows before delete.
- Choose the primary source by larger valid thickness where possible.
- If both source zones are `auto`, keep merged source as `auto`.
- If either source zone is manual and selected as primary, preserve manual.
- Keep `lithology_fractions` behavior explicit in the test.

Test:

- Horizon delete merges two auto zones and the merged `ZoneWellData.lithology_source` remains `auto`.
- Mixed manual/auto behavior is covered or explicitly documented.

## Future Structural Refactors

These are intentionally out of scope for the current cleanup branch. They should become
separate contracts after the application is more stable.

### F1: Split `api/wells.py`

Current state:

- Around 853 lines.
- Mixes Pydantic models, well CRUD, inventory, curves, zones, deviation, and delete endpoints.

Proposed split:

- `api/models/wells.py`: Pydantic models only.
- `api/wells_core.py`: list/get/patch/delete well and deviation endpoints.
- `api/wells_curves.py`: curve list/full/LOD/patch/delete endpoints.
- `api/wells_zones.py`: zone list/patch/recalculate endpoints.
- Update `api/main.py` router registration.

Safe order:

1. Extract models only.
2. Move one endpoint group at a time.
3. Keep route paths unchanged.

Verification:

- Backend API tests pass.
- Frontend tests pass.
- Manual smoke: project open, well switch, curve display, zone settings.

### F2: Extract `update_formation` helpers

Current state:

- `api/formations.py:update_formation` is large and mixes:
  depth conversion, color state, age validation, water-depth auto-fill, zone recalculation,
  TVD recalculation, undo command selection, and warnings.

Proposed helpers:

- `_resolve_depth(body, well) -> float | None`
- `_apply_color_changes(row, body) -> None`
- `_validate_age_order(session, well_id, formation_id, age) -> tuple[float | None, str | None]`
- `_apply_age_zero_water_depth(session, well, row, new_values) -> None`
- `_recalculate_linked_top_set_after_pick_change(...) -> None`

Verification:

- Add or update tests before extracting behavior.
- Existing age/color/depth/water-depth behavior must stay unchanged.

### F3: Split `api/compaction.py`

Current state:

- Around 1251 lines.
- Owns unit dimensions, measurement units, compaction presets/models, mnemonic sets,
  lithology dictionary, lithology sets, and lithology parameters.

This deserves its own contract because it is larger than `wells.py`.

### F4: Split `wellDataStore.ts`

Current state:

- Around 1194 lines.
- Mixes active well data, project-level dictionaries, visual refresh side effects,
  sea-level, TopSets, compaction models, lithology sets, and dynamic imports.

Potential split:

- `wellCoreStore.ts`
- `dictionaryStore.ts`
- `stratigraphyStore.ts`
- compatibility re-export shim from `wellDataStore.ts`

High risk. Requires broad frontend import migration.

### F5: Consolidate subsidence input paths

Current state:

- `_compute_subsidence` has TopSet/zone path and legacy raw `FormationInput` fallback.

Prerequisite:

- Decide whether every project must have a TopSet.
- If yes, add migration/default TopSet creation for legacy projects.

### F6: Real `inputs_hash`

Current state:

- `_store_results` hashes only `well_id`.

Fix should include:

- sorted picks/zones/lithology inputs;
- active sea-level curve and overrides;
- water-depth override if used;
- algorithm/model parameters.

This should follow B1, because water-depth override must be part of the hash semantics.

## Proposed Commit Order

1. Stage 0 docs alignment.
2. R1 shared API deps.
3. R2 public `floor_match_horizon`.
4. DEC-1 water-depth source-of-truth decision.
5. DEC-2 merged-zone lithology ownership decision.

Behavior fixes and structural splits should happen in follow-up contracts after the decisions.

## Verification Commands

Ask before running.

```bash
cd app
pytest tests
```

```bash
cd frontend
npm run test -- --run
```
