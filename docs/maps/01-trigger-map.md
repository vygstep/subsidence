# Trigger Map — Side Effect Chains

Describes what triggers what. Read this when you can't figure out why something changed
or why something didn't change after an action.

---

## User edits formation depth (drag in log view)

```
wellDataStore.updateFormationDepth (debounce 300ms)
  → PATCH /api/wells/{id}/formations/{fid}  {depth_md}
    → manager.execute_command(UpdateFormationDepth)
      → UpdateFormationDepth._set_depth
        → compute_tvd_tvdss (deviation transform)
        → get_well_active_top_set_id
        → recalculate_zone_thickness (if top_set_id)
        → aggregate_zone_lithology_from_curve (if project_path)
  → wellDataStore.loadWellInventories (frontend refresh)
  → computedStore.triggerRecalculation()
    → sendRecalculation(wellId, waterDepthM)  ← waterDepthM is IGNORED by backend
      → WebSocket /api/ws/recalculate
        → _compute_subsidence (backstrip)
        → _store_results (write JSON + SQLite)
```

**WARNING**: `waterDepthM` sent from frontend is silently discarded by backend.
See `api/subsidence.py:ws_recalculate` — it only reads `well_id` from the payload.

---

## User adds a horizon to a TopSet

```
PUT /api/top-sets/{id}/horizons
  → TopSetHorizon inserted
  → rebuild_zones_for_top_set (create/delete FormationZone rows)
  → for each well linked to this TopSet:
      activate_top_set_for_well(session, project_path, well_id, top_set_id)
        → link_picks_to_horizons   (name-based, zone_service.py:83)
        → create_ghost_picks        (name-based, zone_service.py:105)
        → ensure_zone_well_data     (zone_service.py:213)
        → recalculate_zone_thickness (zone_service.py:235)
        → aggregate_zone_lithology_from_curve (zone_service.py:464)
```

**WARNING**: O(N wells) full pipeline per horizon addition. For 10 wells = 10 Parquet loads.

---

## Import tops CSV

```
POST /api/projects/import-tops
  → import_tops_csv (importers/tops.py)
    → resolve/create well
    → age deduplication (shallower row keeps age, deeper gets None)
    → for each row: FormationTopModel insert/update
    → auto_link_to_active_chart (strat_link.py)
    → water_depth_m auto-set for age=0 picks: depth_md - kb_elev
    → session.flush
  [if top_set_id provided]:
    → activate_top_set_for_well (full pipeline above)
  → manager.save_project
```

---

## User activates a strat chart

```
PATCH /api/strat-charts/{id}/activate
  → manager.execute_command(ActivateStratChart)
    → ActivateStratChart.apply
      → session.query(StratChart).update({is_active: False})  ← all charts
      → chart.is_active = True
      → auto_link_all_formations_to_chart (ALL formations, ALL wells — full scan)
      → capture changes for undo
```

**WARNING**: `auto_link_all_formations_to_chart` scans ALL formations without filtering
by well. For large projects this is expensive. (`strat_link.py:78`)

---

## User sets well active top set

```
PUT /api/wells/{id}/active-top-set  {top_set_id}
  → activate_top_set_for_well(session, project_path, well_id, top_set_id)
    → WellActiveTopSet upsert
    → link_picks_to_horizons   (name-based)
    → create_ghost_picks        (name-based)
    → ensure_zone_well_data
    → recalculate_zone_thickness
    → aggregate_zone_lithology_from_curve
```

---

## Open project

```
POST /api/projects/open  {path}
  → validate_project_db
  → copy canonical DB → session working DB
  → migrate_schema (idempotent column checks/adds — ~20 PRAGMA calls)
  → create_all_tables (CREATE IF NOT EXISTS)
  → seed_dictionaries (ICS chart, lithology defaults, etc.)
  → acquire file lock
  → start autosave asyncio task (every 300s)

Frontend:
  → GET /api/projects/visual-config
    → viewStore.applyVisualConfig (zoom, track widths, etc.)
    → wellDataStore.applyWellConfigs
  → GET /api/wells/inventory
    → wellDataStore.{wellInventories, zones, seaLevelCurves}
  → loadWell(first well)
    → GET /api/wells/{id}  → well, curves, formations
    → GET /api/wells/{id}/deviation → tvdTable
    → computedStore.triggerRecalculation()
      → WebSocket → subsidence calculation
```

---

## Zone recalculation — mandatory call order

```
ALWAYS in this order:
  1. ensure_zone_well_data(session, top_set_id, well_id)   ← creates ZoneWellData rows
  2. recalculate_zone_thickness(session, top_set_id, well_id)  ← fills thicknesses
  3. aggregate_zone_lithology_from_curve(...)   ← optional, only if lithology curve exists
```

**SILENT FAILURE**: If `recalculate_zone_thickness` is called without `ensure_zone_well_data`
first, `zwd is None → continue` — nothing happens, no error, no log.
(`zone_service.py:235` — see CLAUDE.md antipatterns)

---

## Delete horizon

```
DELETE /api/top-sets/{id}/horizons/{hid}
  → merge_zones_on_horizon_delete(session, horizon_id)
    → merges upper+lower zone into one
    → sets merged ZoneWellData.lithology_source = 'manual'  ← BUG: should keep 'auto'
  → delete picks with this horizon_id
  → delete TopSetHorizon
  → recalculate_zone_thickness for all linked wells
```

---

## Undo formation depth change

```
projectStore.undo()
  → POST /api/projects/undo
    → manager.undo()
      → UpdateFormationDepth.revert()
        → _set_depth (previous depth)
          → compute_tvd_tvdss
          → recalculate_zone_thickness
          → aggregate_zone_lithology_from_curve
```
