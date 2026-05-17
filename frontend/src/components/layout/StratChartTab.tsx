import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { defaultSeaLevelOverlayStyle, useViewStore, useWellDataStore, useWorkspaceStore } from '@/stores'
import type { StratChartInfo, StratUnitOption } from '@/types'
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

interface OverlayAllCheckboxProps {
  curveIds: number[]
  selectedCurveIds: number[]
  onChange: (checked: boolean) => void
}

function OverlayAllCheckbox({ curveIds, selectedCurveIds, onChange }: OverlayAllCheckboxProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const selectedCount = curveIds.filter((id) => selectedCurveIds.includes(id)).length
  const allChecked = curveIds.length > 0 && selectedCount === curveIds.length
  const partiallyChecked = selectedCount > 0 && selectedCount < curveIds.length

  useLayoutEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = partiallyChecked
    }
  }, [partiallyChecked])

  return (
    <input
      ref={inputRef}
      type="checkbox"
      checked={allChecked}
      disabled={curveIds.length === 0}
      aria-label="Toggle all sea level curve overlays"
      onChange={(event) => onChange(event.target.checked)}
      onClick={(event) => event.stopPropagation()}
    />
  )
}

interface StratUnitTreeNode {
  unit: StratUnitOption
  children: StratUnitTreeNode[]
}

async function fetchChartUnits(chartId: number): Promise<StratUnitOption[]> {
  const params = new URLSearchParams({ chart_id: String(chartId), limit: '1000' })
  const response = await fetch(`/api/strat-units?${params.toString()}`)
  if (!response.ok) {
    throw new Error(`Failed to load strat units (${response.status})`)
  }
  return (await response.json()) as StratUnitOption[]
}

function unitSortKey(unit: StratUnitOption): number {
  return unit.age_top_ma ?? unit.age_base_ma ?? Number.POSITIVE_INFINITY
}

