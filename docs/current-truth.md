# Current Truth

This document defines what is currently treated as true for the active project.
Last updated: 2026-04-22

---

## Phase Status

| Phase | Status | Contract |
|---|---|---|
| Phase 1 — scaffold + static rendering | ✅ complete | `phase1-contract.md` |
| Phase 2 — multi-curve, grids, formations column | ✅ complete | `phase2-contract.md` |
| Phase 2.5 — persistence (project bundle, SQLite, Parquet) | ✅ complete | `phase2.5-data_contract.md` |
| Phase 3 — interactivity (drag, tooltips, undo, strat chart) | ✅ complete | `phase3-contract.md` + cleanup contracts |
| Phase 4 — subsidence integration (backstrip, WebSocket, TVD) | ✅ complete | `phase4-contract.md` |
| Phase 5 — curve fills, subsidence controls, export, quality | 🔜 next | `phase5-contract.md` |

---

## Active Architecture

- **Frontend**: React 18 + TypeScript + Vite in `frontend/`
- **Rendering**: Canvas (curves, depth track, formations, subsidence) + SVG overlay (formation tops, cursor)
- **State**: Zustand — four stores: `wellDataStore`, `viewStore`, `workspaceStore`, `projectStore`, `computedStore`
- **Backend**: FastAPI in `app/src/subsidence/` — routers under `/api` prefix
- **Persistence**: project bundle directory (`.subsidence/`) — SQLite `project.db` + sidecar Parquet curve files
- **Subsidence computation**: `app/src/subsidence/data/backstrip.py` — Athy decompaction, Airy isostasy
- **Real-time recalc**: WebSocket at `/api/ws/recalculate` — module-level singleton `subsidenceSocket.ts`

---

## Key File Locations

### Backend (`app/src/subsidence/`)
| File | Role |
|---|---|
| `api/main.py` | FastAPI app, router registration, CORS |
| `api/wells.py` | Well CRUD, LOD endpoint, deviation endpoint |
| `api/formations.py` | Formation top CRUD |
| `api/compaction.py` | Compaction model CRUD, lithology-params CRUD |
| `api/projects.py` | Project lifecycle, visual config, checkpoints, undo/redo |
| `api/strat_chart.py` | Strat chart management |
| `api/subsidence.py` | REST + WebSocket subsidence calculation |
| `data/schema.py` | SQLAlchemy models (Well, FormationTop, CompactionModel, StratUnit, …) |
| `data/project_manager.py` | ProjectManager state machine, autosave, lock |
| `data/undo.py` | UndoStack + Command pattern |
| `data/backstrip.py` | Airy backstripping + Athy decompaction (standalone, no pybasin import) |
| `data/lttb.py` | LTTB downsampling |
| `data/strat_link.py` | Auto-link formation tops to strat chart units |

### Frontend (`frontend/src/`)
| File | Role |
|---|---|
| `App.tsx` | Root: project hydration, polling, well loading effects |
| `stores/wellDataStore.ts` | Well data, formations, curves, TVD, LOD, undo polling |
| `stores/viewStore.ts` | Scroll, scale, selection, depthType, trackWidths, splitRatio |
| `stores/workspaceStore.ts` | Sidebar tabs, selected object, wellViewStates |
| `stores/projectStore.ts` | Project open/close, visualConfig, save, checkpoint |
| `stores/computedStore.ts` | subsidenceCurves, isComputing, triggerRecalculation |
| `api/subsidenceSocket.ts` | WebSocket singleton for `/api/ws/recalculate` |
| `hooks/useCanvasRenderer.ts` | Canvas lifecycle (ResizeObserver + rAF) |
| `hooks/useFormationDrag.ts` | Formation top pointer drag |
| `hooks/useSynchronizedScroll.ts` | Wheel → viewStore scroll/zoom |
| `hooks/useWebSocket.ts` | Generic reconnecting WS hook (unused by subsidence, available) |
| `renderers/curveRenderer.ts` | `drawCurve` — line segments, null gaps, Path2D |
| `renderers/fillRenderer.ts` | `drawFill` stub (not yet implemented for crossover fills) |
| `renderers/gridRenderer.ts` | Linear + log gridlines |
| `renderers/depthLabelsRenderer.ts` | Depth tick labels |
| `renderers/lithologyRenderer.ts` | Lithology pattern fills (hatch, dots, etc.) |
| `renderers/subsidenceRenderer.ts` | `drawBurialCurves`, `drawFormationFills` |
| `components/logview/LogViewPanel.tsx` | Well log container: headers + track row + interaction overlay |
| `components/logview/DataTrack.tsx` | Canvas-rendered curve track |
| `components/logview/DepthTrack.tsx` | Depth labels canvas track |
| `components/logview/FormationColumn.tsx` | Formation blocks canvas track |
| `components/logview/TrackHeaderRow.tsx` | Sticky header strip |
| `components/logview/TrackHeader.tsx` | Per-track header |
| `components/interaction/InteractionOverlay.tsx` | SVG overlay (formation lines, cursor) |
| `components/interaction/FormationTopLine.tsx` | Draggable formation top line |
| `components/subsidence/SubsidencePanel.tsx` | Subsidence container with loading overlay |
| `components/subsidence/SubsidenceCanvas.tsx` | Canvas: time × depth burial history |
| `components/subsidence/GeologicalTimescale.tsx` | ICS period bar (CSS flex) |
| `components/subsidence/SubsidenceControls.tsx` | Controls stub (empty) |
| `components/layout/SettingsInspector.tsx` | Right-panel property editor |
| `components/layout/DataManagerPane.tsx` | Left sidebar (wells, models, strat charts) |
| `utils/depthTransform.ts` | `minCurvatureToTVD`, `mdToTvd` |
| `utils/geologicalTimescale.ts` | `GEOLOGIC_PERIODS` ICS array |

---

## Known Issues (from `аудит кода после фазы 4.md`)

### Fixed in audit commit `78e8998`
- WebSocket URL was wrong (`/ws/recalculate` → `/api/ws/recalculate`)
- Vite proxy missing `ws: true` for `/api`
- `useFormationDrag` subscription memory leak
- `sendRecalculation` race condition (CONNECTING state)

### Outstanding — high priority
- `pendingDepthPatches` (module-level Map) not cleared on well switch — risk of stale depth patch
- `isComputing` can stick `true` if WS drops mid-computation — no timeout
- `get_deviation` reads parquet outside session context (minor — attr access safe, but fragile)
- `load_curves_from_parquet` reads only first parquet URI — silently drops curves from other imports

### Outstanding — medium priority
- `tkinter` file dialogs block async event loop (no `run_in_executor`)
- `_autosave_loop` calls synchronous DB write in async context
- `activate_strat_chart` bypasses undo stack

---

## Working Rules

- Use local `.venv` (Python) and system `node`/`npm` (frontend) only.
- `npx tsc --noEmit` must pass before any commit with frontend changes.
- All DB mutations go through `UndoCommand` (exception: compaction params, strat chart activation).
- Backend routers are registered with `prefix="/api"` — WS endpoints live at `/api/ws/...`.
- Canvas renderers are pure functions (no React, no store access).
- Zustand store subscriptions inside hooks must be cleaned up with `useEffect` returning unsubscribe.
