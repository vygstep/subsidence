import { useEffect, useMemo, useState } from 'react'

import { useNotificationStore, useWellDataStore } from '@/stores'
import { formationDisplayColor } from '@/types'
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
      color_source?: string
      reset_color?: boolean
      water_depth_m?: number
      eroded_thickness_m?: number
      sea_level_m_override?: number | null
    },
  ) => void | Promise<void>
  onFormationMove: (formationId: string, depth: number) => void
}

export function TopPickSettings({ selectedFormation, onFormationUpdate, onFormationMove }: TopPickSettingsProps) {
  const wellId = useWellDataStore((state) => state.well?.well_id)
  const wellTdMd = useWellDataStore((state) => state.well?.td_md ?? null)
  const wellInventories = useWellDataStore((state) => state.wellInventories)
  const loadSeaLevelPoints = useWellDataStore((state) => state.loadSeaLevelPoints)
  const seaLevelCurves = useWellDataStore((state) => state.seaLevelCurves)
  const formations = useWellDataStore((state) => state.formations)
  const addQcWarnings = useNotificationStore((state) => state.addQcWarnings)

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

  const [draftName, setDraftName] = useState<string>(() => selectedFormation.name)
  useEffect(() => {
    setDraftName(selectedFormation.name)
  }, [selectedFormation.id, selectedFormation.name])

  const [draftDepthMd, setDraftDepthMd] = useState<string>(
    () => selectedFormation.depth_md != null ? String(selectedFormation.depth_md) : '',
  )
  useEffect(() => {
    setDraftDepthMd(selectedFormation.depth_md != null ? String(selectedFormation.depth_md) : '')
  }, [selectedFormation.id, selectedFormation.depth_md])

  const [draftAgeMa, setDraftAgeMa] = useState<string>(
    () => selectedFormation.age_ma != null ? String(selectedFormation.age_ma) : '',
  )
  useEffect(() => {
    setDraftAgeMa(selectedFormation.age_ma != null ? String(selectedFormation.age_ma) : '')
  }, [selectedFormation.id, selectedFormation.age_ma])

  const [draftHiatus, setDraftHiatus] = useState<string>(
    () => String(selectedFormation.hiatus_duration_ma),
  )
  useEffect(() => {
    setDraftHiatus(String(selectedFormation.hiatus_duration_ma))
  }, [selectedFormation.id, selectedFormation.hiatus_duration_ma])

  const [draftErodedThickness, setDraftErodedThickness] = useState<string>(
    () => String(selectedFormation.eroded_thickness_m),
  )
  useEffect(() => {
    setDraftErodedThickness(String(selectedFormation.eroded_thickness_m))
  }, [selectedFormation.id, selectedFormation.eroded_thickness_m])

  const [draftWaterDepth, setDraftWaterDepth] = useState<string>(
    () => String(selectedFormation.water_depth_m),
  )
  useEffect(() => {
    setDraftWaterDepth(String(selectedFormation.water_depth_m))
  }, [selectedFormation.id, selectedFormation.water_depth_m])

  const depositionalElevation = (effectiveSeaLevel ?? 0) - selectedFormation.water_depth_m

  const isUnconformity = selectedFormation.kind === 'unconformity'
  const depositionResumedMa = selectedFormation.age_ma != null
    ? selectedFormation.age_ma - selectedFormation.hiatus_duration_ma
    : null

  // Neighbor age bounds for clamping the age input
  const { minAgeMa, maxAgeMa } = useMemo(() => {
    const sorted = [...formations].sort((a, b) => (a.depth_md ?? Infinity) - (b.depth_md ?? Infinity))
    const idx = sorted.findIndex((f) => f.id === selectedFormation.id)
    const aboveAge = idx > 0
      ? sorted.slice(0, idx).reverse().find((f) => f.age_ma != null)?.age_ma
      : undefined
    const belowAge = idx >= 0 && idx < sorted.length - 1
      ? sorted.slice(idx + 1).find((f) => f.age_ma != null)?.age_ma
      : undefined
    return { minAgeMa: aboveAge, maxAgeMa: belowAge }
  }, [formations, selectedFormation.id])

  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Top</div>
        <div className="template-panel__value">{selectedFormation.name}</div>
      </div>
      <div className="sf-row">
        <span>Name</span>
        <input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
          onBlur={() => {
            const trimmed = draftName.trim()
            if (trimmed && trimmed !== selectedFormation.name) {
              void onFormationUpdate(selectedFormation.id, { name: trimmed })
            } else {
              setDraftName(selectedFormation.name)
            }
          }}
        />
      </div>
      <div className="sf-row">
        <span>Depth (MD)</span>
        <input
          type="number"
          step="0.1"
          value={draftDepthMd}
          onChange={(e) => setDraftDepthMd(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
          onBlur={() => {
            const parsed = Number(draftDepthMd)
            if (draftDepthMd !== '' && !isNaN(parsed)) {
              if (wellTdMd !== null && (parsed < 0 || parsed > wellTdMd)) {
                addQcWarnings([
                  `Top depth ${parsed.toFixed(1)} m is outside well interval 0.0-${wellTdMd.toFixed(1)} m; change was ignored.`,
                ])
                setDraftDepthMd(selectedFormation.depth_md != null ? String(selectedFormation.depth_md) : '')
                return
              }
              onFormationMove(selectedFormation.id, parsed)
            } else {
              setDraftDepthMd(selectedFormation.depth_md != null ? String(selectedFormation.depth_md) : '')
            }
          }}
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
          value={formationDisplayColor(selectedFormation)}
          onChange={(event) => void onFormationUpdate(selectedFormation.id, {
            color: event.target.value,
            color_source: 'user',
          })}
        />
        {selectedFormation.color_source === 'user' && (
          <button
            className="sf-btn-inline"
            title="Reset to horizon color"
            onClick={() => void onFormationUpdate(selectedFormation.id, { reset_color: true })}
          >
            Reset
          </button>
        )}
      </div>
      <div className="sf-row">
        <span>{isUnconformity ? 'Top age (Ma)' : 'Age (Ma)'}</span>
        <input
          type="number"
          step="0.01"
          min={minAgeMa}
          max={maxAgeMa}
          value={draftAgeMa}
          onChange={(e) => setDraftAgeMa(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
          onBlur={() => {
            const parsed = Number(draftAgeMa)
            if (draftAgeMa !== '' && !isNaN(parsed)) {
              void onFormationUpdate(selectedFormation.id, { age_ma: parsed })
            } else {
              setDraftAgeMa(selectedFormation.age_ma != null ? String(selectedFormation.age_ma) : '')
            }
          }}
        />
      </div>
      {isUnconformity && (
        <div className="sf-row">
          <span>Hiatus duration (Ma)</span>
          <input
            type="number"
            step="0.01"
            value={draftHiatus}
            onChange={(e) => setDraftHiatus(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
            onBlur={() => {
              const parsed = Number(draftHiatus)
              if (draftHiatus !== '' && !isNaN(parsed)) {
                void onFormationUpdate(selectedFormation.id, { hiatus_duration_ma: parsed })
              } else {
                setDraftHiatus(String(selectedFormation.hiatus_duration_ma))
              }
            }}
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
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
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
          value={draftWaterDepth}
          onChange={(e) => setDraftWaterDepth(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
          onBlur={() => {
            const parsed = Number(draftWaterDepth)
            if (draftWaterDepth !== '' && !isNaN(parsed)) {
              void onFormationUpdate(selectedFormation.id, { water_depth_m: parsed })
            } else {
              setDraftWaterDepth(String(selectedFormation.water_depth_m))
            }
          }}
        />
      </div>
      {isUnconformity && (
        <div className="sf-row">
          <span>Eroded thickness (m)</span>
          <input
            type="number"
            min="0"
            step="1"
            value={draftErodedThickness}
            onChange={(e) => setDraftErodedThickness(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
            onBlur={() => {
              const parsed = Number(draftErodedThickness)
              if (draftErodedThickness !== '' && !isNaN(parsed)) {
                void onFormationUpdate(selectedFormation.id, { eroded_thickness_m: parsed })
              } else {
                setDraftErodedThickness(String(selectedFormation.eroded_thickness_m))
              }
            }}
          />
        </div>
      )}
      <div className="tree-leaf">
        <span>Linked unit</span>
        <span>{selectedFormation.horizon_name ?? '—'}</span>
      </div>
    </div>
  )
}
