import { useEffect, useMemo, useRef, useState } from 'react'

import type { CurveData, FormationTop, Well } from '@/types'

interface WellDataPanelProps {
  wells: Array<{ well_id: string; well_name: string }>
  activeWellId: string | null
  well: Well | null
  curves: CurveData[]
  formations: FormationTop[]
  visibleCurveMnemonics: string[]
  visibleFormationIds: string[]
  isDeviationVisible: boolean
  selectedFormationId: string | null
  onSelectWell: (wellId: string) => void
  onToggleCurve: (mnemonic: string, nextValue: boolean) => void
  onToggleFormation: (formationId: string, nextValue: boolean) => void
  onToggleAllFormations: (nextValue: boolean) => void
  onToggleAllCurves: (nextValue: boolean) => void
  onToggleDeviation: (nextValue: boolean) => void
  onSelectFormation: (formationId: string) => void
  selectedObject: { type: string; [key: string]: unknown } | null
  onSelectLasGroup: () => void
  onSelectCurve: (mnemonic: string) => void
  onSelectTopsGroup: () => void
}

type ToggleState = 'none' | 'partial' | 'all'

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—'
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function topBackgroundColor(formation: FormationTop): string {
  return formation.active_strat_color ?? '#9ca3af'
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
      ▸
    </button>
  )
}

interface TriStateCheckboxProps {
  state: ToggleState
  onToggle: (nextValue: boolean) => void
}

function TriStateCheckbox({ state, onToggle }: TriStateCheckboxProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = state === 'partial'
    }
  }, [state])

  return (
    <input
      ref={inputRef}
      type="checkbox"
      className={`tree-tristate-checkbox tree-tristate-checkbox--${state}`}
      checked={state === 'all'}
      readOnly
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onToggle(state === 'none')
      }}
    />
  )
}

function CheckboxLeaf({
  checked,
  label,
  secondary,
  onChange,
}: {
  checked: boolean
  label: string
  secondary: string
  onChange: (nextValue: boolean) => void
}) {
  return (
    <label className="tree-checkbox-leaf">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => {
          event.stopPropagation()
          onChange(event.target.checked)
        }}
      />
      <span className="tree-checkbox-leaf__label">{label}</span>
      <span className="tree-checkbox-leaf__meta">{secondary}</span>
    </label>
  )
}