function buildUnitTree(units: StratUnitOption[]): StratUnitTreeNode[] {
  const nodes = new Map<number, StratUnitTreeNode>()
  for (const unit of units) {
    nodes.set(unit.id, { unit, children: [] })
  }

  const roots: StratUnitTreeNode[] = []
  for (const node of nodes.values()) {
    const parentId = node.unit.parent_id
    const parent = parentId !== null && parentId !== undefined ? nodes.get(parentId) : null
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  const sortNodes = (items: StratUnitTreeNode[]) => {
    items.sort((a, b) => {
      const ageDelta = unitSortKey(a.unit) - unitSortKey(b.unit)
      if (ageDelta !== 0) return ageDelta
      return a.unit.name.localeCompare(b.unit.name)
    })
    for (const item of items) sortNodes(item.children)
  }
  sortNodes(roots)
  return roots
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
  const activeWellId = useWellDataStore((s) => s.well?.well_id ?? null)
  const showSeaLevel = useViewStore((s) => s.subsidenceSingleShowSeaLevel)
  const overlayCurveIds = useViewStore((s) => s.subsidenceSingleSeaLevelOverlayCurveIds)
  const seaLevelOverlayStyles = useViewStore((s) => s.seaLevelOverlayStyles)
  const setOverlayCurveIds = useViewStore((s) => s.setSubsidenceSingleSeaLevelOverlayCurveIds)
  const toggleOverlayCurve = useViewStore((s) => s.toggleSubsidenceSingleSeaLevelOverlayCurve)
  const setSelectedObject = useWorkspaceStore((s) => s.setSelectedObject)
  const selectedObject = useWorkspaceStore((s) => s.selectedObject)

  const isStratChartsRootSelected = selectedObject?.type === 'strat-charts-root'
  const selectedCurveId = selectedObject?.type === 'sea-level-curve' ? selectedObject.curveId : null
  const isSeaLevelRootSelected = selectedObject?.type === 'sea-level-curves-root'
  const didInitializeExpanded = useRef(false)
  const [unitsByChartId, setUnitsByChartId] = useState<Record<number, StratUnitOption[]>>({})
  const [unitLoadErrors, setUnitLoadErrors] = useState<Record<number, string>>({})
  const activeWellCurveId = wellInventories.find((well) => well.well_id === activeWellId)?.active_sea_level_curve_id ?? null
  const effectiveOverlayCurveIds = overlayCurveIds.length > 0
    ? overlayCurveIds
    : showSeaLevel && activeWellCurveId !== null
      ? [activeWellCurveId]
      : []
  const allSeaLevelCurveIds = seaLevelCurves.map((curve) => curve.id)

  useEffect(() => {
    if (didInitializeExpanded.current) return
    didInitializeExpanded.current = true
    setExpanded('strat-charts-root', true)
    setExpanded('sea-level-curves-root', true)
  }, [setExpanded])

  useEffect(() => {
    if (charts.length === 0) {
      setUnitsByChartId({})
      setUnitLoadErrors({})
      return
    }

    let cancelled = false
    void Promise.all(
      charts.map((chart) =>
        fetchChartUnits(chart.id)
          .then((units) => ({ chartId: chart.id, units, error: null }))
          .catch((cause: unknown) => ({
            chartId: chart.id,
            units: [] as StratUnitOption[],
            error: cause instanceof Error ? cause.message : 'Failed to load strat units',
          })),
      ),
    ).then((results) => {
      if (cancelled) return
      setUnitsByChartId(Object.fromEntries(results.map((result) => [result.chartId, result.units])))
      setUnitLoadErrors(Object.fromEntries(results.flatMap((result) => result.error ? [[result.chartId, result.error]] : [])))
      const activeChart = charts.find((chart) => chart.is_active)
      if (activeChart) setExpanded(`strat-chart-${activeChart.id}`, true)
    })

    return () => { cancelled = true }
  }, [charts, setExpanded])

  const unitTreesByChartId = useMemo(
    () => Object.fromEntries(Object.entries(unitsByChartId).map(([chartId, units]) => [Number(chartId), buildUnitTree(units)])),
    [unitsByChartId],
  )

  const isCurveInUse = (curveId: number) =>
    wellInventories.some((w) => w.active_sea_level_curve_id === curveId)

  function handleDeleteCurve(curveId: number, name: string) {
    if (!window.confirm(`Delete sea level curve "${name}"?`)) return
    void deleteSeaLevelCurve(curveId).catch((error: unknown) => window.alert(String(error)))
  }

  function handleOverlayToggle(curveId: number, checked: boolean): void {
    if (overlayCurveIds.length === 0 && effectiveOverlayCurveIds.length > 0) {
      const next = new Set(effectiveOverlayCurveIds)
      if (checked) next.add(curveId)
      else next.delete(curveId)
      setOverlayCurveIds(Array.from(next))
      return
    }
    toggleOverlayCurve(curveId, checked)
  }

  function curveColor(curveId: number): string {
    return (seaLevelOverlayStyles[curveId] ?? defaultSeaLevelOverlayStyle(curveId)).colorHex
  }

  function renderStratUnitNode(node: StratUnitTreeNode) {
    const unitKey = `strat-unit-${node.unit.id}`
    const hasChildren = node.children.length > 0
    return (
      <div key={node.unit.id} className="tree-node">
        <div className="tree-node__row">
          {hasChildren ? (
            <TreeToggleButton
              isOpen={isExpanded(unitKey)}
              onToggle={() => toggleExpanded(unitKey)}
            />
          ) : (
            <span className="tree-toggle tree-toggle--spacer">&gt;</span>
          )}
          <span className="dm-object-color-bar" style={{ ['--dm-object-color' as string]: node.unit.color_hex ?? '#9ca3af' }} />
          <span className="tree-node__label-button strat-unit-tree-label">{node.unit.name}</span>
          {node.unit.rank ? <span className="tree-node__badge">{node.unit.rank}</span> : null}
        </div>
        {hasChildren && isExpanded(unitKey) ? (
          <div className="tree-node__children">
            {node.children.map((child) => renderStratUnitNode(child))}
          </div>
        ) : null}
      </div>
    )
  }

  function renderChartUnits(chart: StratChartInfo) {
    const units = unitTreesByChartId[chart.id] ?? []
    const loadError = unitLoadErrors[chart.id]
    return (
      <div key={`strat-chart-units-${chart.id}`} className="tree-node__children strat-chart-unit-tree">
        {loadError ? (
          <p className="sidebar-panel__empty">{loadError}</p>
        ) : units.length === 0 ? (
          <p className="sidebar-panel__empty">No units loaded.</p>
        ) : (
          units.map((unit) => renderStratUnitNode(unit))
        )}
      </div>
    )
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
                <div key={chart.id} className="tree-node">
                  <div
                    className={`tree-node__row ${chart.is_active ? 'tree-node__row--active' : ''} ${selectedChartId === chart.id ? 'tree-node__row--selected' : ''}`}
                    onClick={() => onSelect(chart.id)}
                    onContextMenu={(event) => {
                      onSelect(chart.id)
                      onContextMenu(event, chart)
                    }}
                  >
                  <TreeToggleButton
                    isOpen={isExpanded(`strat-chart-${chart.id}`)}
                    onToggle={() => toggleExpanded(`strat-chart-${chart.id}`)}
                  />
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
                  {isExpanded(`strat-chart-${chart.id}`) ? renderChartUnits(chart) : null}
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
            <OverlayAllCheckbox
              curveIds={allSeaLevelCurveIds}
              selectedCurveIds={effectiveOverlayCurveIds}
              onChange={(checked) => setOverlayCurveIds(checked ? allSeaLevelCurveIds : [])}
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
                  <input
                    type="checkbox"
                    checked={effectiveOverlayCurveIds.includes(curve.id)}
                    aria-label={`Toggle sea level curve overlay "${curve.name}"`}
                    onChange={(event) => handleOverlayToggle(curve.id, event.target.checked)}
                    onClick={(event) => event.stopPropagation()}
                  />
                  <span className="dm-object-color-bar" style={{ ['--dm-object-color' as string]: curveColor(curve.id) }} />
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
