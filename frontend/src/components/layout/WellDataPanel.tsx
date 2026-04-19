import { useEffect, useRef, useState } from 'react'

import type { FormationInventoryItem, WellInventory } from '@/types'

interface WellDataPanelProps {
  wells: WellInventory[]
  activeWellId: string | null
  visibleCurveMnemonicsByWellId: Record<string, string[]>
  visibleFormationIdsByWellId: Record<string, string[]>
  deviationVisibilityByWellId: Record<string, boolean>
  selectedFormationId: string | null
  onSelectWell: (wellId: string) => void
  onToggleCurve: (wellId: string, mnemonic: string, nextValue: boolean) => void
  onToggleFormation: (wellId: string, formationId: string, nextValue: boolean) => void
  onToggleAllFormations: (wellId: string, nextValue: boolean) => void
  onToggleAllCurves: (wellId: string, nextValue: boolean) => void
  onToggleDeviation: (wellId: string, nextValue: boolean) => void
  onSelectFormation: (wellId: string, formationId: string) => void
  selectedObject: { type: string; [key: string]: unknown } | null
  onSelectLasGroup: (wellId: string) => void
  onSelectCurve: (wellId: string, mnemonic: string) => void
  onSelectTopsGroup: (wellId: string) => void
}

type ToggleState = 'none' | 'partial' | 'all'

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—'
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function topBackgroundColor(formation: FormationInventoryItem): string {
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
  visibleCurveMnemonicsByWellId,
  visibleFormationIdsByWellId,
  deviationVisibilityByWellId,
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
        <p className="sidebar-panel__empty">No wells loaded.</p>
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
          const visibleCurveMnemonics = visibleCurveMnemonicsByWellId[item.well_id] ?? []
          const visibleFormationIds = visibleFormationIdsByWellId[item.well_id] ?? []
          const isDeviationVisible = deviationVisibilityByWellId[item.well_id] ?? false

          const curvesCheckboxState: ToggleState =
            item.curves.length === 0 || visibleCurveMnemonics.length === 0
              ? 'none'
              : visibleCurveMnemonics.length >= item.curves.length
                ? 'all'
                : 'partial'

          const topsCheckboxState: ToggleState =
            item.formations.length === 0 || visibleFormationIds.length === 0
              ? 'none'
              : visibleFormationIds.length >= item.formations.length
                ? 'all'
                : 'partial'

          return (
            <div key={item.well_id} className="tree-node tree-node--root">
              <div
                className={`tree-node__row tree-node__row--root ${isActive ? 'tree-node__row--active' : ''} ${
                  selectedObject?.type === 'well' && selectedObject.wellId === item.well_id ? 'tree-node__row--selected' : ''
                }`}
              >
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
                  <div className="tree-node">
                    <div
                      className={`tree-node__row ${
                        selectedObject?.type === 'well' && selectedObject.wellId === item.well_id ? 'tree-node__row--selected' : ''
                      }`}
                    >
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
                        <div className="tree-leaf"><span>Name</span><span>{item.well_name}</span></div>
                        <div className="tree-leaf"><span>Location (X, Y)</span><span>{formatNumber(item.x)}, {formatNumber(item.y)}</span></div>
                        <div className="tree-leaf"><span>KB / GL</span><span>{formatNumber(item.kb_elev)} / {formatNumber(item.gl_elev)}</span></div>
                        <div className="tree-leaf"><span>TD</span><span>{formatNumber(item.td_md)}</span></div>
                        <div className="tree-leaf"><span>CRS</span><span>{item.crs || 'unset'}</span></div>
                      </div>
                    ) : null}
                  </div>

                  <div className="tree-node">
                    <div
                      className={`tree-node__row ${
                        selectedObject?.type === 'las-group' && selectedObject.wellId === item.well_id ? 'tree-node__row--selected' : ''
                      }`}
                    >
                      <TreeToggleButton
                        isOpen={isOpen(`${rootId}:las`)}
                        onToggle={() => toggleNode(`${rootId}:las`)}
                      />
                      <TriStateCheckbox state={curvesCheckboxState} onToggle={(nextValue) => onToggleAllCurves(item.well_id, nextValue)} />
                      <button type="button" className="tree-node__section-label" onClick={() => onSelectLasGroup(item.well_id)}>
                        LAS
                      </button>
                    </div>
                    {isOpen(`${rootId}:las`) ? (
                      <div className="tree-node__children">
                        {item.curves.length > 0 ? (
                          item.curves.map((curve) => (
                            <div
                              key={`${item.well_id}:${curve.mnemonic}`}
                              className={
                                selectedObject?.type === 'curve' &&
                                selectedObject.wellId === item.well_id &&
                                selectedObject.mnemonic === curve.mnemonic
                                  ? 'tree-node__item-selected'
                                  : ''
                              }
                              onClick={() => onSelectCurve(item.well_id, curve.mnemonic)}
                            >
                              <CheckboxLeaf
                                checked={visibleCurveMnemonics.includes(curve.mnemonic)}
                                label={curve.mnemonic}
                                secondary={curve.unit || '—'}
                                onChange={(nextValue) => onToggleCurve(item.well_id, curve.mnemonic, nextValue)}
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
                    <div
                      className={`tree-node__row ${
                        selectedObject?.type === 'tops-group' && selectedObject.wellId === item.well_id ? 'tree-node__row--selected' : ''
                      }`}
                    >
                      <TreeToggleButton
                        isOpen={isOpen(`${rootId}:tops`)}
                        onToggle={() => toggleNode(`${rootId}:tops`)}
                      />
                      <TriStateCheckbox state={topsCheckboxState} onToggle={(nextValue) => onToggleAllFormations(item.well_id, nextValue)} />
                      <button type="button" className="tree-node__section-label" onClick={() => onSelectTopsGroup(item.well_id)}>
                        TOPS
                      </button>
                    </div>
                    {isOpen(`${rootId}:tops`) ? (
                      <div className="tree-node__children">
                        {item.formations.length > 0 ? (
                          item.formations.map((formation) => (
                            <div
                              key={formation.id}
                              className={`top-leaf ${selectedFormationId === formation.id && isActive ? 'top-leaf--selected' : ''}`}
                              style={{ backgroundColor: topBackgroundColor(formation) }}
                              onClick={() => onSelectFormation(item.well_id, formation.id)}
                            >
                              <CheckboxLeaf
                                checked={visibleFormationIds.includes(formation.id)}
                                label={formation.name}
                                secondary={formatNumber(formation.depth_md)}
                                onChange={(nextValue) => onToggleFormation(item.well_id, formation.id, nextValue)}
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
                        onChange={(event) => onToggleDeviation(item.well_id, event.target.checked)}
                      />
                      <button type="button" className="tree-node__section-label">
                        DEV
                      </button>
                    </div>
                    {isOpen(`${rootId}:dev`) ? (
                      <div className="tree-node__children">
                        {item.deviation ? (
                          <>
                            <div className="tree-leaf"><span>Reference</span><span>{item.deviation.reference}</span></div>
                            <div className="tree-leaf"><span>Mode</span><span>{item.deviation.mode}</span></div>
                            {item.deviation.fields.map((field) => (
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
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
