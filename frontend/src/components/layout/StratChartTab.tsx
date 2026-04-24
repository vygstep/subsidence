import type { StratChartInfo } from '@/types'

interface StratChartTabProps {
  charts: StratChartInfo[]
  onActivate: (chartId: number) => void
  onDeleteById: (chartId: number, name: string, isBuiltin: boolean) => void
  onContextMenu: (event: React.MouseEvent, chart: StratChartInfo) => void
  selectedChartId: number | null
  onSelect: (chartId: number) => void
}

export function StratChartTab({ charts, onActivate, onDeleteById, onContextMenu, selectedChartId, onSelect }: StratChartTabProps) {
  if (charts.length === 0) {
    return (
      <div className="sidebar-panel__body">
        <p className="sidebar-panel__empty">No stratigraphic charts loaded. Use StratChart &gt; Load StratChart.</p>
      </div>
    )
  }

  return (
    <div className="sidebar-panel__body">
      <div className="tree-list">
        {charts.map((chart) => (
          <div
            key={chart.id}
            className={`tree-node__row ${chart.is_active ? 'tree-node__row--active' : ''} ${selectedChartId === chart.id ? 'tree-node__row--selected' : ''}`}
            onContextMenu={(event) => {
              onSelect(chart.id)
              onContextMenu(event, chart)
            }}
          >
            <input
              type="radio"
              name="active-strat-chart"
              checked={chart.is_active}
              onChange={() => onActivate(chart.id)}
              onClick={(event) => event.stopPropagation()}
            />
            <button
              type="button"
              className="tree-node__label-button"
              onClick={() => onSelect(chart.id)}
            >
              {chart.name}
            </button>
            <span className="tree-node__item-meta">{chart.unit_count} units</span>
            <button
              type="button"
              className="tree-node__item-button"
              title={chart.is_builtin ? 'Built-in ICS chart cannot be deleted' : 'Delete this chart'}
              disabled={chart.is_builtin}
              style={{ marginLeft: 'auto', opacity: chart.is_builtin ? 0.3 : 0.6, color: 'var(--dm-danger-light)' }}
              onClick={(event) => {
                event.stopPropagation()
                if (window.confirm(`Delete strat chart "${chart.name}"?`)) {
                  onDeleteById(chart.id, chart.name, chart.is_builtin)
                }
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
