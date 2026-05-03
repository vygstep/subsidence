import { useEffect, useState } from 'react'

import { useWellDataStore } from '@/stores'

interface TopSetSummary {
  id: number
  name: string
  horizon_count: number
}

export function ModelsRootSettings() {
  const wellInventories = useWellDataStore((s) => s.wellInventories)
  const seaLevelCurves = useWellDataStore((s) => s.seaLevelCurves)
  const setWellActiveTopSet = useWellDataStore((s) => s.setWellActiveTopSet)
  const setWellActiveSeaLevelCurve = useWellDataStore((s) => s.setWellActiveSeaLevelCurve)

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
        </>
      )}
    </div>
  )
}
