# BF5-002: Age-based pick↔horizon linking

## Status legend
`todo` · `partial` · `done`

---

## Overview

Replace name-based pick↔horizon linking with age-based matching.
Pick names are never touched. The link (`horizon_id`) is the only field that changes.
After linking, the pick displays the matched horizon's name ("Linked unit") and color.
Unlinked picks (no `age_top_ma`, or age violates order) are shown grey.

---

## BF5-002-A: Age-based `link_picks_to_horizons` (todo)

### Goal

Replace the current name-based `link_picks_to_horizons` with a function that matches
picks to horizons by age using floor-match:

```
pick.horizon_id = horizon with max(age_ma) where age_ma ≤ pick.age_top_ma
```

Rules:
- Only `horizon_id` is updated on the pick — name and color are never stored on the pick
- If `pick.age_top_ma IS NULL` → `horizon_id = NULL` (unlinked)
- If no horizon satisfies `age_ma ≤ pick.age_top_ma` → `horizon_id = NULL`
- Pick names are never overwritten at any point

### When to call

- `activate_top_set_for_well` — after writing `ZoneWellData`
- PATCH pick age (BF5-002-B) — after validating and saving the new age
- Import pipeline — after importing picks

### Affected files

- `app/src/subsidence/data/zone_service.py` — replace `link_picks_to_horizons`

---

## BF5-002-B: Age validation on pick edit (todo)

### Goal

When user sets `age_top_ma` on a pick via settings:

1. Validate depth-order constraint:
   - `age_top_ma` must be ≥ age of pick above (shallower = younger = smaller Ma)
   - `age_top_ma` must be ≤ age of pick below (deeper = older = larger Ma)
   - Neighbors with `age_top_ma IS NULL` are skipped when finding bounds
2. If valid → save → call age-based link
3. If invalid → emit warning to message log → set `age_top_ma = NULL` → `horizon_id = NULL`

### Import validation

Same order-check runs on import. Picks that violate depth order get
`age_top_ma = NULL` and a warning entry in the message log (existing system).

### API

```
PATCH /api/wells/{well_id}/picks/{pick_id}
      body: { age_top_ma: number | null }
      side-effects:
        - validate order among picks at this well (same top set)
        - if invalid: set age_top_ma = NULL, log warning, set horizon_id = NULL
        - if valid: save age, run age-based link
```

### Affected files

- `app/src/subsidence/api/wells.py` (or `top_sets.py`) — PATCH handler
- `app/src/subsidence/data/zone_service.py` — validation helper

---

## BF5-002-C: UI — "Linked unit" display and age input clamping (todo)

### Goal

In `TopPickSettings.tsx`:

- Show read-only field **"Linked unit"**: horizon name from `horizon_id`, or "—" if unlinked
- Pick color comes from matched horizon; grey (`#9ca3af` or similar) if `horizon_id IS NULL`
- Age input: clamp `min`/`max` to neighboring picks' ages so user cannot enter an
  out-of-order value (neighbors with NULL age are skipped when computing bounds)

### Affected files

- `frontend/src/components/layout/settings/TopPickSettings.tsx`

---

## BF5-002-D: Sea level curve clamping (todo)

### Goal

When interpolating sea level correction for a pick age:

- If `pick.age_top_ma` > max age on the active curve → use the curve's last value (clamp)
- If `pick.age_top_ma` < min age on the active curve → use the curve's first value (clamp)
- No extrapolation, no NULL

When active sea level curve changes → trigger full recalculation.

### Affected files

- `app/src/subsidence/data/backstrip.py` (or wherever sea level interpolation lives)

---

---

## Code Audit (pre-implementation)

> Проведён до начала реализации. Цель — убедиться что контракт не мёртвый
> и найти сюрпризы заранее.

### A: `link_picks_to_horizons` — привязка по имени, не по возрасту

**Файл:** `app/src/subsidence/data/zone_service.py:83–102`

Текущая функция явно матчит по нормализованному имени:
```python
horizon = horizon_by_name.get(_top_name_key(pick.name))
```
`age_top_ma` игнорируется полностью. Функция реальная, менять только логику матча.

