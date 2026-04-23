# Subsidence Panel Module

This module covers subsidence/burial-history rendering and recalculation.

---

## Frontend Files

Files:

- `frontend/src/components/subsidence/MultiWellPanel.tsx`
- `frontend/src/components/subsidence/SubsidenceCanvas.tsx`
- `frontend/src/components/subsidence/SubsidenceControls.tsx`
- `frontend/src/utils/exportPng.ts`
- `frontend/src/stores/computedStore.ts`

Responsibilities:

- Show burial/subsidence curves.
- Render axes, labels, formation fills, and curves.
- Trigger recalculation.
- Expose display toggles and water depth.
- Export panel PNG.

---

## Backend Files

Files:

- `app/src/subsidence/api/subsidence.py`
- `app/src/subsidence/data/backstrip.py`

Responsibilities:

- Receive WebSocket recalculation payloads.
- Run backstrip/subsidence calculations.
- Return calculated burial paths and curve data.

---

## Data Flow

1. Formation edits or controls trigger recalculation in `computedStore`.
2. Frontend sends WebSocket payload to backend.
3. Backend calculates in a non-blocking path.
4. Frontend receives results.
5. `SubsidenceCanvas` redraws.

---

## Common Bug Areas

Start here for:

- Panel is blank.
- Stratigraphic header is missing.
- Recalculation does not trigger after top edits.
- Water depth does not affect curves.
- Export PNG is empty or clipped.

Historical bug notes:

- See `docs/contracts/implemented/subsidence-panel-bug-report.md`.