export function WellDataPanel({
  wells,
  activeWellId,
  well,
  curves,
  formations,
  visibleCurveMnemonics,
  visibleFormationIds,
  isDeviationVisible,
  selectedFormationId,
  onSelectWell,
  onToggleCurve,
  onToggleFormation,
  onToggleAllFormations,
  onToggleAllCurves,
  onToggleDeviation,
  onSelectFormation,
  selectedObject,
  onSelectLasGroup,
  onSelectCurve,
  onSelectTopsGroup,
}: WellDataPanelProps) {
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setExpandedNodes({})
  }, [wells.map((item) => item.well_id).join('|')])

  const topsCheckboxState = useMemo<ToggleState>(() => {
    if (formations.length === 0 || visibleFormationIds.length === 0) {
      return 'none'
    }
    if (visibleFormationIds.length >= formations.length) {
      return 'all'
    }
    return 'partial'
  }, [formations.length, visibleFormationIds.length])

  const curvesCheckboxState = useMemo<ToggleState>(() => {
    if (curves.length === 0 || visibleCurveMnemonics.length === 0) {
      return 'none'
    }
    if (visibleCurveMnemonics.length >= curves.length) {
      return 'all'
    }
    return 'partial'
  }, [curves.length, visibleCurveMnemonics.length])

  function isOpen(nodeId: string): boolean {
    return expandedNodes[nodeId] ?? false
  }

  function toggleNode(nodeId: string): void {
    setExpandedNodes((current) => ({
      ...current,
      [nodeId]: !(current[nodeId] ?? false),
    }))
  }

  if (wells.length === 0) {
    return (
      <div className="sidebar-panel__body">
        <p className="sidebar-panel__empty">No well loaded.</p>
      </div>
    )
  }

  return (
    <div className="sidebar-panel__body">
      <div className="tree-list">
        {wells.map((item) => {
          const isActive = item.well_id === activeWellId
          const rootId = `well:${item.well_id}`
          const showDetails = isOpen(rootId)
          const activeWellLoaded = isActive && well
          const hasLas = activeWellLoaded && curves.length > 0
          const hasTops = activeWellLoaded && formations.length > 0
          const hasDeviation = Boolean(activeWellLoaded && well.deviation)

          return (
            <div key={item.well_id} className="tree-node tree-node--root">
              <div className={`tree-node__row tree-node__row--root ${isActive ? 'tree-node__row--active' : ''} ${selectedObject?.type === 'well' && selectedObject.wellId === item.well_id ? 'tree-node__row--selected' : ''}`}>
                <TreeToggleButton isOpen={showDetails} onToggle={() => toggleNode(rootId)} />
                <input
                  type="radio"
                  name="active-well"
                  checked={isActive}
                  onChange={() => onSelectWell(item.well_id)}
                />
                <button
                  type="button"
                  className="tree-node__label-button"
                  onClick={() => onSelectWell(item.well_id)}
                >
                  {item.well_name}
                </button>
              </div>

              {showDetails ? (
                <div className="tree-node__children">
                  {!activeWellLoaded ? (
                    <p className="sidebar-panel__empty">Select this well to inspect loaded data.</p>
                  ) : (
                    <>
                      <div className="tree-node">
                        <div className={`tree-node__row ${selectedObject?.type === 'well' && selectedObject.wellId === item.well_id ? 'tree-node__row--selected' : ''}`}>
                          <TreeToggleButton
                            isOpen={isOpen(`${rootId}:metadata`)}
                            onToggle={() => toggleNode(`${rootId}:metadata`)}
                          />
                          <button type="button" className="tree-node__section-label" onClick={() => onSelectWell(item.well_id)}>
                            Well metadata
                          </button>
                        </div>
                        {isOpen(`${rootId}:metadata`) ? (
                          <div className="tree-node__children">
                            <div className="tree-leaf"><span>Name</span><span>{well.well_name}</span></div>
                            <div className="tree-leaf"><span>Location (X, Y)</span><span>{formatNumber(well.x)}, {formatNumber(well.y)}</span></div>
                            <div className="tree-leaf"><span>KB / GL</span><span>{formatNumber(well.kb_elev)} / {formatNumber(well.gl_elev)}</span></div>
                            <div className="tree-leaf"><span>TD</span><span>{formatNumber(well.td_md)}</span></div>
                            <div className="tree-leaf"><span>CRS</span><span>{well.crs || 'unset'}</span></div>
                          </div>
                        ) : null}
                      </div>

                      <div className="tree-node">
                        <div className={`tree-node__row ${selectedObject?.type === 'las-group' && selectedObject.wellId === item.well_id ? 'tree-node__row--selected' : ''}`}>
                          <TreeToggleButton
                            isOpen={isOpen(`${rootId}:las`)}
                            onToggle={() => toggleNode(`${rootId}:las`)}
                          />
                          <TriStateCheckbox state={curvesCheckboxState} onToggle={onToggleAllCurves} />
                          <button type="button" className="tree-node__section-label" onClick={onSelectLasGroup}>
                            LAS
                          </button>
                        </div>
                        {isOpen(`${rootId}:las`) ? (
                          <div className="tree-node__children">
                            {hasLas ? (
                              curves.map((curve) => (
                                <div
                                  key={curve.mnemonic}
                                  className={selectedObject?.type === 'curve' && selectedObject.mnemonic === curve.mnemonic ? 'tree-node__item-selected' : ''}
                                  onClick={() => onSelectCurve(curve.mnemonic)}
                                >
                                  <CheckboxLeaf
                                    checked={visibleCurveMnemonics.includes(curve.mnemonic)}
                                    label={curve.mnemonic}
                                    secondary={curve.unit || '—'}
                                    onChange={(nextValue) => onToggleCurve(curve.mnemonic, nextValue)}
                                  />
                                </div>
                              ))
                            ) : (
                              <p className="sidebar-panel__empty">No LAS loaded.</p>
                            )}
                          </div>
                        ) : null}
                      </div>

                      <div className="tree-node">
                        <div className={`tree-node__row ${selectedObject?.type === 'tops-group' && selectedObject.wellId === item.well_id ? 'tree-node__row--selected' : ''}`}>
                          <TreeToggleButton
                            isOpen={isOpen(`${rootId}:tops`)}
                            onToggle={() => toggleNode(`${rootId}:tops`)}
                          />
                          <TriStateCheckbox state={topsCheckboxState} onToggle={onToggleAllFormations} />
                          <button type="button" className="tree-node__section-label" onClick={onSelectTopsGroup}>
                            TOPS
                          </button>
                        </div>
                        {isOpen(`${rootId}:tops`) ? (
                          <div className="tree-node__children">
                            {hasTops ? (
                              formations.map((formation) => (
                                <div
                                  key={formation.id}
                                  className={`top-leaf ${selectedFormationId === formation.id ? 'top-leaf--selected' : ''}`}
                                  style={{ backgroundColor: topBackgroundColor(formation) }}
                                  onClick={() => onSelectFormation(formation.id)}
                                >
                                  <CheckboxLeaf
                                    checked={visibleFormationIds.includes(formation.id)}
                                    label={formation.name}
                                    secondary={formatNumber(formation.depth_md)}
                                    onChange={(nextValue) => onToggleFormation(formation.id, nextValue)}
                                  />
                                </div>
                              ))
                            ) : (
                              <p className="sidebar-panel__empty">No tops loaded.</p>
                            )}
                          </div>
                        ) : null}
                      </div>

                      <div className="tree-node">
                        <div className="tree-node__row">
                          <TreeToggleButton
                            isOpen={isOpen(`${rootId}:dev`)}
                            onToggle={() => toggleNode(`${rootId}:dev`)}
                          />
                          <input
                            type="checkbox"
                            checked={isDeviationVisible}
                            onChange={(event) => onToggleDeviation(event.target.checked)}
                          />
                          <button type="button" className="tree-node__section-label">
                            DEV
                          </button>
                        </div>
                        {isOpen(`${rootId}:dev`) ? (
                          <div className="tree-node__children">
                            {hasDeviation ? (
                              <>
                                <div className="tree-leaf"><span>Reference</span><span>{well.deviation?.reference}</span></div>
                                <div className="tree-leaf"><span>Mode</span><span>{well.deviation?.mode}</span></div>
                                {(well.deviation?.fields ?? []).map((field) => (
                                  <div key={field} className="tree-leaf">
                                    <span>{field}</span>
                                    <span>Loaded</span>
                                  </div>
                                ))}
                              </>
                            ) : (
                              <p className="sidebar-panel__empty">No deviation loaded.</p>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
