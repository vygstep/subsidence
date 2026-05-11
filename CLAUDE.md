# SUBSIDENCE — рабочий контекст

Локальное веб-приложение для анализа погружения осадочных бассейнов (1D backstrip).
Backend: FastAPI + SQLite + Parquet. Frontend: React + Zustand + Canvas.

## Запуск

```bash
# Backend
cd app && uvicorn subsidence.api.main:app --reload --port 8000

# Frontend
cd frontend && npm run dev
```

Тесты: `cd app && pytest tests` / `cd frontend && npm run test -- --run`

---

## Структура

```
app/src/subsidence/
  api/          ← HTTP роуты (тонкий слой): main.py, wells.py, formations.py,
                  top_sets.py, projects*.py, subsidence.py, sea_level.py, ...
                  _deps.py ← общие зависимости: get_manager, require_open_project,
                             manager_project_path (используются во всех роут-модулях)
  data/         ← бизнес-логика: schema.py, zone_service.py, undo.py,
                  project_manager.py, engine.py, importers/, backstrip.py, ...
frontend/src/
  stores/       ← Zustand: projectStore, wellDataStore, workspaceStore,
                  viewStore, computedStore, multiWellStore
  components/   ← UI: logview/, subsidence/, layout/ (DataManager, Settings, dialogs)
docs/           ← архитектура, карта кода, контракты фаз
```

Подробная карта с "куда смотреть по типу бага": `docs/codebase-map.md`.

---

## Текущая архитектура: активные TopSet и SeaLevel

**Сейчас (per-well):**
- `WellActiveTopSet` — таблица, хранит активный TopSet для каждой скважины
- `WellActiveSeaLevelCurve` — таблица, хранит активную кривую для каждой скважины
- Получить: `session.scalar(select(WellActiveTopSet).where(WellActiveTopSet.well_id == well_id))`
- Установить: `activate_top_set_for_well(session, project_path, well_id, top_set_id)`

`activate_top_set_for_well` делает всё сразу: записывает ссылку, привязывает пики по имени (`link_picks_to_horizons`), создаёт ghost-пики (`create_ghost_picks`), создаёт ZoneWellData строки (`ensure_zone_well_data`), пересчитывает толщины (`recalculate_zone_thickness`), агрегирует литологию.

---

## Зоны и пересчёт

### Вызывать в таком порядке:
```python
ensure_zone_well_data(session, top_set_id, well_id)   # 1. создаём строки ZoneWellData
recalculate_zone_thickness(session, top_set_id, well_id)  # 2. считаем толщины
aggregate_zone_lithology_from_curve(session, path, well_id)  # 3. литология (если нужно)
```

**`recalculate_zone_thickness` НЕ вызывает `ensure_zone_well_data` сам** — если пропустить шаг 1, `zwd is None` → `continue` → ничего не пересчитается, молча.


### После кросс-скважинного импорта: порядок горизонтов
`normalize_top_set_horizon_order(session, top_set_id)` — пересортирует горизонты TopSet по `age_ma` после импорта нескольких скважин. Вызывать после добавления новых горизонтов в существующий TopSet.

Привязка пиков к горизонтам — **только по имени** (`link_picks_to_horizons`). Функции `rebuild_horizon_links` больше не существует — не ссылаться на неё.

---

## Схема БД

- Нет Alembic. Миграции — лёгкие `ALTER TABLE` в `data/engine.py`.
- Любое новое поле в `schema.py` требует миграции в `engine.py`.
- Текущий `SCHEMA_VERSION = 14` в `schema.py`.

---

## Undo/Redo

- Все мутирующие операции — через `manager.execute_command(...)`.
- `UpdateFormationDepth` — отдельная команда для изменения только глубины пика.
- Исключение: import-pipeline (нет undo для целого импорта).

---

## Антипаттерны

- ❌ Вызывать `recalculate_zone_thickness` без `ensure_zone_well_data` перед ним — молча не сработает.
- ❌ Вызывать несуществующую `rebuild_horizon_links` — функция удалена; привязка пиков теперь только через `link_picks_to_horizons` (по имени).
- ❌ Менять URL роутов без обновления фронтенда — 404 молча игнорируются в некоторых местах (`if (!response.ok) return`).
- ❌ Делать async роуты с нативными диалогами (`pick-file`, `pick-folder`) — блокируют event loop.
- ❌ Добавлять `_require_open_project`/`_manager` helper напрямую в новый роут-модуль — импортировать из `api/_deps.py`.

---

---

## Зоны: слияние и разделение

`merge_zones_on_horizon_delete` и `apply_split_zone_lithology` сохраняют `lithology_source`:
- `auto + auto` → merged `auto`
- `manual + auto` → merged `manual` (сохраняет manual-фракции)
- `manual + manual` → merged `manual` (взвешенное среднее по толщинам)
- split manual-зоны → обе копии получают `manual` с исходными фракциями

`floor_match_horizon` — публичная функция в `zone_service.py` (не `_floor_match_horizon`).

---

## Куда смотреть по симптому

| Симптом | Файлы |
|---|---|
| 502 при старте | ImportError в API модуле → проверить `api/main.py` и импорты |
| Зоны не пересчитываются | `data/zone_service.py` |
| Зоны не видны в UI | `api/wells.py` (list_well_zones, inventory), `WellActiveTopSet` не установлен |
| Маркеры двигаются, погружение не обновляется | `computedStore.triggerRecalculation`, WebSocket `/api/ws/recalculate` |
| Undo не работает | операция не обёрнута в `manager.execute_command` |
| Пики без horizon_id | `link_picks_to_horizons` не вызван или имена не совпали |
| Горизонты TopSet в неверном порядке после импорта | `normalize_top_set_horizon_order` не вызван после кросс-скважинного импорта (`data/zone_service.py`) |
| Литология зоны не обновляется после изменений | `ZoneWellData.lithology_source == 'manual'` — auto-агрегация пропускает manual-зоны |
