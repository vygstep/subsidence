import { useEffect, useMemo, useState } from 'react'

import { useViewStore, useWellDataStore, useWorkspaceStore } from '@/stores'
import type { FormationTop, SeaLevelPoint } from '@/types'

function interpolateSeaLevel(points: SeaLevelPoint[], ageMa: number): number | null {
  if (points.length === 0) return null
  const sorted = [...points].sort((a, b) => a.age_ma - b.age_ma)
  if (ageMa <= sorted[0].age_ma) return sorted[0].sea_level_m
  if (ageMa >= sorted[sorted.length - 1].age_ma) return sorted[sorted.length - 1].sea_level_m
  for (let i = 0; i < sorted.length - 1; i++) {
    if (ageMa >= sorted[i].age_ma && ageMa <= sorted[i + 1].age_ma) {
      const t = (ageMa - sorted[i].age_ma) / (sorted[i + 1].age_ma - sorted[i].age_ma)
      return sorted[i].sea_level_m + t * (sorted[i + 1].sea_level_m - sorted[i].sea_level_m)
    }
  }
  return null
}

interface TopPickSettingsProps {
  selectedFormation: FormationTop
  onFormationUpdate: (
    formationId: string,
    patch: {
      name?: string
      age_ma?: number
      age_base_ma?: number
      kind?: string
      color?: string
      water_depth_m?: number
      eroded_thickness_m?: number
    },
  ) => void | Promise<void>
  onFormationMove: (formationId: string, depth: number) => void
}

