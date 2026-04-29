import { useWellDataStore, useWorkspaceStore } from '@/stores'
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
  const seaLevelCurves = useWellDataStore((s) => s.seaLevelCurves)
  const deleteSeaLevelCurve = useWellDataStore((s) => s.deleteSeaLevelCurve)
  const wellInventories = useWellDataStore((s) => s.wellInventories)
  const setSelectedObject = useWorkspaceStore((s) => s.setSelectedObject)
  const selectedObject = useWorkspaceStore((s) => s.selectedObject)

  const selectedCurveId = selectedObject?.type === 'sea-level-curve' ? selectedObject.curveId : null
  const isSeaLevelRootSelected = selectedObject?.type === 'sea-level-curves-root'

  const isCurveInUse = (curveId: number) =>
    wellInventories.some((w) => w.active_sea_level_curve_id === curveId)

  function handleDeleteCurve(curveId: number, name: string) {
    if (!window.confirm(`Delete sea level curve "${name}"?`)) return
    void deleteSeaLevelCurve(curveId).catch((error: unknown) => window.alert(String(error)))
  }

  return (
    <div className="sidebar-panel__body">
      {charts.length === 0 ? (
        <p className="sidebar-panel__empty">No stratigraphic charts loaded. Use StratChart &gt; Load StratChart.</p>
      ) : (
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
                className="dm-action dm-action--ghost dm-action--danger"
                title={chart.is_builtin ? 'Built-in ICS chart cannot be deleted' : 'Delete this chart'}
                disabled={chart.is_builtin}
                style={{ marginLeft: 'auto' }}
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
      )}

      <div
        className={`tree-node__row tree-node__row--root ${isSeaLevelRootSelected ? 'tree-node__row--selected' : ''}`}
        style={{ marginTop: 8, cursor: 'pointer' }}
        onClick={() => setSelectedObject({ type: 'sea-level-curves-root' })}
      >
        <span className="tree-node__label">Sea level curves</span>
        <span className="tree-node__item-meta">{seaLevelCurves.length}</span>
      </div>
      {seaLevelCurves.map((curve) => (
        <div
          key={curve.id}
          className={`tree-node__row ${selectedCurveId === curve.id ? 'tree-node__row--selected' : ''}`}
          onClick={() => setSelectedObject({ type: 'sea-level-curve', curveId: curve.id })}
        >
          <button
            type="button"
            className="tree-node__label-button"
            onClick={(event) => {
              event.stopPropagation()
              setSelectedObject({ type: 'sea-level-curve', curveId: curve.id })
            }}
          >
            {curve.name}
          </button>
          <span className="tree-node__item-meta">{curve.point_count} pts</span>
          {curve.is_builtin && (
            <span className="tree-node__badge">built-in</span>
          )}
          <button
            type="button"
            className="dm-action dm-action--ghost dm-action--danger"
            title={
              curve.is_builtin
                ? 'Built-in curve cannot be deleted'
                : isCurveInUse(curve.id)
                  ? 'Curve is assigned to one or more wells'
                  : 'Delete this curve'
            }
            disabled={curve.is_builtin || isCurveInUse(curve.id)}
            style={{ marginLeft: 'auto' }}
            onClick={(event) => {
              event.stopPropagation()
              handleDeleteCurve(curve.id, curve.name)
            }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
