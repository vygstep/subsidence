import { useComputedStore } from '@/stores'

export function SubsidenceControls() {
  const showFormationFills = useComputedStore((s) => s.showFormationFills)
  const showBurialCurves = useComputedStore((s) => s.showBurialCurves)
  const waterDepthM = useComputedStore((s) => s.waterDepthM)
  const setShowFormationFills = useComputedStore((s) => s.setShowFormationFills)
  const setShowBurialCurves = useComputedStore((s) => s.setShowBurialCurves)
  const setWaterDepthM = useComputedStore((s) => s.setWaterDepthM)

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
      <label className="subsidence-controls__water">
        Water depth (m)
        <input
          type="number"
          step="10"
          min="0"
          value={waterDepthM}
          onChange={(e) => setWaterDepthM(Math.max(0, Number(e.target.value)))}
        />
      </label>
    </div>
  )
}
