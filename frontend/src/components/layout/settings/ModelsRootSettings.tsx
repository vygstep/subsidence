import { useEffect, useState } from 'react'

import { useViewStore, useWellDataStore } from '@/stores'
import type { TopSetSummary } from '@/types'

export function ModelsRootSettings() {
  const wellInventories = useWellDataStore((s) => s.wellInventories)
  const seaLevelCurves = useWellDataStore((s) => s.seaLevelCurves)
  const setWellActiveTopSet = useWellDataStore((s) => s.setWellActiveTopSet)
  const setWellActiveSeaLevelCurve = useWellDataStore((s) => s.setWellActiveSeaLevelCurve)
  const compareByMarkerByWellId = useViewStore((s) => s.subsidenceCompareByMarkerByWellId)
  const compareMarkerHorizonIdByWellId = useViewStore((s) => s.subsidenceCompareMarkerHorizonIdByWellId)
  const setCompareByMarkerForWell = useViewStore((s) => s.setSubsidenceCompareByMarkerForWell)
  const setCompareMarkerForWell = useViewStore((s) => s.setSubsidenceCompareMarkerForWell)

  const [selectedWellId, setSelectedWellId] = useState<string>('')
  const [topSets, setTopSets] = useState<TopSetSummary[]>([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (wellInventories.length > 0 && !selectedWellId) {
      setSelectedWellId(wellInventories[0].well_id)
    }
  }, [wellInventories, selectedWellId])

  useEffect(() => {
    void fetch('/api/top-sets')
      .then((r) => r.ok ? r.json() as Promise<TopSetSummary[]> : [])
      .then((data) => setTopSets(data))
  }, [])

  const selectedInventory = wellInventories.find((w) => w.well_id === selectedWellId) ?? null
  const selectedTopSet = topSets.find((ts) => ts.id === selectedInventory?.active_top_set_id) ?? null
  const selectedHorizons = [...(selectedTopSet?.horizons ?? [])].sort((a, b) => {
    const ageA = a.age_ma ?? -Infinity
    const ageB = b.age_ma ?? -Infinity
    if (ageA !== ageB) return ageA - ageB
    return a.sort_order - b.sort_order
  })
  const compareByMarker = selectedWellId ? compareByMarkerByWellId[selectedWellId] ?? false : false
  const compareMarkerId = selectedWellId ? compareMarkerHorizonIdByWellId[selectedWellId] ?? null : null
  const oldestMarker = selectedHorizons.reduce<typeof selectedHorizons[number] | null>((best, horizon) => {
    if (best === null) return horizon
    const bestAge = best.age_ma ?? -Infinity
    const horizonAge = horizon.age_ma ?? -Infinity
    if (horizonAge !== bestAge) return horizonAge > bestAge ? horizon : best
    return horizon.sort_order > best.sort_order ? horizon : best
  }, null)

  async function handleTopSetChange(value: string) {
    if (!selectedWellId || !value) return
    setIsSaving(true)
    try {
      await setWellActiveTopSet(selectedWellId, Number(value))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSeaLevelChange(value: string) {
    if (!selectedWellId) return
    const curveId = value === '' ? null : Number(value)
    setIsSaving(true)
    try {
      await setWellActiveSeaLevelCurve(selectedWellId, curveId)
    } finally {
      setIsSaving(false)
    }
  }

  function handleCompareByMarkerChange(enabled: boolean) {
    if (!selectedWellId) return
    setCompareByMarkerForWell(selectedWellId, enabled)
    if (enabled && compareMarkerId === null && oldestMarker !== null) {
      setCompareMarkerForWell(selectedWellId, oldestMarker.id)
    }
  }

  function handleMarkerChange(value: string) {
    if (!selectedWellId) return
    setCompareMarkerForWell(selectedWellId, value === '' ? null : Number(value))
  }

  function handleMarkerReset() {
    if (!selectedWellId || oldestMarker === null) return
    setCompareByMarkerForWell(selectedWellId, true)
    setCompareMarkerForWell(selectedWellId, oldestMarker.id)
  }

  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Object</div>
        <div className="template-panel__value">MODELS</div>
      </div>

      {wellInventories.length === 0 ? (
        <p className="sidebar-panel__empty">No wells loaded.</p>
      ) : (
        <>
          <div className="sf-row">
            <span>Well</span>
            <select
              value={selectedWellId}
              onChange={(e) => setSelectedWellId(e.target.value)}
            >
              {wellInventories.map((w) => (
                <option key={w.well_id} value={w.well_id}>{w.well_name}</option>
              ))}
            </select>
          </div>

          <div className="sf-row">
            <span>Active TopSet</span>
            <select
              value={selectedInventory?.active_top_set_id ?? ''}
              onChange={(e) => void handleTopSetChange(e.target.value)}
              disabled={isSaving || topSets.length === 0}
            >
              <option value="">— none —</option>
              {topSets.map((ts) => (
                <option key={ts.id} value={ts.id}>{ts.name}</option>
              ))}
            </select>
          </div>

          <div className="sf-row">
            <span>Sea level curve</span>
            <select
              value={selectedInventory?.active_sea_level_curve_id ?? ''}
              onChange={(e) => void handleSeaLevelChange(e.target.value)}
              disabled={isSaving}
            >
              <option value="">None</option>
              {seaLevelCurves.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <label className="sf-row">
            <span>Compare by marker</span>
            <input
              type="checkbox"
              checked={compareByMarker}
              disabled={!selectedWellId || selectedHorizons.length === 0}
              onChange={(e) => handleCompareByMarkerChange(e.target.checked)}
            />
          </label>

          <div className="sf-row">
            <span>Marker</span>
            <select
              value={compareMarkerId ?? ''}
              disabled={!compareByMarker || selectedHorizons.length === 0}
              onChange={(e) => handleMarkerChange(e.target.value)}
            >
              <option value="">None</option>
              {selectedHorizons.map((horizon) => (
                <option key={horizon.id} value={horizon.id}>
                  {horizon.name}{horizon.age_ma !== null ? ` (${horizon.age_ma} Ma)` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="sf-row">
            <span>Marker cutoff</span>
            <button
              type="button"
              disabled={!selectedWellId || oldestMarker === null}
              onClick={handleMarkerReset}
            >
              Reset
            </button>
          </div>
        </>
      )}
    </div>
  )
}
