import { useViewStore, useWellDataStore } from '@/stores'

const DEPTH_TYPES = ['MD', 'TVD', 'TVDSS'] as const

export function WellViewerToolbar() {
  const overviewVisible = useViewStore((state) => state.overviewVisible)
  const curveTooltipVisible = useViewStore((state) => state.curveTooltipVisible)
  const interactionMode = useViewStore((state) => state.interactionMode)
  const depthType = useViewStore((state) => state.depthType)
  const tvdTable = useWellDataStore((state) => state.tvdTable)
  const kbElev = useWellDataStore((state) => state.well?.kb_elev ?? 0)
  const hasWell = useWellDataStore((state) => state.well !== null)
  const setOverviewVisible = useViewStore((state) => state.setOverviewVisible)
  const setCurveTooltipVisible = useViewStore((state) => state.setCurveTooltipVisible)
  const setInteractionMode = useViewStore((state) => state.setInteractionMode)
  const setDepthType = useViewStore((state) => state.setDepthType)

  function handleFitToWell() {
    const { viewportHeight, setScroll, setScale } = useViewStore.getState()
    const { fullCurves } = useWellDataStore.getState()
    if (fullCurves.length === 0) return
    let maxD = -Infinity
    for (const c of fullCurves) {
      if (c.depths.length > 0) maxD = Math.max(maxD, c.depths[c.depths.length - 1])
    }
    if (!Number.isFinite(maxD) || maxD <= 0) return
    setScroll(0)
    setScale(maxD / viewportHeight)
  }

  function handleFitToContents() {
    const { viewportHeight, setScroll, setScale } = useViewStore.getState()
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
    setScale((maxD - minD) / viewportHeight)
  }

  return (
    <div className="well-viewer-toolbar" aria-label="Well viewer tools">
      <button
        type="button"
        className={`well-viewer-toolbar__button ${overviewVisible ? 'well-viewer-toolbar__button--active' : ''}`}
        onClick={() => setOverviewVisible(!overviewVisible)}
      >
        <span className="well-viewer-toolbar__button-label">Overview</span>
      </button>
      <button
        type="button"
        className={`well-viewer-toolbar__button ${curveTooltipVisible ? 'well-viewer-toolbar__button--active' : ''}`}
        onClick={() => setCurveTooltipVisible(!curveTooltipVisible)}
      >
        <span className="well-viewer-toolbar__button-label">Tooltip</span>
      </button>
      <button
        type="button"
        className={`well-viewer-toolbar__button ${interactionMode === 'edit-tops' ? 'well-viewer-toolbar__button--active' : ''}`}
        onClick={() => setInteractionMode(interactionMode === 'edit-tops' ? 'view' : 'edit-tops')}
      >
        <span className="well-viewer-toolbar__button-label">Edit tops</span>
      </button>
      <button
        type="button"
        className="well-viewer-toolbar__button"
        disabled={!hasWell}
        onClick={handleFitToWell}
      >
        <span className="well-viewer-toolbar__button-label">Fit well</span>
      </button>
      <button
        type="button"
        className="well-viewer-toolbar__button"
        disabled={!hasWell}
        onClick={handleFitToContents}
      >
        <span className="well-viewer-toolbar__button-label">Fit data</span>
      </button>
      <div className="well-viewer-toolbar__depth-type" role="group" aria-label="Depth type">
        {DEPTH_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            className={`well-viewer-toolbar__button well-viewer-toolbar__button--compact ${depthType === t ? 'well-viewer-toolbar__button--active' : ''}`}
            disabled={t === 'TVDSS' ? (!tvdTable && kbElev === 0) : false}
            onClick={() => setDepthType(t)}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}
