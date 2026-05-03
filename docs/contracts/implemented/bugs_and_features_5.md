# Bugs and Features — Contract 5

## Status legend
`todo` · `partial` · `done`

---

## Overview

This contract centralises sea-level-curve and top-set selection at the project level,
replaces name-based pick↔horizon linking with age-based linking, pre-computes sea-level
values on horizons so calculations never interpolate at runtime, and adds a new
**MODELS** settings panel as the single control point for both settings.

---

## BF5-001: `project_config` table — project-level active curve and top set (todo)

### Goal

Replace per-well `well_active_sea_level_curves` and `well_active_top_sets` tables with a
single `project_config` row that holds the active sea-level curve and active top set for
the whole project.

### Schema

New table (created in `migrate_schema` if absent):

```sql
CREATE TABLE project_config (
    id                         INTEGER PRIMARY KEY CHECK (id = 1),
    active_sea_level_curve_id  INTEGER REFERENCES sea_level_curves(id) ON DELETE SET NULL,
    active_top_set_id          INTEGER REFERENCES top_sets(id) ON DELETE SET NULL
)
```

Single row, `id = 1` enforced by CHECK. Seed on creation:

```sql
INSERT OR IGNORE INTO project_config (id) VALUES (1)
```

Migration: after table creation, if `well_active_sea_level_curves` has any rows, copy the
first `curve_id` found into `project_config.active_sea_level_curve_id`. Same for
`well_active_top_sets` → `active_top_set_id`. Then drop both old tables.

### API

New endpoints in `app/src/subsidence/api/projects_config.py`:

```
GET  /api/project/config
     → { active_sea_level_curve_id: int | null, active_top_set_id: int | null }

PUT  /api/project/config
     body: { active_sea_level_curve_id?: int | null, active_top_set_id?: int | null }
     → same shape as GET
     side-effects:
       - active_sea_level_curve_id changed → call rebuild_sea_level(session, new_curve_id)
       - active_top_set_id changed         → call rebuild_horizon_links(session, new_top_set_id)
                                             then rebuild_sea_level for the now-linked horizons
```

### Backend changes

- `schema.py`: add `ProjectConfig` ORM model; remove `WellActiveTopSet`, `WellActiveSeaLevelCurve` models
- `engine.py`: add migration block (create table, seed, migrate data, drop old tables)
- `wells.py`: remove `active_top_set_id`, `active_top_set_name`, `active_sea_level_curve_id`
  from `WellInventoryResponse` and the inventory query; read from `project_config` instead
  and include once in the project-config response (not per-well)
- `sea_level.py`: remove `PUT /wells/{well_id}/active-sea-level-curve` endpoint;
  in-use guard for curve delete changes from checking `well_active_sea_level_curves` to
  checking `project_config.active_sea_level_curve_id`
- `top_sets.py`: remove `PUT /wells/{well_id}/active-top-set` endpoint;
  all zone-query code currently keyed on `well_active_top_sets` re-keyed on
  `project_config.active_top_set_id`
- `data/__init__.py`, `data/undo.py`: no new undo commands needed for config changes
  (config is not undoable — it is a project-wide mode switch)

### Frontend changes

- `projectStore.ts`: add `projectConfig: { activeCurveId: number | null, activeTopSetId: number | null }`;
  load via `GET /api/project/config` on project open and after PUT
- `wellDataStore.ts`: remove `active_sea_level_curve_id` from `WellInventory` type and
  `mapWellInventory`; consumers that read it switch to `projectStore.projectConfig.activeCurveId`
- `TopPickSettings.tsx`, `SubsidenceCanvas.tsx`, `SubsidenceModelSettings.tsx`:
  replace `wellInventories.find(w => w.well_id === wellId)?.active_sea_level_curve_id`
  with `useProjectStore(s => s.projectConfig.activeCurveId)`

### Affected files

