import { useEffect, useMemo, useState } from 'react'

import { useViewStore, useWellDataStore } from '@/stores'
import type { StratUnitOption, TopSetSummary } from '@/types'
import { buildStratTimescaleRows } from '@/utils/stratTimescale'

async function fetchStratUnits(chartId: number): Promise<StratUnitOption[]> {
  const params = new URLSearchParams({ chart_id: String(chartId), limit: '1000' })
  const response = await fetch(`/api/strat-units?${params.toString()}`)
  if (!response.ok) {
    throw new Error(`Failed to load strat units (${response.status})`)
  }
  return (await response.json()) as StratUnitOption[]
}

function formatUnitAge(unit: StratUnitOption): string {
  const top = unit.age_top_ma
  const base = unit.age_base_ma
  if (top !== null && top !== undefined && base !== null && base !== undefined) {
    return `${top}-${base} Ma`
  }
  if (top !== null && top !== undefined) return `${top} Ma`
  if (base !== null && base !== undefined) return `${base} Ma`
  return 'age unset'
}

export function ModelsRootSettings() {
  const wellInventories = useWellDataStore((s) => s.wellInventories)
  const formations = useWellDataStore((s) => s.formations)
  const seaLevelCurves = useWellDataStore((s) => s.seaLevelCurves)
  const stratCharts = useWellDataStore((s) => s.stratCharts)
  const setWellActiveTopSet = useWellDataStore((s) => s.setWellActiveTopSet)
  const setWellActiveSeaLevelCurve = useWellDataStore((s) => s.setWellActiveSeaLevelCurve)
  const reconstructStratUnitId = useViewStore((s) => s.subsidenceReconstructStratUnitId)
  const truncateBelowStratUnitId = useViewStore((s) => s.subsidenceTruncateBelowStratUnitId)
  const lowerRank = useViewStore((s) => s.stratTimescaleLowerRank)
  const setReconstructStratUnitId = useViewStore((s) => s.setSubsidenceReconstructStratUnitId)
  const setTruncateBelowStratUnitId = useViewStore((s) => s.setSubsidenceTruncateBelowStratUnitId)

  const [selectedWellId, setSelectedWellId] = useState<string>('')
  const [topSets, setTopSets] = useState<TopSetSummary[]>([])
  const [stratUnits, setStratUnits] = useState<StratUnitOption[]>([])
  const [showAllCutoffUnits, setShowAllCutoffUnits] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [stratUnitError, setStratUnitError] = useState<string | null>(null)

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

  const activeChart = stratCharts.find((chart) => chart.is_active) ?? null

  useEffect(() => {
    if (activeChart === null) {
      setStratUnits([])
      setStratUnitError(null)
      return
    }

    let cancelled = false
    setStratUnitError(null)
    void fetchStratUnits(activeChart.id)
      .then((rows) => {
        if (!cancelled) {
          setStratUnits([...rows].sort((a, b) => {
            const ageA = a.age_top_ma ?? a.age_base_ma ?? Infinity
            const ageB = b.age_top_ma ?? b.age_base_ma ?? Infinity
            if (ageA !== ageB) return ageA - ageB
            return a.name.localeCompare(b.name)
          }))
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setStratUnits([])
          setStratUnitError(cause instanceof Error ? cause.message : 'Failed to load strat units')
        }
      })

    return () => { cancelled = true }
  }, [activeChart])

  const selectedInventory = wellInventories.find((w) => w.well_id === selectedWellId) ?? null
  const modelAgeRange = useMemo(() => {
    const ages = [
      ...wellInventories.flatMap((well) => well.zones.flatMap((zone) => [
        zone.upper_horizon.age_ma,
        zone.lower_horizon.age_ma,
      ])),
      ...formations.flatMap((formation) => [formation.age_ma, formation.age_base_ma]),
    ].filter((age): age is number => Number.isFinite(age))
    if (ages.length === 0) return null
    return { minMa: Math.min(...ages), maxMa: Math.max(...ages) }
  }, [formations, wellInventories])
  const modelStratUnits = useMemo(() => {
    if (modelAgeRange === null) return stratUnits
    return stratUnits.filter((unit) => {
      const top = unit.age_top_ma
      const base = unit.age_base_ma
      if (!Number.isFinite(top) || !Number.isFinite(base)) return false
      return Math.max(top ?? 0, modelAgeRange.minMa) < Math.min(base ?? 0, modelAgeRange.maxMa)
    })
  }, [modelAgeRange, stratUnits])
  const visibleCutoffStratUnits = useMemo(() => {
    const ages = modelStratUnits.flatMap((unit) => [unit.age_top_ma, unit.age_base_ma])
      .filter((age): age is number => Number.isFinite(age))
    if (ages.length === 0) return []
    const rows = buildStratTimescaleRows({
      units: modelStratUnits,
      minMa: Math.min(...ages),
      maxMa: Math.max(...ages),
      upperRank: null,
      lowerRank,
    })
    const secondRowIds = new Set(
      (rows[1]?.units ?? [])
        .map((unit) => Number(String(unit.id).replace(/^fallback-/, '')))
        .filter((id) => Number.isFinite(id)),
    )
    return modelStratUnits.filter((unit) => secondRowIds.has(unit.id))
  }, [lowerRank, modelStratUnits])
  const cutoffStratUnits = showAllCutoffUnits ? stratUnits : visibleCutoffStratUnits
  const stratUnitControlsDisabled = activeChart === null || cutoffStratUnits.length === 0

  useEffect(() => {
    const visibleIds = new Set(cutoffStratUnits.map((unit) => unit.id))
    if (reconstructStratUnitId !== null && !visibleIds.has(reconstructStratUnitId)) {
      setReconstructStratUnitId(null)
    }
    if (truncateBelowStratUnitId !== null && !visibleIds.has(truncateBelowStratUnitId)) {
      setTruncateBelowStratUnitId(null)
    }
  }, [cutoffStratUnits, reconstructStratUnitId, setReconstructStratUnitId, setTruncateBelowStratUnitId, truncateBelowStratUnitId])

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

      <div className="sf-row">
        <span>Reconstruct to strat unit</span>
        <button
          type="button"
          disabled={reconstructStratUnitId === null}
          onClick={() => setReconstructStratUnitId(null)}
        >
          Reset
        </button>
        <select
          value={reconstructStratUnitId ?? ''}
          disabled={stratUnitControlsDisabled}
          onChange={(event) => {
            if (event.target.value === '__show_all__') {
              setShowAllCutoffUnits(true)
              return
            }
            if (event.target.value === '__show_visible__') {
              setShowAllCutoffUnits(false)
              return
            }
            setReconstructStratUnitId(event.target.value === '' ? null : Number(event.target.value))
          }}
        >
          <option value="">None</option>
          {cutoffStratUnits.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name} ({formatUnitAge(unit)})
            </option>
          ))}
          {showAllCutoffUnits
            ? <option value="__show_visible__">Show visible</option>
            : <option value="__show_all__">Show all</option>}
        </select>
      </div>

      <div className="sf-row">
        <span>Truncate below strat unit</span>
        <button
          type="button"
          disabled={truncateBelowStratUnitId === null}
          onClick={() => setTruncateBelowStratUnitId(null)}
        >
          Reset
        </button>
        <select
          value={truncateBelowStratUnitId ?? ''}
          disabled={stratUnitControlsDisabled}
          onChange={(event) => {
            if (event.target.value === '__show_all__') {
              setShowAllCutoffUnits(true)
              return
            }
            if (event.target.value === '__show_visible__') {
              setShowAllCutoffUnits(false)
              return
            }
            setTruncateBelowStratUnitId(event.target.value === '' ? null : Number(event.target.value))
          }}
        >
          <option value="">None</option>
          {cutoffStratUnits.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name} ({formatUnitAge(unit)})
            </option>
          ))}
          {showAllCutoffUnits
            ? <option value="__show_visible__">Show visible</option>
            : <option value="__show_all__">Show all</option>}
        </select>
      </div>

      {stratUnitError ? <p className="sidebar-panel__empty">{stratUnitError}</p> : null}

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
