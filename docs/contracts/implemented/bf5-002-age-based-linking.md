# BF5-002: Age-based pick↔horizon linking

## Status legend
`todo` · `partial` · `done`

---

## Overview

Replace name-based pick↔horizon linking with age-based matching.
Pick names are never touched. The link (`horizon_id`) is the only field that changes.
After linking, the pick displays the matched horizon's name ("Linked unit") and color.
Unlinked picks (no `age_top_ma`) are shown grey.

Color follows a `color_source` flag: `auto` = follows horizon (or grey), `user` = manual override.

---

## BF5-002-A: Age-based `link_picks_to_horizons` + `create_ghost_picks` (todo)

### Goal

Replace name-based matching with age-based floor-match:

```
pick.horizon_id = horizon with max(age_ma) where age_ma ≤ pick.age_top_ma
```

Rules:
- Only `horizon_id` and (if `color_source == 'auto'`) `pick.color` are updated
- `pick.name` is never touched
- If `pick.age_top_ma IS NULL` → `horizon_id = NULL`, color = grey
- If no horizon satisfies `age_ma ≤ pick.age_top_ma` → `horizon_id = NULL`, color = grey

### Ghost picks — keep, rewrite to age-based

`create_ghost_picks` stays but uses age criterion instead of name:
a ghost pick is created for each horizon that has **no real pick whose age floor-matches it**.

A horizon H "owns" a pick if that pick's floor-match resolves to H (i.e. H is the closest
horizon with `age_ma ≤ pick.age_top_ma`). If no pick resolves to H → create ghost pick for H.

Ghost picks: `depth_md = NULL`, `color = horizon.color`, `color_source = 'auto'`.

### When to call

- `activate_top_set_for_well` — replaces current name-based calls
- PATCH pick age (BF5-002-B) — after validating and saving the new age
- Import pipeline — after importing picks

### Affected files

- `app/src/subsidence/data/zone_service.py` — rewrite `link_picks_to_horizons` and `create_ghost_picks`

---

## BF5-002-B: `color_source` flag + color logic (todo)

### Schema

New column on `FormationTopModel`:

```python
color_source: Mapped[str] = mapped_column(String(4), nullable=False, server_default='auto')
# values: 'auto' | 'user'
```

Migration in `engine.py`:
```sql
ALTER TABLE formation_tops ADD COLUMN color_source VARCHAR(4) NOT NULL DEFAULT 'auto'
```

### Color rules

| Event | pick.color | color_source |
|---|---|---|
| Import / link (age-based) | `horizon.color` | `auto` |
| Re-link after age change | `horizon.color` | `auto` (unchanged) |
| Unlink (NULL age) | `#9ca3af` (grey) | `auto` (unchanged) |
| User edits color | new color | `user` |
| Reset color button | `horizon.color` or grey | `auto` |

Color is only updated during linking when `color_source == 'auto'`.

### API changes

`FormationTopResponse` gains:
```python
color_source: str  # 'auto' | 'user'
```

`FormationTopPatch` gains:
```python
color_source: str | None = None  # set to 'user' when user changes color
reset_color: bool = False        # if True: backend sets color from horizon + color_source='auto'
```

PATCH color handler: save `color`, set `color_source = 'user'`.
PATCH reset_color: compute `color = horizon.color` (if linked) or `#9ca3af`, set `color_source = 'auto'`.

### Affected files

- `app/src/subsidence/data/schema.py` — add `color_source` column
- `app/src/subsidence/data/engine.py` — migration
- `app/src/subsidence/api/formations.py` — response + PATCH handler

---

## BF5-002-C: Age validation on pick edit (todo)

### Goal

When user sets `age_top_ma` via settings:

1. Validate depth-order: age must be between neighboring picks' ages
   (neighbors with NULL age are skipped when finding bounds)
2. If valid → save → call age-based link → update color if `color_source == 'auto'`
3. If invalid → warn in message log → set `age_top_ma = NULL`, `horizon_id = NULL`,
   color = grey (if `color_source == 'auto'`)

### Import validation

Same order-check on import. Picks that violate depth order get `age_top_ma = NULL`
and a warning in the message log (existing system).