- `app/src/subsidence/data/schema.py`
- `app/src/subsidence/data/engine.py`
- `app/src/subsidence/api/projects_config.py`
- `app/src/subsidence/api/sea_level.py`
- `app/src/subsidence/api/top_sets.py`
- `app/src/subsidence/api/wells.py`
- `frontend/src/stores/projectStore.ts`
- `frontend/src/stores/wellDataStore.ts`
- `frontend/src/types/well.ts`
- `frontend/src/components/layout/settings/TopPickSettings.tsx`
- `frontend/src/components/layout/settings/SubsidenceModelSettings.tsx`
- `frontend/src/components/subsidence/SubsidenceCanvas.tsx`

---

## BF5-002: Age-based pick↔horizon linking (todo)

### Goal

Replace name-based `link_picks_to_horizons` with age-based matching. A pick is linked to
the horizon whose `age_ma` is the largest value ≤ `pick.age_top_ma` (floor match).
No name comparison is performed.

### Matching rule

Given horizons in the active top set sorted by `age_ma` ascending:

```
pick.age_top_ma = 85 Ma
horizons: 60 Ma, 80 Ma, 100 Ma
floor(85) = 80  →  link to horizon at 80 Ma
```

Edge cases:
- Pick age < youngest horizon age → no link (pick is too young for the top set)
- Pick age ≥ oldest horizon age → link to oldest horizon
- Pick `age_top_ma` is NULL → no link
- Multiple horizons at same age → link to the one with the lowest `sort_order`

### `rebuild_horizon_links(session, top_set_id)`

New function in `app/src/subsidence/data/zone_service.py`:

1. Load all horizons of `top_set_id` sorted by `age_ma` ascending.
2. For every well (`WellModel`):
   a. Clear `horizon_id` on all picks of that well (set to NULL).
   b. For each pick with `age_top_ma IS NOT NULL`:
      - Binary search for floor horizon.
      - Set `pick.horizon_id = horizon.id`.
      - Copy `horizon.name` → `pick.name`, `horizon.color` → `pick.color` only if the
        pick does not have a user-set name (i.e. pick name was already equal to a horizon
        name, or pick was just created without a custom name).
        **Decision rule**: always overwrite `pick.name` and `pick.color` from the matched
        horizon; the horizon is the authoritative source of naming and colour.
3. Flush; caller commits.

The old `link_picks_to_horizons` (name-based) is removed. All call sites updated.

### Trigger points

- `PUT /api/project/config` with new `active_top_set_id`
- `POST /api/top-sets/{id}/horizons` (new horizon added — re-link all picks of all wells)
- `PATCH /api/top-sets/{id}/horizons/{horizon_id}` when `age_ma` changes — re-link all
  picks of all wells (horizon boundaries shifted)
- `PATCH /api/wells/{well_id}/formations/{formation_id}` when `age_ma` changes — re-link
  only this pick

### Affected files

- `app/src/subsidence/data/zone_service.py`
- `app/src/subsidence/api/top_sets.py`
- `app/src/subsidence/api/formations.py`

---

## BF5-003: `sea_level_m` pre-computed on `TopSetHorizon` (todo)

### Goal

Store the interpolated sea-level value directly on each `TopSetHorizon` row so that
calculations and the API never need to load curve points and interpolate at runtime.

### Schema

New column on `top_set_horizons`:

```sql
ALTER TABLE top_set_horizons ADD COLUMN sea_level_m REAL
```

(added in `migrate_schema`; `sea_level_m_override` already exists from BF4-007-B)

Effective sea level for a horizon:
```
effective = sea_level_m_override  if not NULL
          else sea_level_m        (may be NULL if no active curve or horizon has no age)
```

### `rebuild_sea_level(session, curve_id)`

New function in `app/src/subsidence/data/zone_service.py` (or `sea_level_service.py`):

1. Load all points of `curve_id` sorted by `age_ma` ascending into a Python list.
2. For every `TopSetHorizon` with `age_ma IS NOT NULL`:
   - Interpolate: linear between bracketing points.
   - Extrapolation older than oldest point: use oldest point value (flat line).
   - Extrapolation younger than youngest point: use youngest point value (flat line).
   - Set `horizon.sea_level_m = interpolated_value`.
3. Flush; caller commits.

