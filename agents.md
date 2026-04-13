# SUBSIDENCE Project — Interaction Contract

## Workflow

1. **Brainstorm & Discuss** — обсуждаем идеи, уточняем требования
2. **Record Contract** — записываем согласованный план в TODO список
3. **Execute** — реализуем, коммитим, отчитываемся
4. **Confirm & Proceed** — каждый шаг подтверждаем перед следующим

---

## Current Phase: Project Architecture & Reference Analysis

### Goals (Уровень A & B)

**Уровень A — Burial History:**
- Возраст, глубина, толщина слоев
- Учет эрозии
- История захоронения

**Уровень B — Tectonic Subsidence (Backstripping):**
- Снятие эффекта уплотнения (decompaction)
- Снятие нагрузки воды и осадков
- Расчет тектонической субсиденции

### Reference Repositories

| Repo | Статус | Приоритет | Заметки |
|---|---|---|---|
| pybasin | cloned | HIGH | burial history, thermal model |
| pyBacktrack | cloned | CRITICAL | backstrip, decompaction |
| py_lopatin | cloned | MEDIUM | Lopatin-logic, burial calc |
| Stratya2D | cloned | LOW | 2D decompaction (опционально) |

---

## TODO — Current Sprint

- [ ] **A1** — Audit pyBacktrack source code (backstrip.py, decompact modules)
- [ ] **A2** — Document input/output format contract (CSV, JSON, or binary)
- [ ] **B1** — Design data model for well, strata, ages, depths
- [ ] **B2** — Implement burial history module (align with pybasin patterns)
- [ ] **C1** — Implement backstripping/decompaction module (adapt from pyBacktrack)
- [ ] **D1** — Create CLI integration (combine A + C modules)
- [ ] **Test** — End-to-end test with synthetic well data

---

## Completed

✅ Project scaffold created  
✅ Repositories cloned to `repos/`  
✅ Initial commit pushed to GitHub  
✅ `.gitignore` configured  

---

## Next Checkpoint

**Awaiting confirmation before proceeding to TODO A1.**

What would you like to tackle first?