### API

Extend `update_formation` in `formations.py`:
- After saving `age_ma`: run age-based link for this pick
- Before saving: validate order among picks at this well in the same top set
- If invalid: log warning, nullify age

### Affected files

- `app/src/subsidence/api/formations.py` — extend `update_formation`
- `app/src/subsidence/data/zone_service.py` — age-order validation helper

---

## BF5-002-D: UI — "Linked unit", color controls, age clamping (todo)

### API additions

`FormationTopResponse` gains:
```python
horizon_name: str | None   # from TopSetHorizon join via horizon_id
horizon_color: str | None  # from TopSetHorizon join via horizon_id
```

### TopPickSettings changes

- **"Linked unit"**: show `horizon_name` (from TopSet horizon), or "—" if `horizon_id IS NULL`
  (keep existing `active_strat_unit_name` display for StratChart links — separate field)
- **Color input**: existing `<input type="color">` — on change: PATCH `{color, color_source: 'user'}`
- **Reset color button**: shown only when `color_source == 'user'`; on click: PATCH `{reset_color: true}`
- **Age input**: add `min`/`max` clamped to neighboring picks' ages (skip NULL-age neighbors)

### Affected files

- `app/src/subsidence/api/formations.py` — add `horizon_name`, `horizon_color` to response
- `frontend/src/types/well.ts` — add `horizon_name`, `horizon_color`, `color_source`
- `frontend/src/stores/wellDataStore.ts` — map new fields
- `frontend/src/components/layout/settings/TopPickSettings.tsx` — UI changes

---

## BF5-002-E: Sea level curve clamping (done ✓)

Already implemented in `backstrip.py:123–137` (`_sea_level_at`) and
`TopPickSettings.tsx:6–18` (`interpolateSeaLevel`). Both clamp to curve boundaries,
no extrapolation. No changes needed.

Verify: `setWellActiveSeaLevelCurve` triggers recalculation — check in `wellDataStore.ts`.

---

## Code Audit (pre-implementation)

> Проведён до начала реализации.

### A: link_picks_to_horizons — по имени, не по возрасту

`zone_service.py:83–102` — явный матч по `_top_name_key(pick.name)`, `age_top_ma` игнорируется.
`create_ghost_picks` (`zone_service.py:105`) — тоже по имени. Обе функции переписываем.
`rebuild_horizon_links` — не существует в коде, упоминался в старом контракте BF5 ошибочно.

Вызовы `activate_top_set_for_well`: `top_sets.py:321,423,479`, `projects_imports.py:217`.

### B: PATCH pick age — endpoint в formations.py, не в wells.py

`formations.py:238–328` (`update_formation`) — принимает `age_ma`, без валидации порядка,
без ре-линковки. Импорт: возраст сохраняется, порядок не проверяется.

### C: TopPickSettings — "Linked unit" из StratChart, не из TopSet

`active_strat_unit_name` (строка 221) — из StratChart strat_links, другая система.
`horizon_id` уже возвращается в API (`formations.py:69,150`), но `horizon_name`/`horizon_color` — нет.
Цвет: редактируемый `<input type="color">` на пике. Клампинг возраста отсутствует.

### D: Ghost picks — нужны, оставляем

Один вызов в `activate_top_set_for_well:161`. Null-depth пики везде обрабатываются защищённо.
Показываются как "(not picked)" в UI. Нужны для ручного ввода глубин по горизонтам без данных.

### E: Sea level — уже клампит ✓

`backstrip.py:123–137` и `TopPickSettings.tsx:6–18` — оба корректно клампят к границам кривой.

---

## Manual checks

- Import picks with out-of-order ages → affected picks: `age_top_ma = NULL`, warning in message log
- Set valid age in settings → "Linked unit" shows horizon name, color auto-updates if `color_source == 'auto'`
- Set age, then manually change color → color stays on next age change (`color_source == 'user'`)
- Reset color → reverts to horizon color, `color_source` back to `auto`
- Pick with NULL age → grey, "Linked unit" shows "—"
- TopSet has horizon without matching pick → ghost pick created, shown as "(not picked)"
- Sea level curve shorter than pick age range → last curve value used, no crash
