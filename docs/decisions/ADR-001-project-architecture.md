# ADR-001: Project Architecture — SUBSIDENCE

**Status:** Accepted  
**Date:** 2026-04-13

---

## Context

Проект SUBSIDENCE — инструмент для расчета и визуализации кривой погружения (subsidence curve) на основе данных скважин: каротажа, отбивок и стратиграфической колонки.

Два уровня расчетов:
- **Уровень A (Burial History):** история захоронения слоев с учетом возрастов, глубин, толщин, эрозии
- **Уровень B (Tectonic Subsidence):** backstripping — снятие эффекта уплотнения и нагрузки, получение кривой тектонической субсиденции

---

## Decisions

### 1. Frontend: Dash + Plotly

**Выбор:** Dash (Plotly) + dash-bootstrap-components  
**Альтернатива:** Streamlit  
**Причина:**  
- Необходима точная компоновка: вертикальная колонка стратиграфии слева, кривые каротажа справа
- Нативная поддержка hover, zoom, callbacks без хаков
- Единая кодовая база на Python — проще переиспользовать логику расчетов
- Легко расширяется на 2D визуализацию

### 2. Backend: FastAPI

**Выбор:** FastAPI  
**Причина:**  
- REST API для парсинга LAS/CSV и запуска расчетов burial/subsidence
- Async-ready, хорошо масштабируется
- Автоматическая OpenAPI документация

### 3. Data Storage: File-based + SQLite

**Выбор:** Сырые данные на диске, метаданные и результаты в SQLite  
**Альтернативы:** только файлы / PostgreSQL  
**Причина:**  
- LAS-файлы — стандартный геофизический формат, хранятся как есть
- SQLite — нет сервера, один файл `project.db`, подходит для локального инструмента
- PostgreSQL — избыточно на текущем этапе, можно подключить позже без переделки архитектуры

**Структура файлов:**
```
data/
  stratigraphy_master.csv       # эталонная стратиграфическая колонка
  wells/
    <well_name>/
      metadata.json             # имя, координаты, TD, CRS
      logs.las                  # каротаж (читается через lasio)
      tops.csv                  # отбивки: formation, depth_top, depth_bot
```

**SQLite (project.db) tables:**
- `wells` — метаданные скважин
- `tops` — отбивки (linked to well)
- `strat_units` — стратиграфические юниты (из master CSV)
- `burial_results` — результаты расчетов burial history
- `subsidence_results` — результаты backstripping

### 4. LAS Parsing: lasio

**Выбор:** lasio  
**Причина:** де-факто стандарт для чтения LAS-файлов в Python, активно поддерживается

### 5. Reference Repositories

Логика заимствуется из open-source репозиториев, не добавляются как зависимости:

| Repo | Что заимствуем |
|---|---|
| pyBacktrack | decompaction, backstripping алгоритмы |
| pybasin | burial history, тепловая история |
| py_lopatin | Lopatin-логика для зрелости органики |
| Stratya2D | 2D decompaction (опционально) |

### 6. Project Layout

```
app/
  src/subsidence/
    api/          # FastAPI endpoints
    core/         # расчеты: burial history, backstripping, decompaction
    data/         # парсинг LAS, CSV, SQLite слой
    viz/          # Dash layout и Plotly компоненты
  tests/
data/
  stratigraphy_master.csv
  wells/
docs/
  decisions/      # ADR (Architecture Decision Records)
repos/            # клонированные референс-репозитории (в .gitignore)
```

---

## Consequences

- Весь стек на Python → единая кодовая база
- Dash — не классическое SPA (нет роутинга как в React), но достаточно для инструмента анализа
- SQLite — не подходит для многопользовательского режима; при необходимости заменяем на PostgreSQL через SQLAlchemy (без изменения бизнес-логики)
