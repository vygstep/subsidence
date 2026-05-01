import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'

import { useDataManager } from './dataManager/DataManagerContext'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useViewStore, type SubsidenceModelType } from '@/stores/viewStore'
import { useWellDataStore } from '@/stores/wellDataStore'
import type { FormationInventoryItem, WellInventory } from '@/types'
import type { FormationZone } from '@/types'

interface WellDataPanelProps {
  wells: WellInventory[]
  activeWellId: string | null
  visibleCurveMnemonicsByWellId: Record<string, string[]>
  visibleFormationIdsByWellId: Record<string, string[]>
  hiddenTopSetZoneIdsByWellId?: Record<string, number[]>
  deviationVisibilityByWellId: Record<string, boolean>
  selectedFormationId?: string | null
  onSelectWell: (wellId: string) => void
  onToggleCurve: (wellId: string, mnemonic: string, nextValue: boolean) => void
  onToggleFormation?: (wellId: string, formationId: string, nextValue: boolean) => void
  onToggleTopSetVisibility?: (zoneSetId: number, nextValue: boolean) => void
  onToggleTopSetMarker?: (zoneSetId: number, horizonId: number | null, name: string, nextValue: boolean) => void
  onToggleTopSetZone?: (zoneSetId: number, zoneId: number, nextValue: boolean) => void
  onDeleteTopSet?: (zoneSetId: number, name: string) => void
  onDeleteTopSetMarker?: (zoneSetId: number, horizonId: number, name: string) => void
  onToggleAllFormations?: (wellId: string, nextValue: boolean) => void
  onToggleAllCurves: (wellId: string, nextValue: boolean) => void
  onToggleDeviation: (wellId: string, nextValue: boolean) => void
  onFocusCurveObject: (wellId: string, mnemonic: string) => void
  onFocusFormationObject?: (wellId: string, formationId: string) => void
  onFocusLasGroupObject: (wellId: string) => void
  onFocusTopsGroupObject?: (wellId: string) => void
  onFocusWellObject: (wellId: string) => void
  selectedObject: { type: string; [key: string]: unknown } | null
  onSelectLasGroup: (wellId: string) => void
  onSelectCurve: (wellId: string, mnemonic: string) => void
  onSelectFormation?: (wellId: string, formationId: string) => void
  onSelectTopsGroup?: (wellId: string) => void
  onContextMenuCurve: (event: React.MouseEvent, wellId: string, curve: { mnemonic: string; unit: string }) => void
  onContextMenuDeviation: (event: React.MouseEvent, wellId: string) => void
  onContextMenuFormation?: (event: React.MouseEvent, wellId: string, formation: FormationInventoryItem) => void
  onContextMenuLasGroup: (event: React.MouseEvent, wellId: string) => void
  onContextMenuTopSetMarker?: (event: React.MouseEvent, target: { zoneSetId: number; wellId: string; horizonId: number; name: string }) => void
  onContextMenuTopSetZone?: (event: React.MouseEvent, target: { zoneSetId: number; wellId: string; zoneId: number; name: string }) => void
  onContextMenuTopsGroup?: (event: React.MouseEvent, wellId: string) => void
  onContextMenuWell: (event: React.MouseEvent, well: WellInventory) => void
  onDeleteWell: (wellId: string, wellName: string) => void
  onDeleteAllFormations?: (wellId: string, formations: FormationInventoryItem[], wellName: string) => void
  onDeleteFormation?: (wellId: string, formationId: string, formationName: string) => void
  onDeleteCurve?: (wellId: string, mnemonic: string) => void
  onDeleteAllCurves?: (wellId: string, wellName: string, curveCount: number) => void
  onDeleteDeviation?: (wellId: string, wellName: string) => void
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
  markers: ZoneSetMarkerTreeItem[]
  zones: FormationZone[]
}

interface ZoneSetMarkerTreeItem {
  horizon_id: number | null
  name: string
  color: string
  is_unconformity: boolean
  formation_ids_by_well_id: Record<string, string[]>
  zone_below: FormationZone | null
}

const MODEL_NODES: Array<{ type: SubsidenceModelType; label: string; available: boolean }> = [
  { type: 'total', label: 'Total burial / total subsidence', available: true },
  { type: 'decompaction', label: 'Decompaction', available: false },
  { type: 'airy', label: 'Airy backstripping', available: false },
  { type: 'stepwise', label: 'Stepwise backstripping through time', available: false },
  { type: 'thermal', label: 'Thermal subsidence fitting', available: false },
]

