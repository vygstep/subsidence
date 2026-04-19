import { Fragment, useEffect, useMemo, useRef } from 'react'

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
  onToggleDeviation: (nextValue: boolean) => void
  onSelectFormation: (formationId: string) => void
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—'
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function fileLabel(path: string | null | undefined): string {
  if (!path) {
    return 'Imported curves'
  }
  const normalized = path.replaceAll('\\', '/')
  const parts = normalized.split('/')
  return parts[parts.length - 1] || normalized
}

function checkboxLeaf(
  checked: boolean,
  label: string,
  secondary: string,
  onChange: (nextValue: boolean) => void,
  backgroundColor?: string,
) {
  return (
    <label className="tree-checkbox-leaf" style={backgroundColor ? { backgroundColor } : undefined}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="tree-checkbox-leaf__label">{label}</span>
      <span className="tree-checkbox-leaf__meta">{secondary}</span>
    </label>
  )
}

function topBackgroundColor(formation: FormationTop): string {
  return formation.strat_color || '#9ca3af'
}

interface TriStateCheckboxProps {
  state: 'none' | 'partial' | 'all'
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
  onToggleDeviation,
  onSelectFormation,
}: WellDataPanelProps) {
  if (wells.length === 0) {
    return (
      <div className="sidebar-panel__body">
        <p className="sidebar-panel__empty">No well loaded.</p>
      </div>
    )
  }

  const hasLas = Boolean(well) && curves.length > 0
  const hasTops = Boolean(well) && formations.length > 0
  const hasDeviation = Boolean(well?.deviation)
  const topsCheckboxState = useMemo<'none' | 'partial' | 'all'>(() => {
    if (formations.length === 0 || visibleFormationIds.length === 0) {
      return 'none'
    }
    if (visibleFormationIds.length >= formations.length) {
      return 'all'
    }
    return 'partial'
  }, [formations.length, visibleFormationIds.length])

  return (
    <div className="sidebar-panel__body">
      {wells.map((item) => {
        const isActive = item.well_id === activeWellId
        return (
          <details key={item.well_id} className="tree-node tree-node--root" open={isActive}>
            <summary
              className={`tree-node__summary tree-node__summary--well ${isActive ? 'tree-node__summary--active' : ''}`}
              onClick={(event) => {
                event.preventDefault()
                onSelectWell(item.well_id)
              }}
            >
              <span className="tree-node__summary-main">
                <input
                  type="radio"
                  name="active-well"
                  checked={isActive}
                  onChange={() => onSelectWell(item.well_id)}
                  onClick={(event) => event.stopPropagation()}
                />
                <span>{item.well_name}</span>
              </span>
            </summary>

            {isActive && well ? (
              <div className="tree-node__children">
                <details className="tree-node" open>
                  <summary className="tree-node__summary">Well metadata</summary>
                  <div className="tree-node__children">
                    <div className="tree-leaf"><span>Name</span><span>{well.well_name}</span></div>
                    <div className="tree-leaf"><span>Location (X, Y)</span><span>{formatNumber(well.x)}, {formatNumber(well.y)}</span></div>
                    <div className="tree-leaf"><span>KB / GL</span><span>{formatNumber(well.kb_elev)} / {formatNumber(well.gl_elev)}</span></div>
                    <div className="tree-leaf"><span>TD</span><span>{formatNumber(well.td_md)}</span></div>
                    <div className="tree-leaf"><span>CRS</span><span>{well.crs || 'unset'}</span></div>
                  </div>
                </details>

                <details className="tree-node" open>
                  <summary className="tree-node__summary">LAS</summary>
                  <div className="tree-node__children">
                    {hasLas ? (
                      <details className="tree-node" open>
                        <summary className="tree-node__summary">{fileLabel(well.source_las_path)}</summary>
                        <div className="tree-node__children">
                          {curves.map((curve) => (
                            <Fragment key={curve.mnemonic}>
                              {checkboxLeaf(
                                visibleCurveMnemonics.includes(curve.mnemonic),
                                curve.mnemonic,
                                curve.unit || '—',
                                (nextValue) => onToggleCurve(curve.mnemonic, nextValue),
                              )}
                            </Fragment>
                          ))}
                        </div>
                      </details>
                    ) : (
                      <p className="sidebar-panel__empty">No LAS loaded.</p>
                    )}
                  </div>
                </details>

                <details className="tree-node" open>
                  <summary className="tree-node__summary tree-node__summary--with-action">
                    <span className="tree-node__summary-main">
                      <TriStateCheckbox state={topsCheckboxState} onToggle={onToggleAllFormations} />
                      <span>TOPS</span>
                    </span>
                  </summary>
                  <div className="tree-node__children">
                    {hasTops ? (
                      formations.map((formation) => (
                        <div
                          key={formation.id}
                          className={`top-leaf ${selectedFormationId === formation.id ? 'top-leaf--selected' : ''}`}
                          style={{ backgroundColor: topBackgroundColor(formation) }}
                          onClick={() => onSelectFormation(formation.id)}
                        >
                          {checkboxLeaf(
                            visibleFormationIds.includes(formation.id),
                            formation.name,
                            formatNumber(formation.depth_md),
                            (nextValue) => onToggleFormation(formation.id, nextValue),
                          )}
                          {formation.strat_unit_name ? (
                            <div className="top-leaf__link-state">Linked: {formation.strat_unit_name}</div>
                          ) : (
                            <div className="top-leaf__link-state">Unlinked</div>
                          )}
                          <div className="top-leaf__kind">Type: {formation.kind}</div>
                        </div>
                      ))
                    ) : (
                      <p className="sidebar-panel__empty">No tops loaded.</p>
                    )}
                  </div>
                </details>

                <details className="tree-node" open>
                  <summary className="tree-node__summary">DEV</summary>
                  <div className="tree-node__children">
                    {hasDeviation ? (
                      <>
                        {checkboxLeaf(
                          isDeviationVisible,
                          'Deviation survey',
                          well.deviation?.reference ?? 'Loaded',
                          onToggleDeviation,
                        )}
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
                </details>
              </div>
            ) : null}
          </details>
        )
      })}
    </div>
  )
}
