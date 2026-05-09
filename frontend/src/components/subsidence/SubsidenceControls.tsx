import { useComputedStore } from '@/stores'
import { useWellDataStore } from '@/stores/wellDataStore'
import { exportPng } from '@/utils/exportPng'

export function SubsidenceControls() {
  const showFormationFills = useComputedStore((s) => s.showFormationFills)
  const showBurialCurves = useComputedStore((s) => s.showBurialCurves)
  const setShowFormationFills = useComputedStore((s) => s.setShowFormationFills)
  const setShowBurialCurves = useComputedStore((s) => s.setShowBurialCurves)
  const wellName = useWellDataStore((s) => s.well?.well_name ?? 'subsidence')

  return (
    <div className="subsidence-controls">
      <label className="subsidence-controls__check">
        <input
          type="checkbox"
          checked={showBurialCurves}
          onChange={(e) => setShowBurialCurves(e.target.checked)}
        />
        Burial curves
      </label>
      <label className="subsidence-controls__check">
        <input
          type="checkbox"
          checked={showFormationFills}
          onChange={(e) => setShowFormationFills(e.target.checked)}
        />
        Formation fills
      </label>
      <div className="subsidence-controls__spacer" />
      <button
        className="subsidence-controls__btn"
        onClick={() => exportPng(`${wellName}_subsidence.png`)}
        title="Export chart as PNG"
      >
        Export PNG
      </button>
    </div>
  )
}
