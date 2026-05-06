# BF5-002: Закрытие ветки feature/bf5-002-age-linking

## Status legend
`todo` · `partial` · `done`

---

## Что уже реализовано (не трогать)

- `done` — BF5-002-A: age-based `link_picks_to_horizons` (`zone_service.py:83`)
- `done` — BF5-002-B: `color_source` флаг, schema + migration + API response + reset_color
- `done` — BF5-002-D: UI — `horizon_name`, `horizon_color`, `color_source` в types, TopPickSettings
- `done` — `_floor_match_horizon` helper в `zone_service.py`
- `done` — youngest color fallback для age=0 пиков (`zone_service.py:7c190de`)

---

## F1: Ghost multiplication fix `todo`

### Проблема

`create_ghost_picks` строит `covered_ids` через age floor-match. Пики с `age_top_ma = NULL`
не покрывают ни один горизонт → при каждом повторном вызове для них создаётся новый ghost.

### Фикс

В `zone_service.py:create_ghost_picks` — дополнить `covered_ids` через `horizon_id`:

```python
covered_ids: set[int] = set()
for pick in real_picks:
    if pick.horizon_id is not None:          # ← добавить
        covered_ids.add(pick.horizon_id)     # ← добавить
    matched = _floor_match_horizon(horizons, pick.age_top_ma)
    if matched is not None:
        covered_ids.add(matched.id)
```

Правило: горизонт покрыт если хотя бы один пик либо age-матчится на него,
либо уже напрямую привязан к нему через `horizon_id`.

### Тест

`app/tests/unit/test_zone_service.py` — написать:
- `test_no_ghost_for_directly_linked_pick` — пик с `age=None` но `horizon_id` установлен → 0 ghost
- `test_no_ghost_for_age_matched_pick` — пик с корректным age → 0 ghost
- `test_ghost_created_for_uncovered_horizon` — горизонт без пика → 1 ghost
- `test_ghost_idempotent` — повторный вызов `create_ghost_picks` → count=0 на второй раз

### Файлы
- `app/src/subsidence/data/zone_service.py`
- `app/tests/unit/test_zone_service.py` (новый)

---

## F2: water_depth_m auto-set для age=0 `todo`

### Правило

Пик с `age_top_ma = 0.0` — это современный горизонт (сейбед / поверхность).
Его `water_depth_m` = текущая глубина воды = TVDSS.

Приближение для вертикальных скважин: `TVDSS ≈ depth_md - kb_elev`

### A: При импорте tops CSV

В `tops.py:import_tops_csv` — после основного цикла, перед `session.flush()`:

```python
for top in imported:
    if top.age_top_ma == 0.0 and top.depth_md is not None:
        top.water_depth_m = top.depth_md - (well.kb_elev or 0.0)
```

### B: При редактировании через Settings

В `formations.py:update_formation` — после age validation блока, если `age_top_ma = 0.0`
и `water_depth_m` не передан явно:

```python
if new_values.get('age_top_ma') == 0.0 and 'water_depth_m' not in new_values:
    effective_depth = new_values.get('depth_md', row.depth_md)
    tvdss = row.depth_tvdss
    if tvdss is None and effective_depth is not None:
        well_obj = session.get(WellModel, well_id)
        tvdss = effective_depth - (well_obj.kb_elev or 0.0) if well_obj else None
    if tvdss is not None:
        old_values['water_depth_m'] = row.water_depth_m
        new_values['water_depth_m'] = tvdss
```

### Тесты

`app/tests/integration/test_tops_import.py` — уже написан, содержит:
- `test_water_depth_set_for_age_zero_offshore`
- `test_water_depth_set_age_zero_land`
- `test_water_depth_not_set_for_nonzero_age`
- `test_water_depth_negative_age_zero_above_msl`

### Файлы
- `app/src/subsidence/data/importers/tops.py`
- `app/src/subsidence/api/formations.py`
- `app/tests/integration/test_tops_import.py` (уже есть, закоммитить)

---

## F3: BF5-002-C — предупреждение при невалидном возрасте `todo`

### Текущее поведение

`formations.py:update_formation` — если новый `age_top_ma` нарушает порядок глубин,
молча ставит `age_top_ma = None`. Клиент не знает почему поле очистилось.

### Желаемое поведение

Вернуть сохранённое значение (например `None`) И добавить предупреждение в ответ:

```python
class FormationTopResponse(BaseModel):
    ...
    warnings: list[str] = []   # ← добавить поле
```

Заполнять при невалидном возрасте:
```python
warnings.append(f"Age {new_age} violates depth order — cleared")
```

Фронтенд: показывать `warnings` в message log (существующая система логов).

### Файлы
- `app/src/subsidence/api/formations.py`
- `frontend/src/stores/wellDataStore.ts` — читать `warnings` из ответа, передавать в лог
- `frontend/src/types/well.ts` — добавить `warnings?: string[]` в FormationTop patch response

---

## Manual checks перед мержем

- [ ] Повторный вызов activate_top_set_for_well → количество ghost-пиков не растёт
- [ ] Импорт tops с age=0 пиком → `water_depth_m` заполнен как `depth_md - kb_elev`
- [ ] Установить age=0 в Settings → `water_depth_m` обновился в Paleobathymetry
- [ ] Установить невалидный возраст → поле очистилось, в логе появилось предупреждение
- [ ] `pytest app/tests` — все тесты зелёные
