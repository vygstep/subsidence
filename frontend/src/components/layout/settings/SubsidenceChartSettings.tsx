import { useViewStore, useWellDataStore } from '@/stores'

interface SubsidenceChartSettingsProps {
  chartType: 'single' | 'multi'
}

export function SubsidenceChartSettings({ chartType }: SubsidenceChartSettingsProps) {
  const single = chartType === 'single'

  const depthMin = useViewStore((s) => single ? s.subsidenceSingleDepthMin : s.subsidenceMultiDepthMin)
  const depthMax = useViewStore((s) => single ? s.subsidenceSingleDepthMax : s.subsidenceMultiDepthMax)
  const setDepthMin = useViewStore((s) => single ? s.setSubsidenceSingleDepthMin : s.setSubsidenceMultiDepthMin)
  const setDepthMax = useViewStore((s) => single ? s.setSubsidenceSingleDepthMax : s.setSubsidenceMultiDepthMax)
  const showSeaLevel = useViewStore((s) => s.subsidenceSingleShowSeaLevel)
  const setShowSeaLevel = useViewStore((s) => s.setSubsidenceSingleShowSeaLevel)
  const seaLevelCurves = useWellDataStore((s) => s.seaLevelCurves)
  const wellInventories = useWellDataStore((s) => s.wellInventories)
  const activeWellId = useWellDataStore((s) => s.well?.well_id ?? null)
  const activeWellCurveId = wellInventories.find((well) => well.well_id === activeWellId)?.active_sea_level_curve_id ?? null
  const resolvedCurve = seaLevelCurves.find((curve) => curve.id === activeWellCurveId)

  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Object</div>
        <div className="template-panel__value">
          {single ? 'Single-well chart' : 'Multi-well comparison chart'}
        </div>
      </div>
      <div className="sf-row">
        <span>Depth min (m)</span>
        <input
          type="number"
          step="100"
          min="0"
          placeholder="auto"
          value={depthMin ?? ''}
          onChange={(e) => setDepthMin(e.target.value === '' ? null : Number(e.target.value))}
        />
      </div>
      <div className="sf-row">
        <span>Depth max (m)</span>
        <input
          type="number"
          step="100"
          min="0"
          placeholder="auto"
          value={depthMax ?? ''}
          onChange={(e) => setDepthMax(e.target.value === '' ? null : Number(e.target.value))}
        />
      </div>
      {single && (
        <>
          <div className="template-panel__section-header">Overlay</div>
          <label className="sf-row">
            <span>Sea level curve</span>
            <input
              type="checkbox"
              checked={showSeaLevel}
              onChange={(e) => setShowSeaLevel(e.target.checked)}
            />
          </label>
          <div className="tree-leaf">
            <span>Curve</span>
            <span>
              {resolvedCurve
                ? `${resolvedCurve.name} (Models)`
                : 'not selected'}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
