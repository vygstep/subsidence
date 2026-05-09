# Data Flow Map

How data moves from DB through backend to frontend stores to UI.

---

## Backend DB structure (SQLite)

```
WellModel
  ├── CurveMetadata[] ──→ [Parquet files on disk]
  ├── DeviationSurveyModel ──→ [Parquet files on disk]
  ├── FormationTopModel[]
  │     ├── horizon_id → TopSetHorizon (nullable)
  │     └── FormationStratLink → StratUnit → StratChart
  ├── WellActiveTopSet → TopSet
  │     ├── TopSetHorizon[]
  │     └── FormationZone[]
  │           └── ZoneWellData[] (per-well: fractions, thickness, lithology_source)
  ├── WellActiveSeaLevelCurve → SeaLevelCurve
  │     └── SeaLevelPoint[]
  └── CalculationResult[] → [JSON files in results/]
```

---

## Calculation data path (backstrip)

```
ZoneWellData {lithology_fractions, thickness_m}
  + LithologyParam dict (from compaction presets)
  + SeaLevelPoint[] (sea level curve)
  ↓
build_zone_layer_inputs(session, top_set_id, well_id, litho_params, project_path)
  → ZoneLayerInput[] (age_top_ma, age_base_ma, current_top_m, current_base_m, litho_param)
  ↓
backstrip(layers, sea_level_curve, current_top_tvdss)
  → SubsidenceResult[] (age_ma, tectonic_subsidence, total_subsidence, water_depth, ...)
  ↓
_store_results(session, results_dir, well_id, results)
  → CalculationResult row in SQLite
  → JSON file in results/{well_id}.json
  ↓
WebSocket response → computedStore.setResults()
```

**LEGACY PATH** (no TopSet): `_compute_subsidence` in `subsidence.py` falls back to
building `FormationInput` directly from `FormationTopModel` rows when `top_set_id is None`.
This path duplicates zone logic and can produce different results. See `subsidence.py:163-200`.

---

## Frontend data flow

```
projectStore.openProject()
  ├── GET /api/projects/visual-config
  │     → viewStore.applyVisualConfig (zoom, widths, depth ranges, overlays)
  │     → wellDataStore.applyWellConfigs (per-well track state)
  │
  ├── GET /api/wells/inventory
  │     → wellDataStore.wellInventories   (list of wells + zone counts)
  │     → wellDataStore.zones[]           (ZoneWellData, water_depth per zone)
  │     → wellDataStore.seaLevelCurves[]  (available curves)
  │
  └── loadWell(wellId)
        ├── GET /api/wells/{id}
        │     → wellDataStore.well       (WellModel fields)
        │     → wellDataStore.curves[]   (CurveMetadata + LOD data)
        │     → wellDataStore.formations[] (FormationTopModel[])
        ├── GET /api/wells/{id}/deviation
        │     → wellDataStore.tvdTable   (MD→TVD/TVDSS lookup)
        └── computedStore.triggerRecalculation()
              → WebSocket /api/ws/recalculate
              → computedStore.subsidenceCurves[]
```

---

## UI rendering pipeline

```
SubsidenceCanvas:
  wellDataStore.formations[]         ← marker depths
  wellDataStore.zones[]              ← zone fills + colors
  computedStore.subsidenceCurves[]   ← calculated curves
  viewStore.seaLevelOverlayStyles    ← display options
  viewStore.subsidenceSingleDepthMin/Max

LogView (canvas tracks):
  wellDataStore.curves[]             ← curve data (LOD)
  wellDataStore.formations[]         ← formation markers
  workspaceStore.wellViewStates[]    ← track layout per well
  viewStore.depthPerPixel            ← zoom
  viewStore.trackWidths              ← track sizes

WellDataPanel (Settings):
  wellDataStore.formations[]         ← selected formation fields
  wellDataStore.zones[]              ← zone lithology
  wellDataStore.seaLevelCurves[]     ← curve selector
```

---

## What `water_depth_m` does (and doesn't do)

```
FormationTopModel.water_depth_m
  ← set by: import_tops_csv (age=0 picks only: depth_md - kb_elev)
  ← set by: update_formation API (when user sets age=0 in Settings)
  ← read by: list_well_inventories (for zone water depth display)
  ← read by: build_zone_layer_inputs (passed to backstrip as paleobathymetry)

computedStore.waterDepthM
  ← set by: user slider in SubsidencePanel
  → sent in WebSocket payload: sendRecalculation(wellId, waterDepthM)
  !! NOT READ by backend ws_recalculate — SILENTLY IGNORED
```

The `waterDepthM` control in the subsidence panel currently has no effect on calculations.
The backend reads `water_depth_m` directly from DB.

---

## inputs_hash — currently broken

```
CalculationResult.inputs_hash
  ← set by: hashlib.sha256(well_id.encode()).hexdigest()[:32]
  ← ALWAYS the same value for a given well
  ← is_stale flag is never set to True by any code path
```

Stale result detection is effectively disabled. `subsidence.py:227`.
