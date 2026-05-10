import { useViewStore } from '@/stores'

interface SubsidenceChartSettingsProps {
  chartType: 'single' | 'multi'
}

export function SubsidenceChartSettings({ chartType }: SubsidenceChartSettingsProps) {
  const single = chartType === 'single'

  const depthMin = useViewStore((s) => single ? s.subsidenceSingleDepthMin : s.subsidenceMultiDepthMin)
  const depthMax = useViewStore((s) => single ? s.subsidenceSingleDepthMax : s.subsidenceMultiDepthMax)
  const ageMin = useViewStore((s) => single ? s.subsidenceSingleAgeMin : s.subsidenceMultiAgeMin)
  const ageMax = useViewStore((s) => single ? s.subsidenceSingleAgeMax : s.subsidenceMultiAgeMax)
  const setDepthMin = useViewStore((s) => single ? s.setSubsidenceSingleDepthMin : s.setSubsidenceMultiDepthMin)
  const setDepthMax = useViewStore((s) => single ? s.setSubsidenceSingleDepthMax : s.setSubsidenceMultiDepthMax)
  const setAgeMin = useViewStore((s) => single ? s.setSubsidenceSingleAgeMin : s.setSubsidenceMultiAgeMin)
  const setAgeMax = useViewStore((s) => single ? s.setSubsidenceSingleAgeMax : s.setSubsidenceMultiAgeMax)

  function parseNumber(value: string): number | null {
    return value === '' ? null : Number(value)
  }

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
          onChange={(e) => setDepthMin(parseNumber(e.target.value))}
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
          onChange={(e) => setDepthMax(parseNumber(e.target.value))}
        />
      </div>
      <div className="sf-row">
        <span>Depth range</span>
        <button type="button" onClick={() => { setDepthMin(null); setDepthMax(null) }}>Auto</button>
      </div>
      <div className="sf-row">
        <span>Age min (Ma)</span>
        <input
          type="number"
          step="10"
          min="0"
          placeholder="auto"
          value={ageMin ?? ''}
          onChange={(e) => setAgeMin(parseNumber(e.target.value))}
        />
      </div>
      <div className="sf-row">
        <span>Age max (Ma)</span>
        <input
          type="number"
          step="10"
          min="0"
          placeholder="auto"
          value={ageMax ?? ''}
          onChange={(e) => setAgeMax(parseNumber(e.target.value))}
        />
      </div>
      <div className="sf-row">
        <span>Age range</span>
        <button type="button" onClick={() => { setAgeMin(null); setAgeMax(null) }}>Auto</button>
      </div>
    </div>
  )
}
