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


### `rebuild_horizon_links(session, top_set_id)` — деструктивный
Сбрасывает все `horizon_id` у пиков, затем перепривязывает по `age_top_ma`. Вызывать только когда пользователь явно меняет `age_ma` у горизонта — не при открытии проекта.

---

## Схема БД

- Нет Alembic. Миграции — лёгкие `ALTER TABLE` в `data/engine.py`.
- Любое новое поле в `schema.py` требует миграции в `engine.py`.

---

## Undo/Redo

- Все мутирующие операции — через `manager.execute_command(...)`.
- `UpdateFormationDepth` — отдельная команда для изменения только глубины пика.
- Исключение: import-pipeline (нет undo для целого импорта).

---

## Антипаттерны

- ❌ Вызывать `recalculate_zone_thickness` без `ensure_zone_well_data` перед ним — молча не сработает.
- ❌ Вызывать `rebuild_horizon_links` при открытии проекта — сбросит все `horizon_id`.
- ❌ Менять URL роутов без обновления фронтенда — 404 молча игнорируются в некоторых местах (`if (!response.ok) return`).
- ❌ Делать async роуты с нативными диалогами (`pick-file`, `pick-folder`) — блокируют event loop.

---

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