export function TopPickSettings({ selectedFormation, onFormationUpdate, onFormationMove }: TopPickSettingsProps) {
  const wellId = useWellDataStore((state) => state.well?.well_id)
  const updateWellViewState = useWorkspaceStore((state) => state.updateWellViewState)
  const globalMarkerPosition = useViewStore((state) => state.formationsTrackConfig.markerLabelPosition)
  const wellInventories = useWellDataStore((state) => state.wellInventories)
  const loadSeaLevelPoints = useWellDataStore((state) => state.loadSeaLevelPoints)
  const seaLevelCurves = useWellDataStore((state) => state.seaLevelCurves)

  const activeCurveId = wellInventories.find((w) => w.well_id === wellId)?.active_sea_level_curve_id ?? null
  const activeCurveName = seaLevelCurves.find((c) => c.id === activeCurveId)?.name ?? null

  const [seaLevelPoints, setSeaLevelPoints] = useState<SeaLevelPoint[]>([])

  useEffect(() => {
    if (!activeCurveId) {
      setSeaLevelPoints([])
      return
    }
    void loadSeaLevelPoints(activeCurveId).then(setSeaLevelPoints)
  }, [activeCurveId, loadSeaLevelPoints])

  const seaLevelAtAge = useMemo(() => {
    if (selectedFormation.age_ma == null || !activeCurveId) return null
    return interpolateSeaLevel(seaLevelPoints, selectedFormation.age_ma)
  }, [seaLevelPoints, selectedFormation.age_ma, activeCurveId])

  const labelHidden = useWorkspaceStore((state) => {
    const view = wellId ? state.wellViewStates[wellId] : null
    return view?.hiddenTopLabelIds?.includes(selectedFormation.id) ?? false
  })

  const perFormationPosition = useWorkspaceStore((state) => {
    const view = wellId ? state.wellViewStates[wellId] : null
    return view?.topLabelPositions?.[selectedFormation.id] ?? null
  })

  const handleToggleLabel = (show: boolean) => {
    if (!wellId) return
    updateWellViewState(wellId, (state) => ({
      ...state,
      hiddenTopLabelIds: show
        ? state.hiddenTopLabelIds.filter((id) => id !== selectedFormation.id)
        : [...state.hiddenTopLabelIds, selectedFormation.id],
    }))
  }

  const handlePositionChange = (value: string) => {
    if (!wellId) return
    updateWellViewState(wellId, (state) => {
      const next = { ...state.topLabelPositions }
      if (value === '') {
        delete next[selectedFormation.id]
      } else {
        next[selectedFormation.id] = value as 'left' | 'center' | 'right'
      }
      return { ...state, topLabelPositions: next }
    })
  }

  const isUnconformity = selectedFormation.kind === 'unconformity'

  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Top</div>
        <div className="template-panel__value">{selectedFormation.name}</div>
      </div>
      <div className="sf-row">
        <span>Name</span>
        <input
          value={selectedFormation.name}
          onChange={(event) => void onFormationUpdate(selectedFormation.id, { name: event.target.value })}
        />
      </div>
      <div className="sf-row">
        <span>Depth (MD)</span>
        <input
          type="number"
          step="0.1"
          value={selectedFormation.depth_md ?? ''}
          onChange={(event) => onFormationMove(selectedFormation.id, Number(event.target.value))}
        />
      </div>
      <div className="sf-row">
        <span>Kind</span>
        <select
          value={selectedFormation.kind}
          onChange={(event) => void onFormationUpdate(selectedFormation.id, { kind: event.target.value })}
        >
          <option value="strat">Conformable</option>
          <option value="unconformity">Unconformity</option>
        </select>
      </div>
      <div className="sf-row">
        <span>Color</span>
        <input
          type="color"
          className="sf-swatch"
          value={selectedFormation.color}
          onChange={(event) => void onFormationUpdate(selectedFormation.id, { color: event.target.value })}
        />
      </div>
      <div className="sf-row">
        <span>{isUnconformity ? 'Top age (Ma)' : 'Age (Ma)'}</span>
        <input
          type="number"
          step="0.01"
          value={selectedFormation.age_ma ?? ''}
          onChange={(event) => void onFormationUpdate(selectedFormation.id, {
            age_ma: event.target.value ? Number(event.target.value) : undefined,
          })}
        />
      </div>
      {isUnconformity && (
        <div className="sf-row">
          <span>Base age (Ma)</span>
          <input
            type="number"
            step="0.01"
            value={selectedFormation.age_base_ma ?? ''}
            onChange={(event) => void onFormationUpdate(selectedFormation.id, {
              age_base_ma: event.target.value ? Number(event.target.value) : undefined,
            })}
          />
        </div>
      )}
      {activeCurveId !== null && (
        <div className="sf-row">
          <span title={activeCurveName ?? undefined}>Sea level (m)</span>
          <span>{seaLevelAtAge != null ? seaLevelAtAge.toFixed(1) : '—'}</span>
        </div>
      )}
      <div className="sf-row">
        <span>Paleobathymetry (m)</span>
        <input
          type="number"
          step="1"
          value={selectedFormation.water_depth_m}
          onChange={(event) => void onFormationUpdate(selectedFormation.id, { water_depth_m: Number(event.target.value) })}
        />
      </div>
      {isUnconformity && (
        <div className="sf-row">
          <span>Eroded thickness (m)</span>
          <input
            type="number"
            min="0"
            step="1"
            value={selectedFormation.eroded_thickness_m}
            onChange={(event) => void onFormationUpdate(selectedFormation.id, { eroded_thickness_m: Number(event.target.value) })}
          />
        </div>
      )}
      <label className="sf-row">
        <span>Marker label</span>
        <input
          type="checkbox"
          checked={!labelHidden}
          onChange={(event) => handleToggleLabel(event.target.checked)}
        />
      </label>
      <div className="sf-row">
        <span>Marker position</span>
        <select
          value={perFormationPosition ?? ''}
          onChange={(e) => handlePositionChange(e.target.value)}
        >
          <option value="">— global ({globalMarkerPosition})</option>
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </div>
      <div className="tree-leaf">
        <span>Linked unit</span>
        <span>{selectedFormation.active_strat_unit_name ?? 'Unlinked'}</span>
      </div>
    </div>
  )
}
