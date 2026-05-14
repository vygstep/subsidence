# Auto Depth Grid Step

Status: Active
Current branch: `fix/auto-depth-grid-step`

## Goal

Make horizontal depth grid spacing adapt to the current well viewer zoom while preserving a manual override for users.

## Expected Behavior

- Depth grid step has two modes:
  - `Auto`
  - `Manual`
- Default mode is `Auto`.
- In `Auto` mode:
  - the app chooses a major grid interval from `1, 10, 100, 250, 500, 1000` meters based on the visible depth span;
  - minor grid interval is derived from the major interval;
  - the same intervals are used by the depth track and data tracks;
  - settings show the current calculated values but do not allow editing them.
- In `Manual` mode:
  - user-defined `Major ticks` and `Minor ticks` are used;
  - the values are shared by depth track labels and data-track horizontal grid.
- Grey well padding zones remain visually above grid lines.

## Implementation Notes

- Add `gridStepMode: 'auto' | 'manual'` to `DepthTrackConfig`.
- Add a shared helper for interval selection.
- Keep existing saved `majorInterval` and `minorInterval` values so switching to Manual restores the last manual values.
- Existing projects without `gridStepMode` should behave as Auto.

## Likely Files

- `frontend/src/stores/viewStore.ts`
- `frontend/src/components/logview/DepthTrack.tsx`
- `frontend/src/components/logview/DataTrack.tsx`
- `frontend/src/components/layout/settings/DepthTrackSettings.tsx`
- `frontend/src/renderers/gridRenderer.ts`
- new helper/test under `frontend/src/utils` and `frontend/src/__tests__/unit`

## Verification

- Unit tests for interval selection.
- Manual check:
  - zoom in until major interval is 1 m;
  - zoom out through 10, 100, 250, 500, 1000 m;
  - switch to Manual and verify custom intervals are used on all tracks;
  - grey padding zones still cover grid above KB and below TD.
