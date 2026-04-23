# SUBSIDENCE Project — Interaction Contract

## Workflow

1. **Brainstorm & Discuss** — обсуждаем идеи, уточняем требования
2. **Record Contract** — записываем согласованный план в активный контракт under `docs/contracts/`
3. **Execute** — реализуем, отчитываемся о результатах
4. **Confirm & Proceed** — каждый шаг подтверждаем перед следующим

## Planning Files

- `todo.md` contains only active work that still needs to be done.
- Every `todo.md` item must link to an active contract in `docs/contracts/`.
- Completed items are removed from `todo.md`; do not keep checked-off historical clutter there.
- Completed or superseded contracts are moved to `docs/contracts/implemented/`.
- Current architecture/navigation docs live directly under `docs/` and `docs/modules/`.
- `docs/contracts/implemented/` is legacy implementation history, not the active development plan.

## Rules

- **Commits only on request** — коммиты и пушы делаются только по твоему явному запросу
- **Show results, not do** — показываю написанный код и результаты, даю возможность отката
- **Clear checkpoints** — перед каждым выполнением уточняю план и жду подтверждения
- **Language** — общение в чате на русском; весь код, документация, комментарии, ADR — на английском

---

## Project Scope

**Уровень A — Burial History:**
- Возраст, глубина, толщина слоев
- Учет эрозии
- История захоронения

**Уровень B — Tectonic Subsidence (Backstripping):**
- Снятие эффекта уплотнения (decompaction)
- Снятие нагрузки воды и осадков
- Расчет тектонической субсиденции

---

## Reference Repositories

| Repo | Статус | Приоритет | Назначение |
|---|---|---|---|
| pybasin | cloned | HIGH | burial history, thermal model |
| pyBacktrack | cloned | CRITICAL | backstrip, decompaction |
| py_lopatin | cloned | MEDIUM | Lopatin-logic, burial calc |
| Stratya2D | cloned | LOW | 2D decompaction (опционально) |

---

## Status

✅ Project scaffold created  
✅ Repositories cloned to `repos/`  
✅ Initial commit pushed to GitHub  
✅ `.gitignore` configured  
✅ Interaction contract (agents.md) created  

---

## Next: Review todo.md for current planning
