import { useViewStore, useWellDataStore } from '@/stores'

const ZOOM_PRESETS = [
  { label: '1:200', dpp: 0.2 },
  { label: '1:500', dpp: 0.5 },
  { label: '1:1000', dpp: 1.0 },
] as const

const LOG_VIEW_DEPTH_PADDING_M = 100

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
  const formations = useWellDataStore((state) => state.formations)
  const fullCurves = useWellDataStore((state) => state.fullCurves)

  function isZoomActive(dpp: number): boolean {
    return Math.abs(depthPerPixel - dpp) < 0.001
  }

  function handleFitToWell() {
    const { viewportHeight, setScroll, setScale: setScaleInner } = useViewStore.getState()
    let maxD = -Infinity
    if (well?.td_md !== undefined && Number.isFinite(well.td_md)) {
      maxD = Math.max(maxD, well.td_md)
    }
    for (const c of fullCurves) {
      if (c.depths.length > 0) maxD = Math.max(maxD, c.depths[c.depths.length - 1])
    }
    for (const formation of formations) {
      if (formation.depth_md !== null && Number.isFinite(formation.depth_md)) {
        maxD = Math.max(maxD, formation.depth_md)
      }
    }
    const wellBottomDepth = Math.max(Number.isFinite(maxD) ? maxD : 0, 0)
    const minDepth = -LOG_VIEW_DEPTH_PADDING_M
    const maxDepth = wellBottomDepth + LOG_VIEW_DEPTH_PADDING_M
    setScroll(minDepth)
    setScaleInner(Math.max((maxDepth - minDepth) / viewportHeight, 0.05))
  }

  function handleFitToContents() {
    const { viewportHeight, setScroll, setScale: setScaleInner } = useViewStore.getState()
    let minD = Infinity
    let maxD = -Infinity
    for (const c of fullCurves) {
      if (c.depths.length > 0) {
        minD = Math.min(minD, c.depths[0])
        maxD = Math.max(maxD, c.depths[c.depths.length - 1])
      }
    }
    for (const formation of formations) {
      if (formation.depth_md !== null && Number.isFinite(formation.depth_md)) {
        minD = Math.min(minD, formation.depth_md)
        maxD = Math.max(maxD, formation.depth_md)
      }
    }
    if (!Number.isFinite(minD) || !Number.isFinite(maxD)) return
    const span = Math.max(maxD - minD, LOG_VIEW_DEPTH_PADDING_M)
    setScroll(minD - (span - (maxD - minD)) / 2)
    setScaleInner(Math.max(span / viewportHeight, 0.05))
  }

  const hasFitData = fullCurves.some((curve) => curve.depths.length > 0)
    || formations.some((formation) => formation.depth_md !== null)

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
        disabled={well === null || !hasFitData}
        onClick={handleFitToContents}
        title="Fit view to curve and top data"
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
