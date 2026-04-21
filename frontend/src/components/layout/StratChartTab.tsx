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
      <div className="strat-chart-list">
        {charts.map((chart) => (
          <div
            key={chart.id}
            className={`strat-chart-item ${chart.is_active ? 'strat-chart-item--active' : ''} ${selectedChartId === chart.id ? 'strat-chart-item--selected' : ''}`}
            onClick={() => onSelect(chart.id)}
            onContextMenu={(event) => {
              onSelect(chart.id)
              onContextMenu(event, chart)
            }}
          >
            <label className="strat-chart-item__radio-label">
              <input
                type="radio"
                name="active-strat-chart"
                checked={chart.is_active}
                onChange={() => onActivate(chart.id)}
                onClick={(event) => event.stopPropagation()}
              />
              <span className="strat-chart-item__name">{chart.name}</span>
            </label>
            <span className="strat-chart-item__meta">{chart.unit_count} units</span>
            <button
              type="button"
              className="strat-chart-item__delete"
              title={chart.is_builtin ? 'Built-in ICS chart cannot be deleted' : 'Delete this chart'}
              disabled={chart.is_builtin}
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
