import { useViewStore, useWellDataStore } from '@/stores'

const DEPTH_TYPES = ['MD', 'TVD', 'TVDSS'] as const

export function WellViewerToolbar() {
  const overviewVisible = useViewStore((state) => state.overviewVisible)
  const curveTooltipVisible = useViewStore((state) => state.curveTooltipVisible)
  const interactionMode = useViewStore((state) => state.interactionMode)
  const depthType = useViewStore((state) => state.depthType)
  const setOverviewVisible = useViewStore((state) => state.setOverviewVisible)
  const setCurveTooltipVisible = useViewStore((state) => state.setCurveTooltipVisible)
  const setInteractionMode = useViewStore((state) => state.setInteractionMode)
  const setDepthType = useViewStore((state) => state.setDepthType)
  const reloadCurvesForDepthBasis = useWellDataStore((state) => state.reloadCurvesForDepthBasis)

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
      <div className="well-viewer-toolbar__depth-type" role="group" aria-label="Depth type">
        {DEPTH_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            className={`well-viewer-toolbar__button well-viewer-toolbar__button--compact ${depthType === t ? 'well-viewer-toolbar__button--active' : ''}`}
            onClick={() => { setDepthType(t); void reloadCurvesForDepthBasis(t) }}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}