If `curve_id` is NULL (curve deselected), set `sea_level_m = NULL` on all horizons.

### Trigger points

- `PUT /api/project/config` with new `active_sea_level_curve_id`
- `POST /api/sea-level-curves/{curve_id}/points` (points replaced → recompute for
  active curve only)
- `PATCH /api/top-sets/{id}/horizons/{horizon_id}` when `age_ma` changes → recompute
  `sea_level_m` for that horizon only
- `POST /api/top-sets/{id}/horizons` (new horizon) → compute `sea_level_m` for new row
- After `rebuild_horizon_links` completes (newly linked horizons may have stale values)
- Project open (see BF5-004)

### API response

`GET /api/top-sets/{id}/horizons` and formation responses already return
`sea_level_m_override`. Add `sea_level_m` (computed) to the response so the frontend
can display both and show the effective value.

`FormationTopResponse.sea_level_m` is already derived from `row.horizon.sea_level_m_override`
(BF4-007-B). Extend to: `sea_level_m_override ?? sea_level_m` using the horizon's two fields.

### Affected files

- `app/src/subsidence/data/schema.py` (`TopSetHorizon.sea_level_m`)
- `app/src/subsidence/data/engine.py` (migration)
- `app/src/subsidence/data/zone_service.py` (new function)
- `app/src/subsidence/api/sea_level.py` (trigger on points upload)
- `app/src/subsidence/api/top_sets.py` (trigger on horizon create/age patch)
- `app/src/subsidence/api/formations.py` (`_to_response` effective value)
- `frontend/src/types/well.ts` (`FormationTop.sea_level_m` read-only field)

---

## BF5-004: Rebuild on project open (todo)

### Goal

On every project open, ensure all stored derived values are consistent with the current
project config. Handles old projects, manual DB edits, and migration side-effects.

### `rebuild_all(session, project_config)`

Called from `ProjectManager.open_project` after migration, inside a single transaction:

```python
def rebuild_all(session, project_config):
    if project_config.active_top_set_id is not None:
        rebuild_horizon_links(session, project_config.active_top_set_id)
    if project_config.active_sea_level_curve_id is not None:
        rebuild_sea_level(session, project_config.active_sea_level_curve_id)
    # zone thickness and lithology are already rebuilt by zone_service on open
    session.commit()
```

Performance: both functions do bulk SQL; for typical projects (< 20 wells, < 50 horizons)
this completes in milliseconds. No lazy or deferred rebuild needed.

### Affected files

- `app/src/subsidence/data/zone_service.py`
- `app/src/subsidence/data/project_manager.py`

---

## BF5-005: MODELS root selectable — centralised settings panel (todo)

### Goal

Make the **MODELS** root node in the WELLS tab selectable. Clicking it opens a new
`ModelsRootSettings` panel that is the single place to set the active sea-level curve
and the active top set (набор маркеров).

Remove the sea-level curve dropdown from `SubsidenceModelSettings.tsx`.

### Tree change (`WellDataPanel.tsx`)

`ModelsRoot` component:
- Add `onClick` to root row: `setSelectedObject({ type: 'models-root' })`
- Apply `tree-node__row--selected` CSS class when `selectedObject?.type === 'models-root'`
- Label: `MODELS` (uppercase, consistent with WELLS / ZONES)

### New component `ModelsRootSettings.tsx`

Location: `frontend/src/components/layout/settings/ModelsRootSettings.tsx`

Contents:

```
┌─ MODELS ───────────────────────────────────┐
│  Sea level curve   [ Haq 1987 ▼ ]  [None]  │
│  Marker set        [ Top Set A ▼ ]  [None] │
└────────────────────────────────────────────┘
```

- **Sea level curve** dropdown: lists all `seaLevelCurves`; value from
  `projectStore.projectConfig.activeCurveId`; on change → `PUT /api/project/config`
  `{ active_sea_level_curve_id: id }` → reload `projectConfig` + reload
  `wellDataStore.formations` (sea-level values on horizons changed)