`activate_top_set_for_well` вызывает `link_picks_to_horizons` и после него `create_ghost_picks`.
Звонки есть из `top_sets.py` (строки ~321, ~423, ~479) и `projects_imports.py:217`.

`rebuild_horizon_links` — **не существует** в коде. Упоминался в старом контракте BF5, но никогда не был реализован. В аффектед-файлах только `zone_service.py`.

**`create_ghost_picks`** (`zone_service.py:105`) тоже матчит по имени — нужно решить
что делать с ней при переходе на age-based (см. вопрос ниже).

### B: PATCH pick age — endpoint есть, валидации нет

**Файл:** `app/src/subsidence/api/formations.py:238–328` (`update_formation`)

Принимает `age_ma` через `FormationTopPatch`, сохраняет без проверки порядка.
После сохранения пересчитывает толщины только если изменилась глубина — `link_picks_to_horizons` не вызывается совсем.

Импорт: `data/importers/tops.py` — возраст сохраняется, порядок возрастов не проверяется.
Глубины проверяются строго (`_validate_strictly_increasing_depth` в `common.py:315`).

⚠️ Контракт называл endpoint в `wells.py` или `top_sets.py` — он на самом деле в `formations.py`.

### C: TopPickSettings — "Linked unit" есть, но из другой системы

**Файл:** `frontend/src/components/layout/settings/TopPickSettings.tsx:219–222`

Поле "Linked unit" уже отрисовывается:
```tsx
<span>{selectedFormation.active_strat_unit_name ?? 'Unlinked'}</span>
```
Но `active_strat_unit_name` приходит из **StratChart strat_links** (`formations.py:163`),
а не из TopSet horizon. Это другая система привязки.

API уже возвращает `horizon_id` (`formations.py:69`, `150`), но `horizon_name` и
`horizon_color` (из TopSetHorizon) — **не возвращаются**.

Нужно добавить в ответ `horizon_name: str | None` и `horizon_color: str | None`
через JOIN с `TopSetHorizon` по `horizon_id`.

**Цвет пика:** сейчас редактируемый `<input type="color">` на самом пике.
`FormationColumn.tsx:220` использует `formation.color` для рендеринга.
Контракт говорит — цвет берётся из горизонта, pick.color не трогаем.
⚠️ **Нужно решить:** рендерить из `horizon_color` (когда linked) без записи в pick.color,
или перезаписывать pick.color при линковке (как сейчас делает `create_ghost_picks:128`).

Клампинг возраста — отсутствует. Инпут принимает любое число.

### D: Sea level — уже корректно клампит ✓

**Backend** `backstrip.py:123–137` (`_sea_level_at`):
- age > max curve → возвращает последнее значение ✓
- age < min curve → возвращает первое значение ✓
- пустая кривая → 0.0 ✓

**Frontend** `TopPickSettings.tsx:6–18` (`interpolateSeaLevel`):
- клампит к первому/последнему значению ✓
- `null` только при пустых points (не дойдёт при нормальных данных)

**D можно считать уже реализованным.** Единственное что нужно — убедиться что смена
активной кривой тригерит пересчёт (проверить в `setWellActiveSeaLevelCurve`).

### Открытые вопросы перед стартом

1. **Ghost picks при age-based системе**: `create_ghost_picks` создаёт фиктивные пики
   для горизонтов без совпадения по имени. При age-based системе — создаём ли мы
   ghost-пики вообще? Если да — по какому критерию (ни один pick не упал в диапазон горизонта)?
   Ghost-пики сейчас берут цвет из горизонта (`color=horizon.color`) — это образец для нового поведения.

2. **Цвет при линковке**: рендерить `horizon_color` в UI не трогая `pick.color`,
   или перезаписывать `pick.color` при линковке?

---

## Manual checks

- Import a well with out-of-order pick ages → affected picks get `age_top_ma = NULL`,
  warnings appear in message log
- Set a pick age in settings that violates order → input is clamped or rejected, warning logged
- Set a valid age → "Linked unit" updates to the matched horizon name, pick turns the horizon's color
- Pick with NULL age → shown grey, "Linked unit" shows "—"
- Assign a sea level curve whose range doesn't cover a pick's age → calculation uses last curve value,
  no crash
- Change active sea level curve → subsidence chart recalculates
