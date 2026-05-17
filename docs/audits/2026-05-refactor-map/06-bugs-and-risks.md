# Bugs, Risks, and Dead Code

Confirmed issues found during audit. Sorted by severity.

---

## Critical / Silent correctness bugs

### B1: waterDepthM slider has no effect on calculations
- **File**: `api/subsidence.py:ws_recalculate` (handler ignores `water_depth_m` from payload)
- **Frontend**: `computedStore.triggerRecalculation` sends `waterDepthM` via WebSocket
- **Effect**: User moves "Water depth" slider, recalculation fires, result is identical.
  No error, no warning. Silent no-op.
- **Fix needed**: Backend must read `water_depth_m` from WebSocket payload and pass it
  to `_compute_subsidence` as an override.

### B2: CalculationResult.inputs_hash is always the same
- **File**: `api/subsidence.py:_store_results:227`
- **Code**: `hashlib.sha256(well_id.encode()).hexdigest()[:32]`
- **Effect**: Stale result detection never triggers. `is_stale` is never set True.
  Every stored result looks "fresh" regardless of whether inputs changed.
- **Fix needed**: Hash should include formation ages+depths+lithology or a DB row version.

### B3: merge_zones_on_horizon_delete sets lithology_source='manual' unconditionally
- **File**: `data/zone_service.py:merge_zones_on_horizon_delete:343`
- **Effect**: After merging two zones (on horizon delete), the merged zone gets
  `lithology_source='manual'`. Subsequent auto-lithology aggregation skips it.
  The merged zone's lithology is frozen and never updated from curves.
- **Fix needed**: Copy `lithology_source` from the heavier/primary zone, or keep `'auto'`.

---

## Medium: silent failures

### B4: Age validation silently clears age (no client warning)
- **File**: `api/formations.py:update_formation:333-348`
- **Effect**: If user sets an out-of-order age (e.g. shallower formation gets older age
  than deeper one), the API sets `age_top_ma = None` without telling the client.
  The Settings panel shows the field cleared with no explanation.
- **Fix needed**: Return a warning in the response (BF5-002-C).

### B5: Parquet file missing → curve silently disappears
- **File**: `api/wells.py:_load_curve_maps`
- **Effect**: If a `.parquet` file is missing (moved, corrupted), the curve is silently
  excluded from the response. No error, no 404.
- **Fix needed**: Log a warning with the missing path.

### B6: restore_checkpoint loses the before-restore checkpoint record
- **File**: `data/project_manager.py:restore_checkpoint:291`
- **Effect**: `restore_checkpoint` creates a "before-restore" checkpoint in the old DB,
  then swaps to the restored DB. The lookup `session.get(CheckpointModel, before_restore['id'])`
  queries the restored DB which doesn't have this record — it's always None.
  The code re-inserts it, so the file exists on disk but the in-memory record came
  from the wrong DB. Low risk in practice but logically incorrect.

---

## Medium: performance / scale

### B7: O(N wells) full pipeline per horizon add
- **File**: `api/top_sets.py:add_horizon`
- **Effect**: Adding one horizon calls `activate_top_set_for_well` for every linked well.
  That function runs 5 operations including Parquet loads. For 10 wells = 10 Parquet loads.
- **Fix needed**: Defer lithology aggregation; run link+ghost+zone in batch.

### B8: auto_link_all_formations_to_chart scans all formations without well filter
- **File**: `data/strat_link.py:auto_link_all_formations_to_chart:78`
- **Effect**: Activating a strat chart scans every formation in the project (all wells).
  For large projects this is slow. No pagination or filtering.

---

## Low: coupling smells

### B9: `_floor_match_horizon` is a private function used across modules
- **File**: `data/zone_service.py` (defined), `api/formations.py` (imported)
- **Fix**: Rename to `floor_match_horizon` (remove leading underscore) to make it public API.

### B10: 6 identical `_require_open_project` + `_manager` helper copies
- **Files**: `api/wells.py`, `api/formations.py`, `api/top_sets.py`, `api/strat_chart.py`,
  `api/subsidence.py`, `api/sea_level.py`
- **Fix**: Extract to `api/_deps.py`. Pure refactor, no behavior change.

### B11: `wellDataStore.ts` has dynamic imports to avoid circular deps (×6)
- **File**: `frontend/src/stores/wellDataStore.ts`
- **Pattern**: `const { useComputedStore } = await import('./computedStore')`
- **Fix**: Split wellDataStore into WellCoreStore + DictionaryStore to break the cycle.

---

## Low: stale / wrong documentation

### D1: export documentation was stale
- **Docs**: `docs/backend-api.md`, `docs/codebase-map.md`
- **Reality at audit time**: export routing was not documented correctly.
- **Current status**: `app/src/subsidence/api/export.py` is registered in `main.py`; current docs point to that router.

### D2: `GET /api/wells/{id}/curves/full` not documented
- **File**: `api/wells.py:565-643`
- **Fix**: Add to `docs/modules/backend-api.md`.

### D3: `end_age_ma`/`start_age_ma` CSV convention not documented
- **Reality**: `start_age_ma` = older (larger Ma), `end_age_ma` = younger (smaller Ma).
  This was swapped in commit da35f29 after a production bug.
- **Fix**: Add to `docs/modules/backend-api.md` strat chart section.

### D4: `WellModel.lat`/`lon` inversion not documented
- **Reality**: `well.lon` = X coordinate, `well.lat` = Y coordinate. Inverted semantics.
- **Fix**: Add a comment to `schema.py` and a note in `docs/modules/`.

---

## Dead code / unused fields

### D5: `CalculationResult.is_stale` field
- Defined in schema. Never set to True by any code path.
- Either wire it up properly (fix B2 first) or remove the field.

### D6: `strat_unit_id` column comment in `engine.py:121`
- Comment says "can't drop because SQLite < 3.35". SQLite 3.35+ (2021) supports DROP COLUMN.
  The comment is stale but leaving the column is harmless.

### D7: Legacy `FormationInput` path in `_compute_subsidence`
- **File**: `api/subsidence.py:163-200`
- The fallback path (when `top_set_id is None`) rebuilds subsidence from raw formations
  without zones. This duplicates zone_service logic and can diverge. Should be removed
  once all projects are required to have a TopSet, or clearly documented as a fallback.
