import { useEffect, useMemo, useState } from 'react'

import { useViewStore } from '@/stores'
import type { StratChartInfo, StratUnitOption } from '@/types'

const DEFAULT_UPPER_RANK = 'erathem'
const DEFAULT_LOWER_RANK = 'system'

async function fetchStratUnits(chartId: number): Promise<StratUnitOption[]> {
  const params = new URLSearchParams({ chart_id: String(chartId), limit: '1000' })
  const response = await fetch(`/api/strat-units?${params.toString()}`)
  if (!response.ok) {
    throw new Error(`Failed to load strat units (${response.status})`)
  }
  return (await response.json()) as StratUnitOption[]
}

function rankSortKey(rank: string, units: StratUnitOption[]): number {
  const matching = units.filter((unit) => unit.rank === rank)
  const minAge = Math.min(...matching.map((unit) => unit.age_top_ma ?? unit.age_base_ma ?? Number.POSITIVE_INFINITY))
  return Number.isFinite(minAge) ? minAge : Number.POSITIVE_INFINITY
}

export function StratChartSettings({ selectedChart }: { selectedChart: StratChartInfo }) {
  const upperRank = useViewStore((state) => state.stratTimescaleUpperRank)
  const lowerRank = useViewStore((state) => state.stratTimescaleLowerRank)
  const labelMode = useViewStore((state) => state.stratTimescaleLabelMode)
  const setUpperRank = useViewStore((state) => state.setStratTimescaleUpperRank)
  const setLowerRank = useViewStore((state) => state.setStratTimescaleLowerRank)
  const setLabelMode = useViewStore((state) => state.setStratTimescaleLabelMode)

  const [units, setUnits] = useState<StratUnitOption[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    void fetchStratUnits(selectedChart.id)
      .then((rows) => {
        if (!cancelled) setUnits(rows)
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setUnits([])
          setError(cause instanceof Error ? cause.message : 'Failed to load strat units')
        }
      })

    return () => { cancelled = true }
  }, [selectedChart.id])

  const ranks = useMemo(() => {
    const values = Array.from(new Set(units.map((unit) => unit.rank).filter((rank): rank is string => Boolean(rank))))
    return values.sort((a, b) => {
      const ageDelta = rankSortKey(a, units) - rankSortKey(b, units)
      if (ageDelta !== 0) return ageDelta
      return a.localeCompare(b)
    })
  }, [units])

  const controlsDisabled = !selectedChart.is_active || ranks.length === 0

  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Chart</div>
        <div className="template-panel__value">{selectedChart.name}</div>
      </div>

      <div className="template-panel__group">
        <div className="template-panel__label">Timescale display</div>
        {error ? <div className="template-panel__hint">{error}</div> : null}
        {!selectedChart.is_active ? <div className="template-panel__hint">Timescale settings apply to the active StratChart.</div> : null}
      </div>

      <label className="sf-row">
        <span>Upper level</span>
        <button
          type="button"
          disabled={controlsDisabled || upperRank === DEFAULT_UPPER_RANK}
          onClick={() => setUpperRank(DEFAULT_UPPER_RANK)}
        >
          Reset
        </button>
        <select
          value={upperRank ?? ''}
          disabled={controlsDisabled}
          onChange={(event) => setUpperRank(event.target.value || null)}
        >
          <option value="">Auto</option>
          {ranks.map((rank) => <option key={rank} value={rank}>{rank}</option>)}
        </select>
      </label>

      <label className="sf-row">
        <span>Lower level</span>
        <button
          type="button"
          disabled={controlsDisabled || lowerRank === DEFAULT_LOWER_RANK}
          onClick={() => setLowerRank(DEFAULT_LOWER_RANK)}
        >
          Reset
        </button>
        <select
          value={lowerRank ?? ''}
          disabled={controlsDisabled}
          onChange={(event) => setLowerRank(event.target.value || null)}
        >
          <option value="">Auto</option>
          {ranks.map((rank) => <option key={rank} value={rank}>{rank}</option>)}
        </select>
      </label>

      <label className="sf-row">
        <span>Labels</span>
        <select
          value={labelMode}
          disabled={controlsDisabled}
          onChange={(event) => setLabelMode(event.target.value as typeof labelMode)}
        >
          <option value="auto">Auto</option>
          <option value="unit-name">Unit name</option>
          <option value="unit-code">Unit code</option>
        </select>
      </label>
    </div>
  )
}
