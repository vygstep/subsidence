# Subsidence Panel Module

This module covers subsidence/burial-history rendering and recalculation.

---

## Frontend Files

Files:

- `frontend/src/api/subsidenceSocket.ts`
- `frontend/src/components/subsidence/MultiWellPanel.tsx`
- `frontend/src/components/subsidence/SubsidencePanel.tsx`
- `frontend/src/components/subsidence/SubsidenceCanvas.tsx`
- `frontend/src/components/subsidence/SubsidenceControls.tsx`
- `frontend/src/components/subsidence/SubsidenceToolbar.tsx`
- `frontend/src/components/subsidence/GeologicalTimescale.tsx`
- `frontend/src/utils/exportPng.ts`
- `frontend/src/stores/computedStore.ts`

Responsibilities:

- Show burial/subsidence curves.
- Render axes, labels, formation fills, and curves.
- Render the geological timescale from the active project StratChart.
- Trigger recalculation.
- Expose display toggles and water depth.
- Export panel PNG.
- Maintain WebSocket connection and pending recalculation queue.
- Render stored multi-well results separately from active-well recalculation.
- Apply global model cutoff controls for reconstruct/truncate modes.

---

## Backend Files

Files:

- `app/src/subsidence/api/subsidence.py`
- `app/src/subsidence/data/backstrip.py`
- `app/src/subsidence/api/strat_chart.py`

Responsibilities:

- Receive WebSocket recalculation payloads.
- Run backstrip/subsidence calculations.
- Return calculated burial paths and curve data.
- Provide active StratChart units used by the frontend geological timescale and cutoff controls.

---

## Data Flow

1. Formation edits or controls trigger recalculation in `computedStore`.
2. `computedStore` calls `frontend/src/api/subsidenceSocket.ts`.
3. Frontend sends WebSocket payload to backend.
4. Backend calculates in a non-blocking path.
5. Frontend receives results.
6. `SubsidenceCanvas` redraws.

---

## Common Bug Areas

Start here for:

- Panel is blank.
- Stratigraphic header is missing.
- Recalculation does not trigger after top edits.
- Water depth does not affect curves.
- Export PNG is empty or clipped.
- Stored result panel and active recalculation panel show different states.
- WebSocket reconnect queues stale recalculation payloads.
- Timescale uses stale hardcoded units instead of the active StratChart.
- Global cutoff dropdown includes units outside the intended visible/data range.

Notes:

- Historical contract notes are kept locally by maintainers and are not part of the public documentation tree.
