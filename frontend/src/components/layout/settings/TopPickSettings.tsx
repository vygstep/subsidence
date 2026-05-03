import { useEffect, useMemo, useState } from 'react'

import { useWellDataStore } from '@/stores'
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
      hiatus_duration_ma?: number
      kind?: string
      color?: string
      water_depth_m?: number
      eroded_thickness_m?: number
      sea_level_m_override?: number | null
    },
  ) => void | Promise<void>
  onFormationMove: (formationId: string, depth: number) => void
}

export function TopPickSettings({ selectedFormation, onFormationUpdate, onFormationMove }: TopPickSettingsProps) {
  const wellId = useWellDataStore((state) => state.well?.well_id)
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

  const hasOverride = selectedFormation.sea_level_m_override != null
  const effectiveSeaLevel = selectedFormation.sea_level_m_override ?? seaLevelAtAge

  const [draftSeaLevel, setDraftSeaLevel] = useState<string>(() =>
    selectedFormation.sea_level_m_override != null
      ? String(selectedFormation.sea_level_m_override)
      : seaLevelAtAge != null
        ? seaLevelAtAge.toFixed(1)
        : '',
  )

  useEffect(() => {
    setDraftSeaLevel(
      selectedFormation.sea_level_m_override != null
        ? String(selectedFormation.sea_level_m_override)
        : seaLevelAtAge != null
          ? seaLevelAtAge.toFixed(1)
          : '',
    )
  }, [selectedFormation.id, selectedFormation.sea_level_m_override, seaLevelAtAge])

  const depositionalElevation = effectiveSeaLevel != null
    ? effectiveSeaLevel - selectedFormation.water_depth_m
    : null

  const isUnconformity = selectedFormation.kind === 'unconformity'
  const depositionResumedMa = selectedFormation.age_ma != null
    ? selectedFormation.age_ma - selectedFormation.hiatus_duration_ma
    : null

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
          <span>Hiatus duration (Ma)</span>
          <input
            type="number"
            step="0.01"
            value={selectedFormation.hiatus_duration_ma}
            onChange={(event) => void onFormationUpdate(selectedFormation.id, {
              hiatus_duration_ma: event.target.value ? Number(event.target.value) : 0,
            })}
          />
        </div>
      )}
      {isUnconformity && depositionResumedMa !== null && (
        <div className="sf-row">
          <span>Deposition resumed</span>
          <span>{depositionResumedMa.toFixed(1)} Ma</span>
        </div>
      )}
      {activeCurveId !== null && (
        <div className="sf-row">
          <span title={`${activeCurveName ?? 'Sea level curve'}${hasOverride ? ' (overridden)' : ''}`}>
            Sea level (m){hasOverride ? ' *' : ''}
          </span>
          <span className="sf-inline-control">
            <input
              type="number"
              step="0.1"
              value={draftSeaLevel}
              onChange={(e) => setDraftSeaLevel(e.target.value)}
              onBlur={() => {
                if (draftSeaLevel !== '') {
                  void onFormationUpdate(selectedFormation.id, { sea_level_m_override: Number(draftSeaLevel) })
                }
              }}
            />
            {hasOverride && (
              <button
                className="sf-reset-btn"
                title="Reset to curve value"
                onClick={() => void onFormationUpdate(selectedFormation.id, { sea_level_m_override: null })}
              >
                ↺
              </button>
            )}
          </span>
        </div>
      )}
      {depositionalElevation != null && (
        <div className="sf-row sf-row--hint">
          <span>Depositional elev. (m)</span>
          <span>{depositionalElevation.toFixed(1)}</span>
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
      <div className="tree-leaf">
        <span>Linked unit</span>
        <span>{selectedFormation.active_strat_unit_name ?? 'Unlinked'}</span>
      </div>
    </div>
  )
}
