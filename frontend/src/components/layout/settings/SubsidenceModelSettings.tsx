import { useMemo, useState } from 'react'

import { useComputedStore, useViewStore, useWellDataStore } from '@/stores'
import type { SubsidenceModelType } from '@/stores/viewStore'

const MODEL_LABELS: Record<SubsidenceModelType, string> = {
  total: 'Total burial / total subsidence',
  decompaction: 'Decompaction',
  airy: 'Airy backstripping',
  stepwise: 'Stepwise backstripping through time',
  thermal: 'Thermal subsidence fitting',
}

interface SubsidenceModelSettingsProps {
  modelType: SubsidenceModelType
}

export function SubsidenceModelSettings({ modelType }: SubsidenceModelSettingsProps) {
  const config = useViewStore((s) => s.subsidenceModelConfigs[modelType])
  const updateConfig = useViewStore((s) => s.updateSubsidenceModelConfig)
  const seaLevelCurves = useWellDataStore((s) => s.seaLevelCurves)
  const wellInventories = useWellDataStore((s) => s.wellInventories)
  const activeWellId = useWellDataStore((s) => s.well?.well_id ?? null)
  const setWellActiveSeaLevelCurve = useWellDataStore((s) => s.setWellActiveSeaLevelCurve)
  const showFormationFills = useComputedStore((s) => s.showFormationFills)
  const showBurialCurves = useComputedStore((s) => s.showBurialCurves)
  const setShowFormationFills = useComputedStore((s) => s.setShowFormationFills)
  const setShowBurialCurves = useComputedStore((s) => s.setShowBurialCurves)
  const [isSavingSeaLevel, setIsSavingSeaLevel] = useState(false)

  const zoneSets = useMemo(() => {
    const byId = new Map<number, { id: number; name: string }>()
    for (const w of wellInventories) {
      if (w.active_top_set_id !== null && !byId.has(w.active_top_set_id)) {
        byId.set(w.active_top_set_id, {
          id: w.active_top_set_id,
          name: w.active_top_set_name ?? `ZoneSet ${w.active_top_set_id}`,
        })
      }
    }
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [wellInventories])

  const isAvailable = modelType === 'total'
  const activeCurveId = activeWellId === null
    ? null
    : wellInventories.find((well) => well.well_id === activeWellId)?.active_sea_level_curve_id ?? null

  async function handleSeaLevelChange(value: string) {
    if (activeWellId === null) return
    const curveId = value === '' ? null : Number(value)
    setIsSavingSeaLevel(true)
    try {
      await setWellActiveSeaLevelCurve(activeWellId, curveId)
    } finally {
      setIsSavingSeaLevel(false)
    }
  }

  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Model</div>
        <div className="template-panel__value">{MODEL_LABELS[modelType]}</div>
      </div>

      {!isAvailable && (
        <p className="sidebar-panel__empty">This model is not yet implemented.</p>
      )}

      <div className="sf-row">
        <span>ZoneSet</span>
        <select
          value={config.zoneSetId ?? ''}
          onChange={(e) => updateConfig(modelType, { zoneSetId: e.target.value === '' ? null : Number(e.target.value) })}
          disabled={!isAvailable}
        >
          <option value="">— well default —</option>
          {zoneSets.map((zs) => (
            <option key={zs.id} value={zs.id}>{zs.name}</option>
          ))}
        </select>
      </div>

      {isAvailable && (
        <>
          <div className="template-panel__section-header">Sea level correction</div>
          <div className="sf-row">
            <span>Eustatic curve</span>
            <select
              value={activeCurveId ?? ''}
              onChange={(e) => void handleSeaLevelChange(e.target.value)}
              disabled={activeWellId === null || isSavingSeaLevel}
            >
              <option value="">None</option>
              {seaLevelCurves.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="template-panel__section-header">Display</div>
          <label className="sf-row">
            <span>Burial curves</span>
            <input
              type="checkbox"
              checked={showBurialCurves}
              onChange={(e) => setShowBurialCurves(e.target.checked)}
            />
          </label>
          <label className="sf-row">
            <span>Formation fills</span>
            <input
              type="checkbox"
              checked={showFormationFills}
              onChange={(e) => setShowFormationFills(e.target.checked)}
            />
          </label>
        </>
      )}
    </div>
  )
}
