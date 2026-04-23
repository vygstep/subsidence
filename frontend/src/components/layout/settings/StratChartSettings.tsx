import type { StratChartInfo } from '@/types'

export function StratChartSettings({ selectedChart }: { selectedChart: StratChartInfo }) {
  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Chart</div>
        <div className="template-panel__value">{selectedChart.name}</div>
      </div>
      <div className="tree-leaf"><span>Units</span><span>{selectedChart.unit_count}</span></div>
      <div className="tree-leaf"><span>Imported at</span><span>{new Date(selectedChart.imported_at).toLocaleString()}</span></div>
      <div className="tree-leaf"><span>Source</span><span>{selectedChart.source_path ?? 'unset'}</span></div>
      <div className="tree-leaf"><span>Kind</span><span>{selectedChart.is_builtin ? 'Built-in ICS' : 'Imported chart'}</span></div>
      <div className="tree-leaf"><span>State</span><span>{selectedChart.is_active ? 'Active' : 'Inactive'}</span></div>
    </div>
  )
}
