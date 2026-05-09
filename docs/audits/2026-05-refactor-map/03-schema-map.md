# Schema Map — DB Tables, Ownership, Relationships

---

## Table ownership

| Table | Primary key | Owner module(s) | Notes |
|---|---|---|---|
| `project_meta` | id | project_manager.py | Singleton row |
| `wells` | UUID | wells.py, projects_imports.py | |
| `curve_metadata` | auto | wells.py, importers/las.py, importers/logs_csv.py | References Parquet on disk |
| `deviation_surveys` | auto | importers/deviation.py, wells.py | References Parquet on disk |
| `strat_charts` | auto | strat_chart.py | |
| `strat_units` | auto | strat_chart.py | Self-referencing parent_id |
| `top_sets` | auto | top_sets.py | |
| `top_set_horizons` | auto | top_sets.py | |
| `well_active_top_sets` | auto | zone_service.py + top_sets.py | **Split ownership** |
| `formation_tops` | auto | formations.py + importers/tops.py | **Split ownership** |
| `formation_strat_links` | auto | strat_link.py, formations.py | |
| `formation_zones` | auto | zone_service.py | Cascade delete from top_sets |
| `zone_well_data` | auto | zone_service.py | Cascade delete from formation_zones |
| `curve_dict_entries` | auto | dict_seeder.py, projects_config.py | Seeded on project open |
| `curve_mnemonic_sets` | auto | projects_config.py | |
| `curve_mnemonic_entries` | auto | projects_config.py | |
| `unit_dimensions` | auto | dict_seeder.py | Seeded on project open |
| `measurement_units` | auto | dict_seeder.py | |
| `measurement_unit_aliases` | auto | dict_seeder.py | |
| `lithology_dict_entries` | auto | dict_seeder.py, projects_config.py | Seeded on project open |
| `lithology_sets` | auto | projects_config.py | |
| `lithology_set_entries` | auto | projects_config.py | |
| `lithology_pattern_palettes` | auto | lithology_patterns.py | |
| `lithology_patterns` | auto | lithology_patterns.py | |
| `compaction_presets` | auto | dict_seeder.py, compaction.py | Seeded on project open |
| `compaction_models` | auto | compaction.py | |
| `compaction_model_params` | auto | compaction.py | |
| `calculation_results` | auto | subsidence.py | Also writes JSON to results/ |
| `visual_config` | auto | projects_config.py | scope + scope_id composite key |
| `checkpoints` | auto | project_manager.py | |
| `sea_level_curves` | auto | sea_level.py | |
| `sea_level_points` | auto | sea_level.py | |
| `well_active_sea_level_curves` | well_id (PK) | sea_level.py | |

---

## Key relationships diagram

```
StratChart
  └── StratUnit[] (tree, parent_id self-ref)
        ↑ FormationStratLink ← FormationTopModel

TopSet
  ├── TopSetHorizon[]
  │     ↑ FormationTopModel.horizon_id (nullable FK)
  └── FormationZone[] (upper_horizon_id, lower_horizon_id)
        └── ZoneWellData[] (per well: thickness, fractions)

WellModel
  ├── CurveMetadata[] → [Parquet]
  ├── DeviationSurveyModel → [Parquet]
  ├── FormationTopModel[]
  ├── WellActiveTopSet → TopSet
  └── WellActiveSeaLevelCurve → SeaLevelCurve → SeaLevelPoint[]
```

---

## Split ownership problems

**`formation_tops`** is written by:
- `formations.py` — CRUD (add, update, delete single formation)
- `importers/tops.py` — bulk import
- `zone_service.py` — writes `horizon_id` field via link_picks_to_horizons
- `zone_service.py` — creates ghost rows (depth_md=None) via create_ghost_picks

**`well_active_top_sets`** is written by:
- `zone_service.py:activate_top_set_for_well` — the canonical write path
- `top_sets.py` (indirectly via activate_top_set_for_well calls)

---

## Schema version

Current version: `SCHEMA_VERSION = 14` in `schema.py`.

Migrations: flat idempotent function `migrate_schema` in `engine.py`.
- No Alembic
- No version-to-version gating — all checks run on every open
- Any new field in `schema.py` requires a matching `ALTER TABLE` in `engine.py`

---

## Known naming quirk

`WellModel.lat` / `WellModel.lon` have inverted semantics:
- `well.lon` stores the **X** coordinate
- `well.lat` stores the **Y** coordinate

This is used consistently throughout (e.g. `wells.py` maps `x=well.lon, y=well.lat`),
so it works — but it's confusing. Historical artifact, don't "fix" it without migrating all data.

---

## Cascade delete rules

- `TopSet` → `FormationZone[]` (cascade all, delete-orphan)
- `FormationZone` → `ZoneWellData[]` (cascade all, delete-orphan)
- `TopSetHorizon` delete: handled manually in `delete_horizon` endpoint (no ORM cascade)
  - `merge_zones_on_horizon_delete` runs first
  - Then picks with that `horizon_id` are deleted
  - Then the horizon itself

---

## Files on disk (outside SQLite)

| Path | What | Created by |
|---|---|---|
| `{project}/curves/{mnemonic}.parquet` | Log curve data | importers/las.py, importers/logs_csv.py |
| `{project}/deviation/{well_id}.parquet` | Deviation survey | importers/deviation.py |
| `{project}/results/{well_id}.json` | Subsidence calculation output | subsidence.py |
| `{project}/project.db` | Canonical SQLite DB | project_manager.py |
| `{project}/.session.db` | Working copy (open session) | project_manager.py |
| `{project}/.lock` | File lock | project_manager.py |
| `{project}/checkpoints/{id}.db` | Checkpoint snapshots | project_manager.py |
