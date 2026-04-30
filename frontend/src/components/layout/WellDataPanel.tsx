import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'

import { useDataManager } from './dataManager/DataManagerContext'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import type { SubsidenceModelType } from '@/stores/viewStore'
import type { FormationInventoryItem, WellInventory } from '@/types'
import type { FormationZone } from '@/types'

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
  onFocusCurveObject: (wellId: string, mnemonic: string) => void
  onFocusFormationObject: (wellId: string, formationId: string) => void
  onFocusLasGroupObject: (wellId: string) => void
  onFocusTopsGroupObject: (wellId: string) => void
  onFocusWellObject: (wellId: string) => void
  onSelectFormation: (wellId: string, formationId: string) => void
  selectedObject: { type: string; [key: string]: unknown } | null
  onSelectLasGroup: (wellId: string) => void
  onSelectCurve: (wellId: string, mnemonic: string) => void
  onSelectTopsGroup: (wellId: string) => void
  onContextMenuCurve: (event: React.MouseEvent, wellId: string, curve: { mnemonic: string; unit: string }) => void
  onContextMenuDeviation: (event: React.MouseEvent, wellId: string) => void
  onContextMenuFormation: (event: React.MouseEvent, wellId: string, formation: FormationInventoryItem) => void
  onContextMenuLasGroup: (event: React.MouseEvent, wellId: string) => void
  onContextMenuTopsGroup: (event: React.MouseEvent, wellId: string) => void
  onContextMenuWell: (event: React.MouseEvent, well: WellInventory) => void
  onDeleteWell: (wellId: string, wellName: string) => void
  onDeleteAllFormations: (wellId: string, formations: FormationInventoryItem[], wellName: string) => void
  onDeleteFormation: (wellId: string, formationId: string, formationName: string) => void
  onSelectZoneSetsRoot?: () => void
  onSelectZoneSet?: (zoneSetId: number, wellId: string) => void
  onSelectZoneInSet?: (zoneSetId: number, wellId: string, zoneId: number) => void
  selectedZoneId?: number | null
  selectedZoneSetId?: number | null
}

type ToggleState = 'none' | 'partial' | 'all'

interface ZoneSetTreeItem {
  id: number
  name: string
  wells: Array<{ well_id: string; well_name: string }>
  zones: FormationZone[]
}

const MODEL_NODES: Array<{ type: SubsidenceModelType; label: string; available: boolean }> = [
  { type: 'total', label: 'Total burial / total subsidence', available: true },
  { type: 'decompaction', label: 'Decompaction', available: false },
  { type: 'airy', label: 'Airy backstripping', available: false },
  { type: 'stepwise', label: 'Stepwise backstripping through time', available: false },
  { type: 'thermal', label: 'Thermal subsidence fitting', available: false },
]

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-'
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
      &gt;
    </button>
  )
}

interface TriStateCheckboxProps {
  state: ToggleState
  onToggle: (nextValue: boolean) => void
}

