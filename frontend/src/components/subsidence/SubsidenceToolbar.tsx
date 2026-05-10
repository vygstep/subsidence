import { useComputedStore } from '@/stores'
import { useWellDataStore } from '@/stores/wellDataStore'
import { useViewStore } from '@/stores/viewStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { exportPng } from '@/utils/exportPng'

export function SubsidenceToolbar() {
  const showFormationFills = useComputedStore((s) => s.showFormationFills)
  const showBurialCurves = useComputedStore((s) => s.showBurialCurves)
  const setShowFormationFills = useComputedStore((s) => s.setShowFormationFills)
  const setShowBurialCurves = useComputedStore((s) => s.setShowBurialCurves)
  const wellName = useWellDataStore((s) => s.well?.well_name ?? 'subsidence')
  const selectedObject = useWorkspaceStore((s) => s.selectedObject)
  const setSingleDepthMin = useViewStore((s) => s.setSubsidenceSingleDepthMin)
  const setSingleDepthMax = useViewStore((s) => s.setSubsidenceSingleDepthMax)
  const setSingleAgeMin = useViewStore((s) => s.setSubsidenceSingleAgeMin)
  const setSingleAgeMax = useViewStore((s) => s.setSubsidenceSingleAgeMax)
  const setMultiDepthMin = useViewStore((s) => s.setSubsidenceMultiDepthMin)
  const setMultiDepthMax = useViewStore((s) => s.setSubsidenceMultiDepthMax)
  const setMultiAgeMin = useViewStore((s) => s.setSubsidenceMultiAgeMin)
  const setMultiAgeMax = useViewStore((s) => s.setSubsidenceMultiAgeMax)

  function fitData(): void {
    const target = selectedObject?.type === 'subsidence-chart' ? selectedObject.chartType : 'single'
    if (target === 'multi') {
      setMultiDepthMin(null)
      setMultiDepthMax(null)
      setMultiAgeMin(null)
      setMultiAgeMax(null)
      return
    }
    setSingleDepthMin(null)
    setSingleDepthMax(null)
    setSingleAgeMin(null)
    setSingleAgeMax(null)
  }

  return (
    <div className="subsidence-toolbar" aria-label="Subsidence tools">
      <button
        type="button"
        className="subsidence-toolbar__button"
        onClick={fitData}
        title="Fit selected chart data"
      >
        <span className="subsidence-toolbar__label">Fit data</span>
      </button>
      <button
        type="button"
        className={`subsidence-toolbar__button ${showBurialCurves ? 'subsidence-toolbar__button--active' : ''}`}
        onClick={() => setShowBurialCurves(!showBurialCurves)}
        title="Toggle burial curves"
      >
        <span className="subsidence-toolbar__label">Burial</span>
      </button>
      <button
        type="button"
        className={`subsidence-toolbar__button ${showFormationFills ? 'subsidence-toolbar__button--active' : ''}`}
        onClick={() => setShowFormationFills(!showFormationFills)}
        title="Toggle formation fills"
      >
        <span className="subsidence-toolbar__label">Fills</span>
      </button>
      <button
        type="button"
        className="subsidence-toolbar__button"
        onClick={() => exportPng(`${wellName}_subsidence.png`)}
        title="Export chart as PNG"
      >
        <span className="subsidence-toolbar__label">PNG</span>
      </button>
    </div>
  )
}
