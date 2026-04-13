# SUBSIDENCE Project — Interaction Contract

## Workflow

1. **Brainstorm & Discuss** — обсуждаем идеи, уточняем требования
2. **Record Contract** — записываем согласованный план в todo.md
3. **Execute** — реализуем, отчитываемся о результатах
4. **Confirm & Proceed** — каждый шаг подтверждаем перед следующим

## Rules

- **Commits only on request** — коммиты и пушы делаются только по твоему явному запросу
- **Show results, not do** — показываю написанный код и результаты, даю возможность отката
- **Clear checkpoints** — перед каждым выполнением уточняю план и жду подтверждения

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
