import { useViewStore, useWellDataStore } from '@/stores'

const ZOOM_PRESETS = [
  { label: '1:200', dpp: 0.2 },
  { label: '1:500', dpp: 0.5 },
  { label: '1:1000', dpp: 1.0 },
] as const

export function WellViewerToolbar() {
  const overviewVisible = useViewStore((state) => state.overviewVisible)
  const curveTooltipVisible = useViewStore((state) => state.curveTooltipVisible)
  const interactionMode = useViewStore((state) => state.interactionMode)
  const depthPerPixel = useViewStore((state) => state.depthPerPixel)
  const setOverviewVisible = useViewStore((state) => state.setOverviewVisible)
  const setCurveTooltipVisible = useViewStore((state) => state.setCurveTooltipVisible)
  const setInteractionMode = useViewStore((state) => state.setInteractionMode)
  const setScale = useViewStore((state) => state.setScale)
  const well = useWellDataStore((state) => state.well)

  function isZoomActive(dpp: number): boolean {
    return Math.abs(depthPerPixel - dpp) < 0.001
  }

  function handleFitToWell() {
    const { viewportHeight, setScroll, setScale: setScaleInner } = useViewStore.getState()
    const { fullCurves } = useWellDataStore.getState()
    if (fullCurves.length === 0) return
    let maxD = -Infinity
    for (const c of fullCurves) {
      if (c.depths.length > 0) maxD = Math.max(maxD, c.depths[c.depths.length - 1])
    }
    if (!Number.isFinite(maxD) || maxD <= 0) return
    setScroll(0)
    setScaleInner(maxD / viewportHeight)
  }

  function handleFitToContents() {
    const { viewportHeight, setScroll, setScale: setScaleInner } = useViewStore.getState()
    const { fullCurves } = useWellDataStore.getState()
    if (fullCurves.length === 0) return
    let minD = Infinity
    let maxD = -Infinity
    for (const c of fullCurves) {
      if (c.depths.length > 0) {
        minD = Math.min(minD, c.depths[0])
        maxD = Math.max(maxD, c.depths[c.depths.length - 1])
      }
    }
    if (!Number.isFinite(minD) || !Number.isFinite(maxD) || maxD <= minD) return
    setScroll(minD)
    setScaleInner((maxD - minD) / viewportHeight)
  }

  return (
    <div className="well-viewer-toolbar" aria-label="Well viewer tools">
      <button
        type="button"
        className={`well-viewer-toolbar__button ${overviewVisible ? 'well-viewer-toolbar__button--active' : ''}`}
        onClick={() => setOverviewVisible(!overviewVisible)}
        title="Toggle well overview"
      >
        <span className="well-viewer-toolbar__button-label">Overview</span>
      </button>
      <button
        type="button"
        className={`well-viewer-toolbar__button ${curveTooltipVisible ? 'well-viewer-toolbar__button--active' : ''}`}
        onClick={() => setCurveTooltipVisible(!curveTooltipVisible)}
        title="Toggle curve tooltip"
      >
        <span className="well-viewer-toolbar__button-label">Tooltip</span>
      </button>
      <button
        type="button"
        className={`well-viewer-toolbar__button ${interactionMode === 'edit-tops' ? 'well-viewer-toolbar__button--active' : ''}`}
        onClick={() => setInteractionMode(interactionMode === 'edit-tops' ? 'view' : 'edit-tops')}
        title="Toggle top editing mode"
      >
        <span className="well-viewer-toolbar__button-label">Edit tops</span>
      </button>
      <button
        type="button"
        className="well-viewer-toolbar__button"
        disabled={well === null}
        onClick={handleFitToWell}
        title="Fit view to full well"
      >
        <span className="well-viewer-toolbar__button-label">Fit well</span>
      </button>
      <button
        type="button"
        className="well-viewer-toolbar__button"
        disabled={well === null}
        onClick={handleFitToContents}
        title="Fit view to curve data"
      >
        <span className="well-viewer-toolbar__button-label">Fit data</span>
      </button>

      <div className="well-viewer-toolbar__divider" />

      {ZOOM_PRESETS.map((preset) => (
        <button
          key={preset.label}
          type="button"
          className={`well-viewer-toolbar__button ${isZoomActive(preset.dpp) ? 'well-viewer-toolbar__button--active' : ''}`}
          onClick={() => setScale(preset.dpp)}
          title={`Set scale to ${preset.label}`}
        >
          <span className="well-viewer-toolbar__button-label">{preset.label}</span>
        </button>
      ))}
    </div>
  )
}
