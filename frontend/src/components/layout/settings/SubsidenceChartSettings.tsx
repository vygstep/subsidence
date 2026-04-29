import { useViewStore } from '@/stores'

interface SubsidenceChartSettingsProps {
  chartType: 'single' | 'multi'
}

export function SubsidenceChartSettings({ chartType }: SubsidenceChartSettingsProps) {
  const subsidenceDepthMinM = useViewStore((s) => s.subsidenceDepthMinM)
  const subsidenceDepthMaxM = useViewStore((s) => s.subsidenceDepthMaxM)
  const setSubsidenceDepthMinM = useViewStore((s) => s.setSubsidenceDepthMinM)
  const setSubsidenceDepthMaxM = useViewStore((s) => s.setSubsidenceDepthMaxM)

  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Object</div>
        <div className="template-panel__value">
          {chartType === 'single' ? 'Total subsidence' : 'Multi-well comparison'}
        </div>
      </div>
      <div className="sf-row">
        <span>Depth min (m)</span>
        <input
          type="number"
          step="100"
          min="0"
          placeholder="auto"
          value={subsidenceDepthMinM ?? ''}
          onChange={(e) => setSubsidenceDepthMinM(e.target.value === '' ? null : Number(e.target.value))}
        />
      </div>
      <div className="sf-row">
        <span>Depth max (m)</span>
        <input
          type="number"
          step="100"
          min="0"
          placeholder="auto"
          value={subsidenceDepthMaxM ?? ''}
          onChange={(e) => setSubsidenceDepthMaxM(e.target.value === '' ? null : Number(e.target.value))}
        />
      </div>
    </div>
  )
}