function topBackgroundColor(formation: FormationInventoryItem): string {
  return formation.active_strat_color ?? '#9ca3af'
}

function markerTreeKey(horizonId: number | null, name: string): string {
  return horizonId !== null ? `id:${horizonId}` : `name:${name.toLowerCase()}`
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
  const activeModelType = useViewStore((s) => s.activeSubsidenceModelType)
  const setActiveModelType = useViewStore((s) => s.setActiveSubsidenceModelType)
  const formations = useWellDataStore((s) => s.formations)

  const selectedModelType = selectedObject?.type === 'subsidence-model' ? selectedObject.modelType : null
  const hasPickedFormation = formations.some((formation) => formation.depth_md !== null)

  function isComputed(modelType: SubsidenceModelType): boolean {
    return modelType === 'total' && hasPickedFormation
  }

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
      </div>
      {isExpanded('models-root') ? (
        <div className="tree-node__children">
          {MODEL_NODES.map((model) => (
            <div
              key={model.type}
              className={`tree-leaf tree-leaf--model tree-leaf--clickable${selectedModelType === model.type ? ' tree-leaf--selected' : ''}${!isComputed(model.type) ? ' tree-leaf--muted' : ''}`}
              onClick={() => {
                if (isComputed(model.type)) setActiveModelType(model.type)
                setSelectedObject({ type: 'subsidence-model', modelType: model.type })
              }}
            >
              <input
                type="radio"
                name="active-subsidence-model"
                checked={activeModelType === model.type}
                disabled={!isComputed(model.type)}
                onChange={() => {
                  if (isComputed(model.type)) {
                    setActiveModelType(model.type)
                    setSelectedObject({ type: 'subsidence-model', modelType: model.type })
                  }
                }}
                onClick={(event) => event.stopPropagation()}
              />
              <span className="tree-leaf__label">{model.label}</span>
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
  hiddenTopSetZoneIdsByWellId = {},
  deviationVisibilityByWellId,
  onSelectWell,
  onToggleCurve,
  onToggleTopSetVisibility = () => {},
  onToggleTopSetMarker = () => {},
  onToggleTopSetZone = () => {},
  onDeleteTopSet = () => {},
  onDeleteTopSetMarker = () => {},
  onToggleAllCurves,
  onToggleDeviation,
  onFocusCurveObject,
  onFocusLasGroupObject,
  onFocusWellObject,
  selectedObject,
  onSelectLasGroup,
  onSelectCurve,
  onSelectFormation = () => {},
  onContextMenuCurve,
  onContextMenuDeviation,
  onContextMenuLasGroup,
  onContextMenuTopSetMarker = () => {},
  onContextMenuTopSetZone = () => {},
  onContextMenuWell,
  onDeleteWell,
  onSelectZoneSetsRoot = () => {},
  onSelectZoneSet = () => {},
  onSelectZoneInSet = () => {},
  selectedZoneId = null,
  selectedZoneSetId = null,
  onDeleteCurve,
  onDeleteAllCurves,
  onDeleteDeviation,
}: WellDataPanelProps) {
  const { isExpanded, toggleExpanded, setExpanded } = useDataManager()
  const didInitializeExpanded = useRef(false)

  useEffect(() => {
    if (didInitializeExpanded.current) return
    didInitializeExpanded.current = true
    setExpanded('wells-root', true)
    setExpanded('zones-root', true)
  }, [setExpanded])

  function isOpen(nodeId: string): boolean {
    return isExpanded(nodeId)
  }

  function toggleNode(nodeId: string): void {
    toggleExpanded(nodeId)
  }

  const zoneSets = useMemo<ZoneSetTreeItem[]>(() => {
    const byId = new Map<number, ZoneSetTreeItem & { zoneIds: Set<number>; wellIds: Set<string>; markerCounts: Map<string, { horizon_id: number | null; name: string; color: string; is_unconformity: boolean; formationIdsByWellId: Map<string, string[]> }> }>()
    for (const item of wells) {
      if (item.active_top_set_id === null) continue
      const existing = byId.get(item.active_top_set_id)
      const entry = existing ?? {
        id: item.active_top_set_id,
        name: item.active_top_set_name ?? `TopSet ${item.active_top_set_id}`,
        wells: [],
        markers: [],
        zones: [],
        zoneIds: new Set<number>(),
        wellIds: new Set<string>(),
        markerCounts: new Map<string, { horizon_id: number | null; name: string; color: string; is_unconformity: boolean; formationIdsByWellId: Map<string, string[]> }>(),
      }
      if (!entry.wellIds.has(item.well_id)) {
        entry.wellIds.add(item.well_id)
        entry.wells.push({ well_id: item.well_id, well_name: item.well_name })
      }
      for (const formation of item.formations) {
        const key = formation.horizon_id !== null ? `id:${formation.horizon_id}` : `name:${formation.name.toLowerCase()}`
        const marker = entry.markerCounts.get(key) ?? {
          horizon_id: formation.horizon_id,
          name: formation.name,
          color: topBackgroundColor(formation),
          is_unconformity: false,
          formationIdsByWellId: new Map<string, string[]>(),
        }
        marker.color = formation.kind !== 'unconformity' && marker.color === '#9ca3af'
            ? topBackgroundColor(formation)
            : marker.color
        marker.is_unconformity = marker.is_unconformity || formation.kind === 'unconformity'
        marker.formationIdsByWellId.set(item.well_id, [
          ...(marker.formationIdsByWellId.get(item.well_id) ?? []),
          formation.id,
        ])
        entry.markerCounts.set(key, marker)
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
      .map((entry) => {
        const sortedZones = [...entry.zones].sort((a, b) => a.sort_order - b.sort_order)
        const markers: ZoneSetMarkerTreeItem[] = []
        const seenMarkerKeys = new Set<string>()

        function visualForMarker(horizonId: number | null, name: string): { color: string; is_unconformity: boolean } {
          const marker = entry.markerCounts.get(markerTreeKey(horizonId, name))
            ?? entry.markerCounts.get(markerTreeKey(null, name))
          return {
            color: marker?.color ?? '#9ca3af',
            is_unconformity: marker?.is_unconformity ?? false,
          }
        }

        function formationIdsByWellForMarker(horizonId: number | null, name: string): Record<string, string[]> {
          const marker = entry.markerCounts.get(markerTreeKey(horizonId, name))
            ?? entry.markerCounts.get(markerTreeKey(null, name))
          return Object.fromEntries(marker?.formationIdsByWellId.entries() ?? [])
        }

        function addMarker(horizonId: number | null, name: string, zoneBelow: FormationZone | null): void {
          const key = markerTreeKey(horizonId, name)
          if (seenMarkerKeys.has(key)) return
          seenMarkerKeys.add(key)
          const visual = visualForMarker(horizonId, name)
          markers.push({
            horizon_id: horizonId,
            name,
            color: visual.color,
            is_unconformity: visual.is_unconformity,
            formation_ids_by_well_id: formationIdsByWellForMarker(horizonId, name),
            zone_below: zoneBelow,
          })
        }

        for (const zone of sortedZones) {
          addMarker(zone.upper_horizon.id, zone.upper_horizon.name, zone)
        }
        const lastZone = sortedZones[sortedZones.length - 1]
        if (lastZone) {
          addMarker(lastZone.lower_horizon.id, lastZone.lower_horizon.name, null)
        }
        for (const marker of Array.from(entry.markerCounts.values()).sort((a, b) => a.name.localeCompare(b.name))) {
          addMarker(marker.horizon_id, marker.name, null)
        }

        return {
          id: entry.id,
          name: entry.name,
          wells: entry.wells,
          markers,
          zones: entry.zones,
        }
      })
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
                const isDeviationVisible = deviationVisibilityByWellId[item.well_id] ?? false

                const curvesCheckboxState: ToggleState =
                  item.curves.length === 0 || visibleCurveMnemonics.length === 0
                    ? 'none'
                    : visibleCurveMnemonics.length >= item.curves.length
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
                      <span className="dm-object-color-bar" style={{ ['--dm-object-color' as string]: item.color_hex }} />
                      <button
                        type="button"
                        className="tree-node__label-button"
                        onClick={() => onSelectWell(item.well_id)}
                      >
                        {item.well_name}
                      </button>
                      <button
                        type="button"
                        className="dm-action dm-action--ghost dm-action--danger dm-action--row-end"
                        title={`Delete well "${item.well_name}"`}
                        aria-label={`Delete well "${item.well_name}"`}
                        onClick={(event) => {
                          event.stopPropagation()
                          onDeleteWell(item.well_id, item.well_name)
                        }}
                      >
                        x
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
                            {item.curves.length > 0 && onDeleteAllCurves && (
                              <button
                                type="button"
                                className="dm-action dm-action--ghost dm-action--danger dm-action--row-end"
                                title={`Delete all ${item.curves.length} log curves`}
                                onClick={(e) => { e.stopPropagation(); onDeleteAllCurves(item.well_id, item.well_name, item.curves.length) }}
                              >
                                x
                              </button>
                            )}
                          </div>
                          {isOpen(`${rootId}:las`) ? (
                            <div className="tree-node__children">
                              {item.curves.length > 0 ? (
                                item.curves.map((curve) => (
                                  <div
                                    key={`${item.well_id}:${curve.mnemonic}`}
                                    className={`tree-node__row${
                                      selectedObject?.type === 'curve'
                                      && selectedObject.wellId === item.well_id
                                      && selectedObject.mnemonic === curve.mnemonic
                                        ? ' tree-node__item-selected'
                                        : ''
                                    }`}
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
                                    {onDeleteCurve && (
                                      <button
                                        type="button"
                                        className="dm-action dm-action--ghost dm-action--danger dm-action--row-end"
                                        title={`Delete curve "${curve.mnemonic}"`}
                                        onClick={(e) => { e.stopPropagation(); onDeleteCurve(item.well_id, curve.mnemonic) }}
                                      >
                                        x
                                      </button>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <p className="sidebar-panel__empty">No logs loaded.</p>
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
                            {item.deviation && onDeleteDeviation && (
                              <button
                                type="button"
                                className="dm-action dm-action--ghost dm-action--danger dm-action--row-end"
                                title="Delete deviation survey"
                                onClick={(e) => { e.stopPropagation(); onDeleteDeviation(item.well_id, item.well_name) }}
                              >
                                x
                              </button>
                            )}
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
              STRATIGRAPHY
            </button>
          </div>
          {isOpen('zones-root') ? (
            <div className="tree-node__children">
              {zoneSets.length === 0 ? (
                <p className="sidebar-panel__empty">No TopSets assigned.</p>
              ) : zoneSets.map((zoneSet) => {
                const selectedWellId = zoneSet.wells.find((w) => w.well_id === activeWellId)?.well_id ?? zoneSet.wells[0]?.well_id
                const isZoneSetSelected = selectedObject?.type === 'zone-set' && selectedZoneSetId === zoneSet.id
                const selectedVisibleFormationIds = selectedWellId ? visibleFormationIdsByWellId[selectedWellId] ?? [] : []
                const selectedHiddenZoneIds = selectedWellId ? hiddenTopSetZoneIdsByWellId[selectedWellId] ?? [] : []
                const markerVisibleStates = zoneSet.markers.map((marker) => {
                  const ids = selectedWellId ? marker.formation_ids_by_well_id[selectedWellId] ?? [] : []
                  return ids.length > 0 && ids.every((id) => selectedVisibleFormationIds.includes(id))
                })
                const zoneVisibleStates = zoneSet.zones.map((zone) => !selectedHiddenZoneIds.includes(zone.zone_id))
                const visibleStateItems = [...markerVisibleStates, ...zoneVisibleStates]
                const topSetCheckboxState: ToggleState = visibleStateItems.length === 0 || visibleStateItems.every((state) => !state)
                  ? 'none'
                  : visibleStateItems.every(Boolean)
                    ? 'all'
                    : 'partial'
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
                      <TriStateCheckbox state={topSetCheckboxState} onToggle={(nextValue) => onToggleTopSetVisibility(zoneSet.id, nextValue)} />
                      <button type="button" className="tree-node__section-label">
                        {zoneSet.name}
                      </button>
                      <button
                        type="button"
                        className="dm-action dm-action--ghost dm-action--danger dm-action--row-end"
                        title={`Delete TopSet "${zoneSet.name}"`}
                        aria-label={`Delete TopSet "${zoneSet.name}"`}
                        onClick={(event) => {
                          event.stopPropagation()
                          onDeleteTopSet(zoneSet.id, zoneSet.name)
                        }}
                      >
                        x
                      </button>
                    </div>
                    {isOpen(`zones:${zoneSet.id}`) ? (
                      <div className="tree-node__children">
                        {zoneSet.markers.length === 0 ? (
                          <p className="sidebar-panel__empty">No markers loaded.</p>
                        ) : zoneSet.markers.map((marker) => {
                          const zoneBelow = marker.zone_below
                          const markerNodeId = `zones:${zoneSet.id}:marker:${markerTreeKey(marker.horizon_id, marker.name)}`
                          const markerFormationIds = selectedWellId ? marker.formation_ids_by_well_id[selectedWellId] ?? [] : []
                          const markerChecked = markerFormationIds.length > 0 && markerFormationIds.every((id) => selectedVisibleFormationIds.includes(id))
                          const selectedFormationObjectId = selectedObject?.type === 'top-pick' && typeof selectedObject.formationId === 'string'
                            ? selectedObject.formationId
                            : null
                          const selectedMarkerFormationId = selectedFormationObjectId && markerFormationIds.includes(selectedFormationObjectId)
                            ? selectedFormationObjectId
                            : null
                          return (
                            <div key={markerNodeId} className="tree-node">
                              <div
                                className={`tree-node__row${selectedMarkerFormationId ? ' tree-node__row--selected' : ''}`}
                                onContextMenu={(event) => {
                                  if (selectedWellId && marker.horizon_id !== null) {
                                    onContextMenuTopSetMarker(event, {
                                      zoneSetId: zoneSet.id,
                                      wellId: selectedWellId,
                                      horizonId: marker.horizon_id,
                                      name: marker.name,
                                    })
                                  }
                                }}
                                onClick={() => {
                                  if (selectedWellId && markerFormationIds.length > 0) {
                                    void onSelectFormation(selectedWellId, markerFormationIds[0])
                                  }
                                }}
                              >
                                {zoneBelow ? (
                                  <TreeToggleButton
                                    isOpen={isOpen(markerNodeId)}
                                    onToggle={() => toggleNode(markerNodeId)}
                                  />
                                ) : (
                                  <span className="tree-toggle tree-toggle--spacer" aria-hidden="true">&gt;</span>
                                )}
                                <input
                                  type="checkbox"
                                  checked={markerChecked}
                                  disabled={markerFormationIds.length === 0}
                                  onChange={(event) => onToggleTopSetMarker(zoneSet.id, marker.horizon_id, marker.name, event.target.checked)}
                                  onClick={(event) => event.stopPropagation()}
                                />
                                <span className="dm-object-color-bar" style={{ ['--dm-object-color' as string]: marker.color }} />
                                <span className={`tree-node__section-label${marker.is_unconformity ? ' tree-node__section-label--unconformity' : ''}`}>
                                  {marker.name}
                                </span>
                                {marker.horizon_id !== null ? (
                                  <button
                                    type="button"
                                    className="dm-action dm-action--ghost dm-action--danger dm-action--row-end"
                                    title={`Delete marker "${marker.name}"`}
                                    aria-label={`Delete marker "${marker.name}"`}
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      onDeleteTopSetMarker(zoneSet.id, marker.horizon_id!, marker.name)
                                    }}
                                  >
                                    x
                                  </button>
                                ) : null}
                              </div>
                              {zoneBelow && isOpen(markerNodeId) ? (
                                <div className="tree-node__children">
                                  {(() => {
                                    const isZoneSelected = selectedObject?.type === 'zone'
                                      && selectedObject.zoneSetId === zoneSet.id
                                      && selectedZoneId === zoneBelow.zone_id
                                    return (
                                      <div
                                        className={`tree-leaf tree-leaf--zone tree-leaf--clickable${marker.is_unconformity ? ' tree-leaf--zone-unconformity' : ''}${isZoneSelected ? ' tree-leaf--selected' : ''}`}
                                        style={{ ['--tree-zone-color' as string]: marker.color }}
                                        onClick={() => selectedWellId && onSelectZoneInSet(zoneSet.id, selectedWellId, zoneBelow.zone_id)}
                                        onContextMenu={(event) => selectedWellId && onContextMenuTopSetZone(event, {
                                          zoneSetId: zoneSet.id,
                                          wellId: selectedWellId,
                                          zoneId: zoneBelow.zone_id,
                                          name: `${zoneBelow.upper_horizon.name} -> ${zoneBelow.lower_horizon.name}`,
                                        })}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={!selectedHiddenZoneIds.includes(zoneBelow.zone_id)}
                                          onChange={(event) => onToggleTopSetZone(zoneSet.id, zoneBelow.zone_id, event.target.checked)}
                                          onClick={(event) => event.stopPropagation()}
                                        />
                                        <span className="tree-leaf__label tree-leaf__label--zone">
                                          {zoneBelow.upper_horizon.name} -&gt; {zoneBelow.lower_horizon.name}
                                        </span>
                                      </div>
                                    )
                                  })()}
                                </div>
                              ) : null}
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
