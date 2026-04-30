import { useEffect, useRef } from 'react'

import { useWellDataStore, useWorkspaceStore } from '@/stores'
import type { StratChartInfo } from '@/types'
import { useDataManager } from './dataManager/DataManagerContext'

interface StratChartTabProps {
  charts: StratChartInfo[]
  onActivate: (chartId: number) => void
  onDeleteById: (chartId: number, name: string, isBuiltin: boolean) => void
  onContextMenu: (event: React.MouseEvent, chart: StratChartInfo) => void
  selectedChartId: number | null
  onSelect: (chartId: number) => void
}

interface TreeToggleButtonProps {
  isOpen: boolean
  onToggle: () => void
}

function TreeToggleButton({ isOpen, onToggle }: TreeToggleButtonProps) {
  return (
    <button
      type="button"
      className={`tree-toggle ${isOpen ? 'tree-toggle--open' : ''}`}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onToggle()
      }}
      aria-label={isOpen ? 'Collapse' : 'Expand'}
    >
      &gt;
    </button>
  )
}

export function StratChartTab({
  charts,
  onActivate,
  onDeleteById,
  onContextMenu,
  selectedChartId,
  onSelect,
}: StratChartTabProps) {
  const { isExpanded, toggleExpanded, setExpanded } = useDataManager()
  const seaLevelCurves = useWellDataStore((s) => s.seaLevelCurves)
  const deleteSeaLevelCurve = useWellDataStore((s) => s.deleteSeaLevelCurve)
  const wellInventories = useWellDataStore((s) => s.wellInventories)
  const setSelectedObject = useWorkspaceStore((s) => s.setSelectedObject)
  const selectedObject = useWorkspaceStore((s) => s.selectedObject)

  const isStratChartsRootSelected = selectedObject?.type === 'strat-charts-root'
  const selectedCurveId = selectedObject?.type === 'sea-level-curve' ? selectedObject.curveId : null
  const isSeaLevelRootSelected = selectedObject?.type === 'sea-level-curves-root'
  const didInitializeExpanded = useRef(false)

  useEffect(() => {
    if (didInitializeExpanded.current) return
    didInitializeExpanded.current = true
    setExpanded('strat-charts-root', true)
    setExpanded('sea-level-curves-root', true)
  }, [setExpanded])

  const isCurveInUse = (curveId: number) =>
    wellInventories.some((w) => w.active_sea_level_curve_id === curveId)

  function handleDeleteCurve(curveId: number, name: string) {
    if (!window.confirm(`Delete sea level curve "${name}"?`)) return
    void deleteSeaLevelCurve(curveId).catch((error: unknown) => window.alert(String(error)))
  }

  return (
    <div className="sidebar-panel__body">
      <div className="tree-list">
        <div className="tree-node tree-node--root">
          <div
            className={`tree-node__row tree-node__row--root ${isStratChartsRootSelected ? 'tree-node__row--selected' : ''}`}
            onClick={() => setSelectedObject({ type: 'strat-charts-root' })}
          >
            <TreeToggleButton
              isOpen={isExpanded('strat-charts-root')}
              onToggle={() => toggleExpanded('strat-charts-root')}
            />
            <button type="button" className="tree-node__label-button">
              STRAT CHARTS
            </button>
          </div>
          {isExpanded('strat-charts-root') ? (
            <div className="tree-node__children">
              {charts.length === 0 ? (
                <p className="sidebar-panel__empty">No stratigraphic charts loaded. Use StratChart &gt; Load StratChart.</p>
              ) : charts.map((chart) => (
                <div
                  key={chart.id}
                  className={`tree-node__row ${chart.is_active ? 'tree-node__row--active' : ''} ${selectedChartId === chart.id ? 'tree-node__row--selected' : ''}`}
                  onClick={() => onSelect(chart.id)}
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
                    onClick={(event) => {
                      event.stopPropagation()
                      onSelect(chart.id)
                    }}
                  >
                    {chart.name}
                  </button>
                  {chart.is_builtin && (
                    <span className="tree-node__badge">built-in</span>
                  )}
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
          ) : null}
        </div>

        <div className="tree-node tree-node--root">
          <div
            className={`tree-node__row tree-node__row--root ${isSeaLevelRootSelected ? 'tree-node__row--selected' : ''}`}
            onClick={() => setSelectedObject({ type: 'sea-level-curves-root' })}
          >
            <TreeToggleButton
              isOpen={isExpanded('sea-level-curves-root')}
              onToggle={() => toggleExpanded('sea-level-curves-root')}
            />
            <button type="button" className="tree-node__label-button">
              SEA LEVEL CURVES
            </button>
          </div>
          {isExpanded('sea-level-curves-root') ? (
            <div className="tree-node__children">
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
          ) : null}
        </div>
      </div>
    </div>
  )
}