- **Marker set** dropdown: lists all top sets from a new store selector or dedicated
  fetch; value from `projectStore.projectConfig.activeTopSetId`; on change →
  `PUT /api/project/config` `{ active_top_set_id: id }` → reload inventories and
  formations for all loaded wells (horizon links changed, names/colors updated)

After either change, the frontend must reload:
1. `GET /api/project/config` → update `projectStore.projectConfig`
2. `GET /api/wells/inventory` → refresh `wellInventories` (zones, pick counts)
3. `GET /api/wells/{active_well_id}/formations` → refresh `formations` in `wellDataStore`

### `SettingsInspector.tsx`

Add case `'models-root'` → render `<ModelsRootSettings />`.

### `SubsidenceModelSettings.tsx`

Remove the "Eustatic curve" dropdown and its `handleSeaLevelChange` handler. The section
header "Sea level correction" can also be removed if it only wrapped that dropdown.

### Affected files

- `frontend/src/components/layout/WellDataPanel.tsx`
- `frontend/src/components/layout/SettingsInspector.tsx`
- `frontend/src/components/layout/settings/ModelsRootSettings.tsx` (new)
- `frontend/src/components/layout/settings/SubsidenceModelSettings.tsx`
- `frontend/src/stores/projectStore.ts`

---

## BF5-006: Depositional surface elevation in TopPickSettings (todo)

### Goal

Add a read-only derived field below **Paleobathymetry** in `TopPickSettings.tsx`:

```
Depositional surface elev.   +50.0 m
```

Formula:
```
depositional_surface_elevation = effective_sea_level - water_depth_m
```

where `effective_sea_level = sea_level_m_override ?? sea_level_m` from the linked horizon.

Display rules:
- Show only when both `effective_sea_level != null` and `water_depth_m != null`
- Positive = above present sea level; negative = below
- Format: one decimal place with sign (`+50.0` / `-120.3`)
- No storage; computed in the component from `selectedFormation.sea_level_m` and
  `selectedFormation.water_depth_m`

`FormationTop` type needs a readable `sea_level_m` field (effective value, not just
override). `mapFormation` maps it from `FormationTopResponse.sea_level_m`.

### Affected files

- `frontend/src/components/layout/settings/TopPickSettings.tsx`
- `frontend/src/types/well.ts` (`FormationTop.sea_level_m`)
- `frontend/src/stores/wellDataStore.ts` (`mapFormation`)

---

## BF5-007: Drop `well_active_sea_level_curves` and `well_active_top_sets` (todo)

### Goal

After migrating data to `project_config` (BF5-001), physically drop both legacy tables.
SQLite supports `DROP TABLE` for tables that are not referenced by any FK in another
table's definition.

`well_active_sea_level_curves`:
- `well_id` PK, references `wells(id)` — no other table references this table → safe to drop

`well_active_top_sets`:
- `well_id` PK, references `wells(id)` and `top_sets(id)` — no other table references
  this table → safe to drop

Migration order in `migrate_schema`:
1. Create `project_config` and seed it (BF5-001 migration)
2. `DROP TABLE IF EXISTS well_active_sea_level_curves`
3. `DROP TABLE IF EXISTS well_active_top_sets`

ORM models `WellActiveSeaLevelCurve` and `WellActiveTopSet` are removed from `schema.py`.
All imports of these models in `wells.py`, `sea_level.py`, `top_sets.py` are removed.

### Affected files

- `app/src/subsidence/data/schema.py`
- `app/src/subsidence/data/engine.py`
- `app/src/subsidence/api/wells.py`
- `app/src/subsidence/api/sea_level.py`
- `app/src/subsidence/api/top_sets.py`

---

## Implementation order

```
BF5-007 migration block (schema + drop)    ← in engine.py, part of BF5-001 work
BF5-001 backend (project_config + API)
BF5-002 backend (age-based linking)
BF5-003 backend (sea_level_m on horizon)
BF5-004 backend (rebuild on open)
BF5-001 frontend (projectStore + consumers)
BF5-005 frontend (MODELS panel)
BF5-006 frontend (depositional surface elev)
```

Steps 1-4 are a single backend commit; steps 5-8 are a single frontend commit.