function TriStateCheckbox({ state, onToggle }: TriStateCheckboxProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  useLayoutEffect(() => {
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
      onChange={() => onToggle(state === 'none')}
      onClick={(event) => {
        event.stopPropagation()
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
    <div className="tree-checkbox-leaf">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        onClick={(event) => event.stopPropagation()}
      />
      <span className="tree-checkbox-leaf__label">{label}</span>
      <span className="tree-checkbox-leaf__meta">{secondary}</span>
    </div>
  )
}

function ModelsRoot() {
  const { isExpanded, toggleExpanded } = useDataManager()
  const selectedObject = useWorkspaceStore((s) => s.selectedObject)
  const setSelectedObject = useWorkspaceStore((s) => s.setSelectedObject)

  const selectedModelType = selectedObject?.type === 'subsidence-model' ? selectedObject.modelType : null

  return (
    <div className="tree-node tree-node--root">
      <div className="tree-node__row tree-node__row--root">
        <button
          type="button"
          className={`tree-toggle ${isExpanded('models-root') ? 'tree-toggle--open' : ''}`}
          onClick={(e) => { e.stopPropagation(); toggleExpanded('models-root') }}
          aria-label={isExpanded('models-root') ? 'Collapse' : 'Expand'}
        >
          &gt;
        </button>
        <button type="button" className="tree-node__label-button">
          Models
        </button>
        <span className="tree-node__count">{MODEL_NODES.length}</span>
      </div>
      {isExpanded('models-root') ? (
        <div className="tree-node__children">
          {MODEL_NODES.map((model) => (
            <div
              key={model.type}
              className={`tree-leaf tree-leaf--clickable${selectedModelType === model.type ? ' tree-leaf--selected' : ''}${!model.available ? ' tree-leaf--muted' : ''}`}
              onClick={() => setSelectedObject({ type: 'subsidence-model', modelType: model.type })}
            >
              <span>{model.label}</span>
              {!model.available && <span className="tree-node__badge">planned</span>}
            </div>
          ))}
        </div>
      ) : null}
    </div>
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
  onFocusCurveObject,
  onFocusFormationObject,
  onFocusLasGroupObject,
  onFocusTopsGroupObject,
  onFocusWellObject,
  onSelectFormation,
  selectedObject,
  onSelectLasGroup,
  onSelectCurve,
  onSelectTopsGroup,
  onContextMenuCurve,
  onContextMenuDeviation,
  onContextMenuFormation,
  onContextMenuLasGroup,
  onContextMenuTopsGroup,
  onContextMenuWell,
  onDeleteWell,
  onDeleteAllFormations,
  onDeleteFormation,
  onSelectZoneSetsRoot = () => {},
  onSelectZoneSet = () => {},
  onSelectZoneInSet = () => {},
  selectedZoneId = null,
  selectedZoneSetId = null,
}: WellDataPanelProps) {
  const { isExpanded, toggleExpanded, setExpanded } = useDataManager()

  useEffect(() => {
    setExpanded('wells-root', true)
    setExpanded('zones-root', true)
  }, [])

  function isOpen(nodeId: string): boolean {
    return isExpanded(nodeId)
  }

  function toggleNode(nodeId: string): void {
    toggleExpanded(nodeId)
  }

  const zoneSets = useMemo<ZoneSetTreeItem[]>(() => {
    const byId = new Map<number, ZoneSetTreeItem & { zoneIds: Set<number>; wellIds: Set<string> }>()
    for (const item of wells) {
      if (item.active_top_set_id === null) continue
      const existing = byId.get(item.active_top_set_id)
      const entry = existing ?? {
        id: item.active_top_set_id,
        name: item.active_top_set_name ?? `ZoneSet ${item.active_top_set_id}`,
        wells: [],
        zones: [],
        zoneIds: new Set<number>(),
        wellIds: new Set<string>(),
      }
      if (!entry.wellIds.has(item.well_id)) {
        entry.wellIds.add(item.well_id)
        entry.wells.push({ well_id: item.well_id, well_name: item.well_name })
      }
      for (const zone of item.zones) {
        if (!entry.zoneIds.has(zone.zone_id)) {
          entry.zoneIds.add(zone.zone_id)
          entry.zones.push(zone)
        }
      }
      byId.set(entry.id, entry)
    }
    return Array.from(byId.values())
      .map(({ zoneIds: _zoneIds, wellIds: _wellIds, ...entry }) => entry)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [wells])

  return (
    <div className="sidebar-panel__body">
      <div className="tree-list">
        <div className="tree-node tree-node--root">
          <div className="tree-node__row tree-node__row--root">
            <TreeToggleButton isOpen={isOpen('wells-root')} onToggle={() => toggleNode('wells-root')} />
            <button type="button" className="tree-node__label-button">
              WELLS
            </button>
            <span className="tree-node__count">{wells.length}</span>
          </div>
          {isOpen('wells-root') ? (
            <div className="tree-node__children">
              {wells.length === 0 ? (
                <p className="sidebar-panel__empty">No wells loaded.</p>
              ) : wells.map((item) => {
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
                      onContextMenu={(event) => {
                        onFocusWellObject(item.well_id)
                        onContextMenuWell(event, item)
                      }}
                    >
                      <TreeToggleButton isOpen={showDetails} onToggle={() => toggleNode(rootId)} />
                      <input
                        type="radio"
                        name="active-well"
                        checked={isActive}
                        onChange={() => onSelectWell(item.well_id)}
                      />
                      <span className="tree-node__color-swatch" style={{ backgroundColor: item.color_hex }} />
                      <button
                        type="button"
                        className="tree-node__label-button"
                        onClick={() => onSelectWell(item.well_id)}
                      >
                        {item.well_name}
                      </button>
                      <button
                        type="button"
                        className="dm-action dm-action--ghost dm-action--danger"
                        title={`Delete well "${item.well_name}"`}
                        aria-label={`Delete well "${item.well_name}"`}
                        style={{ marginLeft: 'auto' }}
                        onClick={(event) => {
                          event.stopPropagation()
                          onDeleteWell(item.well_id, item.well_name)
                        }}
                      >
                        ✕
                      </button>
                    </div>

                    {showDetails ? (
                      <div className="tree-node__children">
                        <div className="tree-node">
                          <div
                            className={`tree-node__row ${
                              selectedObject?.type === 'las-group' && selectedObject.wellId === item.well_id ? 'tree-node__row--selected' : ''
                            }`}
                            onContextMenu={(event) => {
                              onFocusLasGroupObject(item.well_id)
                              onContextMenuLasGroup(event, item.well_id)
                            }}
                          >
                            <TreeToggleButton
                              isOpen={isOpen(`${rootId}:las`)}
                              onToggle={() => toggleNode(`${rootId}:las`)}
                            />
                            <TriStateCheckbox state={curvesCheckboxState} onToggle={(nextValue) => onToggleAllCurves(item.well_id, nextValue)} />
                            <button type="button" className="tree-node__section-label" onClick={() => onSelectLasGroup(item.well_id)}>
                              Logs
                            </button>
                          </div>
                          {isOpen(`${rootId}:las`) ? (
                            <div className="tree-node__children">
                              {item.curves.length > 0 ? (
                                item.curves.map((curve) => (
                                  <div
                                    key={`${item.well_id}:${curve.mnemonic}`}
                                    className={
                                      selectedObject?.type === 'curve'
                                      && selectedObject.wellId === item.well_id
                                      && selectedObject.mnemonic === curve.mnemonic
                                        ? 'tree-node__item-selected'
                                        : ''
                                    }
                                    onClick={() => onSelectCurve(item.well_id, curve.mnemonic)}
                                    onContextMenu={(event) => {
                                      onFocusCurveObject(item.well_id, curve.mnemonic)
                                      onContextMenuCurve(event, item.well_id, curve)
                                    }}
                                  >
                                    <CheckboxLeaf
                                      checked={visibleCurveMnemonics.includes(curve.mnemonic)}
                                      label={curve.mnemonic}
                                      secondary={curve.unit || '-'}
                                      onChange={(nextValue) => onToggleCurve(item.well_id, curve.mnemonic, nextValue)}
                                    />
                                  </div>
                                ))
                              ) : (
                                <p className="sidebar-panel__empty">No logs loaded.</p>
                              )}
                            </div>
                          ) : null}
                        </div>

                        <div className="tree-node">
                          <div
                            className={`tree-node__row ${
                              selectedObject?.type === 'tops-group' && selectedObject.wellId === item.well_id ? 'tree-node__row--selected' : ''
                            }`}
                            onContextMenu={(event) => {
                              onFocusTopsGroupObject(item.well_id)
                              onContextMenuTopsGroup(event, item.well_id)
                            }}
                          >
                            <TreeToggleButton
                              isOpen={isOpen(`${rootId}:tops`)}
                              onToggle={() => toggleNode(`${rootId}:tops`)}
                            />
                            <TriStateCheckbox state={topsCheckboxState} onToggle={(nextValue) => onToggleAllFormations(item.well_id, nextValue)} />
                            <button type="button" className="tree-node__section-label" onClick={() => onSelectTopsGroup(item.well_id)}>
                              TOPS
                            </button>
                            {item.formations.length > 0 && (
                              <button
                                type="button"
                                className="dm-action dm-action--ghost dm-action--danger"
                                title={`Delete all tops for "${item.well_name}"`}
                                aria-label={`Delete all tops for "${item.well_name}"`}
                                style={{ marginLeft: 'auto' }}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  onDeleteAllFormations(item.well_id, item.formations, item.well_name)
                                }}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                          {isOpen(`${rootId}:tops`) ? (
                            <div className="tree-node__children">
                              {item.formations.length > 0 ? (
                                item.formations.map((formation) => (
                                  <div
                                    key={formation.id}
                                    className={`top-leaf ${selectedFormationId === formation.id && isActive ? 'top-leaf--selected' : ''} ${formation.kind === 'unconformity' ? 'top-leaf--unconformity' : ''}`}
                                    style={{ ['--top-leaf-color' as string]: topBackgroundColor(formation) }}
                                    onClick={() => onSelectFormation(item.well_id, formation.id)}
                                    onContextMenu={(event) => {
                                      onFocusFormationObject(item.well_id, formation.id)
                                      onContextMenuFormation(event, item.well_id, formation)
                                    }}
                                  >
                                    <CheckboxLeaf
                                      checked={visibleFormationIds.includes(formation.id)}
                                      label={formation.name}
                                      secondary={formatNumber(formation.depth_md)}
                                      onChange={(nextValue) => onToggleFormation(item.well_id, formation.id, nextValue)}
                                    />
                                    <button
                                      type="button"
                                      className="dm-action dm-action--ghost dm-action--danger"
                                      title={`Delete top "${formation.name}"`}
                                      aria-label={`Delete top "${formation.name}"`}
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        onDeleteFormation(item.well_id, formation.id, formation.name)
                                      }}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ))
                              ) : (
                                <p className="sidebar-panel__empty">No tops loaded.</p>
                              )}
                            </div>
                          ) : null}
                        </div>

                        <div className="tree-node">
                          <div className="tree-node__row" onContextMenu={(event) => onContextMenuDeviation(event, item.well_id)}>
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
          ) : null}
        </div>

        <div className="tree-node tree-node--root">
          <div
            className={`tree-node__row tree-node__row--root ${selectedObject?.type === 'zone-sets-root' ? 'tree-node__row--selected' : ''}`}
            onClick={onSelectZoneSetsRoot}
          >
            <TreeToggleButton isOpen={isOpen('zones-root')} onToggle={() => toggleNode('zones-root')} />
            <button type="button" className="tree-node__label-button">
              ZONES
            </button>
            <span className="tree-node__count">{zoneSets.length}</span>
          </div>
          {isOpen('zones-root') ? (
            <div className="tree-node__children">
              {zoneSets.length === 0 ? (
                <p className="sidebar-panel__empty">No ZoneSets assigned.</p>
              ) : zoneSets.map((zoneSet) => {
                const selectedWellId = zoneSet.wells.find((w) => w.well_id === activeWellId)?.well_id ?? zoneSet.wells[0]?.well_id
                const isZoneSetSelected = selectedObject?.type === 'zone-set' && selectedZoneSetId === zoneSet.id
                return (
                  <div key={zoneSet.id} className="tree-node">
                    <div
                      className={`tree-node__row ${isZoneSetSelected ? 'tree-node__row--selected' : ''}`}
                      onClick={() => selectedWellId && onSelectZoneSet(zoneSet.id, selectedWellId)}
                    >
                      <TreeToggleButton
                        isOpen={isOpen(`zones:${zoneSet.id}`)}
                        onToggle={() => toggleNode(`zones:${zoneSet.id}`)}
                      />
                      <button type="button" className="tree-node__section-label">
                        {zoneSet.name}
                      </button>
                      <span className="tree-node__count">{zoneSet.zones.length}</span>
                    </div>
                    {isOpen(`zones:${zoneSet.id}`) ? (
                      <div className="tree-node__children">
                        {zoneSet.zones.length === 0 ? (
                          <p className="sidebar-panel__empty">No zones loaded.</p>
                        ) : zoneSet.zones.map((zone) => {
                          const isZoneSelected = selectedObject?.type === 'zone'
                            && selectedObject.zoneSetId === zoneSet.id
                            && selectedZoneId === zone.zone_id
                          return (
                            <div
                              key={zone.zone_id}
                              className={`tree-leaf tree-leaf--clickable${isZoneSelected ? ' tree-leaf--selected' : ''}`}
                              onClick={() => selectedWellId && onSelectZoneInSet(zoneSet.id, selectedWellId, zone.zone_id)}
                            >
                              <span>{zone.upper_horizon.name} -&gt; {zone.lower_horizon.name}</span>
                              <span>{zoneSet.wells.length} wells</span>
                            </div>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>

        <ModelsRoot />
      </div>
    </div>
  )
}
