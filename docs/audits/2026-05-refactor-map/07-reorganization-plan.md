# Reorganization Plan

Staged refactoring — ordered from safest to most disruptive.

---

## Tier 1 — Pure refactors, zero behavior risk

Do these first. Each is a rename or extract with no logic change.

### R1: Extract shared API deps (5 files)
**What**: All 6 API modules have identical `_require_open_project` + `_manager` helpers.
**How**: Create `api/_deps.py`:
```python
def get_manager(request: Request) -> ProjectManager:
    return request.app.state.project_manager

def require_open_manager(request: Request) -> ProjectManager:
    m = get_manager(request)
    if not m.is_open:
        raise HTTPException(status_code=409, detail="No project open")
    return m
```
Then replace all 6 copies with imports.
**Risk**: None — pure rename. Tests should pass unchanged.

### R2: Make `_floor_match_horizon` public
**What**: Rename `_floor_match_horizon` → `floor_match_horizon` in `zone_service.py`.
Update the import in `formations.py`.
**Risk**: None — single rename.

### R3: Fix stale docs
**What**:
- Remove `projects_export.py` references from `docs/backend-api.md` and `docs/codebase-map.md`
- Add `GET /api/wells/{id}/curves/full` to docs
- Add `end_age_ma`/`start_age_ma` CSV convention note
- Add `WellModel.lat`/`lon` inversion note to `schema.py`
**Risk**: Zero.

---

## Tier 2 — Bug fixes, low blast radius

Fix these individually with tests before each change.

### R4: Fix waterDepthM WebSocket (B1)
**What**: In `api/subsidence.py:ws_recalculate`, read `water_depth_m` from payload
and pass as override to `_compute_subsidence`.
**Test first**: Add test that sends `water_depth_m=500` and verifies it affects the result.
**Risk**: Low — adds a new code path, doesn't touch existing path.

### R5: Fix merge_zones lithology_source (B3)
**What**: In `zone_service.py:merge_zones_on_horizon_delete`, copy `lithology_source`
from the primary zone instead of hardcoding `'manual'`.
**Risk**: Low — affects only the horizon-delete flow.

### R6: Add age validation warning to response (B4, BF5-002-C)
**What**: In `api/formations.py:update_formation`, instead of silently setting
`age_top_ma = None`, keep the value and add `{"warnings": ["age out of order..."]}` to response.
**Risk**: Low — additive change to response schema.

---

## Tier 3 — Structural, requires tests first

Don't touch these until Tier 1+2 are done and there are integration tests covering them.

### R7: Split `api/wells.py`
Current size: 968 lines, 15 endpoints, 20+ Pydantic models.
**Split into**:
- `api/wells_core.py`: list/get/patch/delete well, deviation
- `api/wells_curves.py`: curve CRUD (LOD + full)
- `api/wells_zones.py`: zone list/patch/recalculate
- `api/models/wells.py`: all Pydantic models for wells
**Safe order**: Extract models first (no logic change), then split endpoints.
**Risk**: Medium — router registration in `main.py` must be updated. Frontend routes unchanged.

### R8: Extract `update_formation` helpers
**What**: Break `api/formations.py:update_formation` (150 lines) into:
- `_resolve_depth(body, well) → depth_md`
- `_resolve_color(session, row, body) → (old_color, new_color, color_source)`
- `_validate_age(session, well_id, formation_id, age) → age_or_none, warning`
- `_apply_age_zero_water_depth(session, row, new_values) → None`
**Risk**: Medium — must preserve exact behavior. Write tests for each helper first.

### R9: Split `wellDataStore.ts`
Current size: 1210 lines. Mixes well data with project-level dictionaries.
**Split into**:
- `wellCoreStore.ts`: well, curves, formations, tvdTable, depthBasis
- `dictionaryStore.ts`: compaction models/presets, mnemonic sets, unit dimensions,
  lithology entries/sets/palettes, sea level curves, strat charts
**Why**: Dictionary data is project-level. Loading a new well should not re-seed dictionaries.
**Risk**: High — 90+ component files import from wellDataStore. Requires updating all imports.
  Do this last, with a compatibility re-export shim during migration.

---

## Tier 4 — Architecture decisions, not immediate

These require design decisions before implementation.

### R10: Consolidate dual subsidence code paths
**What**: Remove the legacy `FormationInput` path in `_compute_subsidence` (D7).
**Prerequisite**: All projects must have a TopSet. Need a migration that creates a default
TopSet from formations if none exists.

### R11: Proper inputs_hash for stale detection (B2)
**What**: Hash should include: sorted (formation_id, depth_md, age_top_ma, lithology) + 
sea_level_curve_id + water_depth_m override.
**Prerequisite**: First fix the waterDepthM wiring (R4), then hash the actual inputs.

### R12: Batch `activate_top_set_for_well` calls (B7)
**What**: When adding a horizon, collect all wells that need updating and run the pipeline
once per well in a single transaction rather than O(N) separate calls.
**Prerequisite**: Understand which callers need synchronous completion vs can defer.

---

## Priority order summary

```
Now (safe):
  R1 (extract _deps.py)
  R2 (floor_match_horizon public)
  R3 (fix stale docs)

Next sprint (with tests):
  R4 (waterDepthM bug — B1, most user-visible)
  R5 (merge zones lithology_source — B3)
  R6 (age validation warning — B4)

After BF5-002 merges:
  R7 (split wells.py)
  R8 (extract update_formation helpers)

Long-term:
  R9 (split wellDataStore)
  R10 (consolidate subsidence paths)
  R11 (proper inputs_hash)
  R12 (batch activate_top_set)
```
