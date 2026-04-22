import { useComputedStore } from '@/stores'
import { useWellDataStore } from '@/stores/wellDataStore'
import { exportPng } from '@/utils/exportPng'

export function SubsidenceToolbar() {
  const showFormationFills = useComputedStore((s) => s.showFormationFills)
  const showBurialCurves = useComputedStore((s) => s.showBurialCurves)
  const waterDepthM = useComputedStore((s) => s.waterDepthM)
  const setShowFormationFills = useComputedStore((s) => s.setShowFormationFills)
  const setShowBurialCurves = useComputedStore((s) => s.setShowBurialCurves)
  const setWaterDepthM = useComputedStore((s) => s.setWaterDepthM)
  const wellName = useWellDataStore((s) => s.well?.well_name ?? 'subsidence')

  return (
    <div className="subsidence-toolbar" aria-label="Subsidence tools">
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
      <div className="subsidence-toolbar__spacer" />
      <div className="subsidence-toolbar__depth">
        <span className="subsidence-toolbar__depth-label">Wd</span>
        <input
          type="number"
          className="subsidence-toolbar__depth-input"
          step="10"
          min="0"
          value={waterDepthM}
          title="Water depth (m)"
          onChange={(e) => setWaterDepthM(Math.max(0, Number(e.target.value)))}
        />
      </div>
    </div>
  )
}
