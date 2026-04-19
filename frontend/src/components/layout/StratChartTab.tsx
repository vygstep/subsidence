import type { StratChartInfo } from '@/types'

interface StratChartTabProps {
  charts: StratChartInfo[]
  onActivate: (chartId: number) => void
  onDelete: (chartId: number) => void
}

export function StratChartTab({ charts, onActivate, onDelete }: StratChartTabProps) {
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
          <div key={chart.id} className={`strat-chart-item ${chart.is_active ? 'strat-chart-item--active' : ''}`}>
            <label className="strat-chart-item__radio-label">
              <input
                type="radio"
                name="active-strat-chart"
                checked={chart.is_active}
                onChange={() => onActivate(chart.id)}
              />
              <span className="strat-chart-item__name">{chart.name}</span>
            </label>
            <span className="strat-chart-item__meta">{chart.unit_count} units</span>
            <button
              type="button"
              className="strat-chart-item__delete"
              title="Delete this chart"
              onClick={() => {
                if (window.confirm(`Delete strat chart "${chart.name}"?`)) {
                  onDelete(chart.id)
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
