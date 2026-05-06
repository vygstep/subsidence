# REFACTOR-001: Cleanup & Bug fixes

Отдельная ветка от `main`. Не зависит от BF5-002.

## Status legend
`todo` · `partial` · `done`

---

## Этап 1 — Нулевой риск (чистый рефактор)

### R1: Общий `api/_deps.py` `todo`

`_require_open_project` и `_manager` скопированы дословно в 8 файлах:
`wells.py`, `formations.py`, `top_sets.py`, `strat_chart.py`, `subsidence.py`,
`sea_level.py`, `compaction.py`, `lithology_patterns.py`

Создать `app/src/subsidence/api/_deps.py`:

```python
from fastapi import HTTPException, Request
from ..data.project_manager import ProjectManager

def get_manager(request: Request) -> ProjectManager:
    return request.app.state.project_manager

def require_open_project(request: Request) -> ProjectManager:
    manager = request.app.state.project_manager
    if not manager.is_open:
        raise HTTPException(status_code=400, detail='No project is currently open')
    return manager

def manager_project_path(manager: ProjectManager) -> str | None:
    return str(manager.project_path) if manager.project_path else None
```

Во всех 8 файлах: удалить локальные копии, добавить импорт из `._deps`.
Переименовать вызовы: `_require_open_project` → `require_open_project`.

**Файлы**: все 8 API модулей + новый `api/_deps.py`
**Риск**: нулевой — чистый перенос без изменения логики

---

### R2: `_floor_match_horizon` → публичный `todo`

`zone_service.py` определяет `_floor_match_horizon` с `_` (приватный).
`formations.py` его импортирует напрямую — coupling через приватное имя.

Переименовать в `zone_service.py`: `_floor_match_horizon` → `floor_match_horizon`.
Обновить импорт в `formations.py`.

**Файлы**: `data/zone_service.py`, `api/formations.py`
**Риск**: нулевой

---

### R3: Починить stale docs `todo`

- `docs/codebase-map.md` и `docs/backend-api.md` — убрать ссылки на `projects_export.py`
  (файл не существует, роутер не зарегистрирован)
- `docs/modules/backend-api.md` — добавить `GET /api/wells/{id}/curves/full`
- `docs/modules/backend-api.md` — добавить соглашение по `start_age_ma`/`end_age_ma`
  (start = старше/больше Ma, end = моложе/меньше Ma)
- `app/src/subsidence/data/schema.py` — добавить комментарий к `WellModel.lat`/`lon`:
  `# NOTE: lon stores X coordinate, lat stores Y coordinate — historical inversion`

**Файлы**: docs, schema.py
**Риск**: нулевой

---

## Этап 2 — Баг-фиксы (с тестами)

### B1: waterDepthM слайдер не работает `todo`

**Симптом**: пользователь двигает Water depth в SubsidencePanel → расчёт запускается,
результат не меняется.

**Причина**: `api/subsidence.py:ws_recalculate` читает только `well_id` из WebSocket payload,
`water_depth_m` игнорируется. `computedStore` шлёт его, но бэкенд выбрасывает.

**Фикс**:
- `ws_recalculate` — читать `water_depth_m` из payload
- передавать в `_compute_subsidence` как override параметр
- `_compute_subsidence` — использовать override вместо значения из DB если передан

**Тест**: WebSocket запрос с `water_depth_m=1000` → результат отличается от `water_depth_m=0`

**Файлы**: `api/subsidence.py`

---

### B3: merge_zones замораживает литологию `todo`

**Симптом**: после удаления горизонта (зоны мержатся), литология объединённой зоны
перестаёт обновляться автоматически из кривой.

**Причина**: `zone_service.py:merge_zones_on_horizon_delete` ставит
`lithology_source='manual'` на объединённую ZoneWellData. Auto-агрегация
проверяет `lithology_source != 'auto'` и пропускает такие зоны.

**Фикс**: вместо хардкода `'manual'` — взять `lithology_source` от зоны с бо́льшей
толщиной (primary zone). Если обе `'auto'` → оставить `'auto'`.

**Файлы**: `data/zone_service.py:merge_zones_on_horizon_delete`

---

## Этап 3 — Структурный рефактор (после Этапа 1+2)

Делать только когда есть integration тесты на затронутые эндпоинты.

### R7: Разбить `api/wells.py` `todo`

968 строк, 15 эндпоинтов, 20+ Pydantic-моделей.

Порядок безопасного разбиения:
1. Вынести все Pydantic-модели в `api/models/wells.py` (нет логики, нет риска)
2. `api/wells_core.py` — list/get/patch well, deviation
3. `api/wells_curves.py` — LOD + full кривые
4. `api/wells_zones.py` — zones list/patch/recalculate
5. Обновить `api/main.py` — зарегистрировать 3 новых роутера вместо одного

**Файлы**: `api/wells.py` → 4 файла, `api/main.py`

---

### R8: Разбить `update_formation` `todo`

150 строк, 8 логических задач в одной функции.

Выделить pure helpers (без изменения поведения):
- `_resolve_depth(body, well) → depth_md` — TVD→MD back-calc
- `_apply_color_changes(row, body) → (old, new)` — color + color_source
- `_validate_age_order(session, well_id, formation_id, age) → (valid_age, warning | None)`
- `_apply_age_zero_water_depth(session, well, row, new_values)` — water_depth auto-set

Функция `update_formation` вызывает хелперы по порядку.

**Файлы**: `api/formations.py`

---

## Этап 4 — Долгосрочно (отдельное планирование)

### R9: Разбить `wellDataStore.ts` (1210 строк)

`wellCoreStore.ts` — well, curves, formations, tvdTable
`dictionaryStore.ts` — литология, компакция, морнемоник-сеты, стратчарты, sea level

90+ компонентов импортируют из wellDataStore. Делать через re-export shim.

### R10: Убрать legacy FormationInput путь в subsidence

`api/subsidence.py:163–200` — дублирует zone_service логику.
Prerequisite: все проекты должны иметь TopSet.

### R11: Починить `inputs_hash`

`api/subsidence.py:227` — сейчас `sha256(well_id)`, всегда одинаковый.
Должен хешировать реальные входные данные.

---

## Порядок коммитов в ветке

```
1. R1: extract api/_deps.py
2. R2: floor_match_horizon public
3. R3: fix stale docs
4. B1: waterDepthM WebSocket fix + test
5. B3: merge_zones lithology_source fix
6. R7: split wells.py (только после integration тестов)
7. R8: extract update_formation helpers
```
