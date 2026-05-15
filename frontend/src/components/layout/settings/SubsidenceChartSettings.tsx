import { useEffect, useState } from 'react'

import { useComputedStore, useViewStore } from '@/stores'
import { useMultiWellStore } from '@/stores/multiWellStore'
import { useWellDataStore } from '@/stores/wellDataStore'
import type { StratUnitOption } from '@/types'
import { applyGlobalStratCutoffs, curveAgeExtent, curveDepthExtent, paddedDepthExtent } from '@/utils/subsidenceChartDomain'

interface SubsidenceChartSettingsProps {
  chartType: 'single' | 'multi'
}

interface CommitNumberInputProps {
  value: number | null
  placeholder: string
  step: string
  min: string
  onCommit: (value: number | null) => void
}

function numberToDraft(value: number | null): string {
  return value === null ? '' : String(value)
}

function CommitNumberInput({ value, placeholder, step, min, onCommit }: CommitNumberInputProps) {
  const [draft, setDraft] = useState(numberToDraft(value))

  useEffect(() => {
    setDraft(numberToDraft(value))
  }, [value])

  function commit(): void {
    if (draft.trim() === '') {
      onCommit(null)
      return
    }
    const parsed = Number(draft)
    if (Number.isFinite(parsed)) {
      onCommit(parsed)
    } else {
      setDraft(numberToDraft(value))
    }
  }

  return (
    <input
      type="number"
      step={step}
      min={min}
      placeholder={placeholder}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          commit()
          event.currentTarget.blur()
        } else if (event.key === 'Escape') {
          setDraft(numberToDraft(value))
          event.currentTarget.blur()
        }
      }}
      onBlur={() => setDraft(numberToDraft(value))}
    />
  )
}

function reconstructAgeForUnit(unit: StratUnitOption | null): number | null {
  if (unit === null) return null
  return unit.age_base_ma ?? unit.age_top_ma ?? null
}

function truncateAgeForUnit(unit: StratUnitOption | null): number | null {
  if (unit === null) return null
  return unit.age_top_ma ?? unit.age_base_ma ?? null
}

export function SubsidenceChartSettings({ chartType }: SubsidenceChartSettingsProps) {
  const single = chartType === 'single'

  const singleCurves = useComputedStore((s) => s.subsidenceCurves)
  const multiResults = useMultiWellStore((s) => s.wellResults)
  const stratCharts = useWellDataStore((s) => s.stratCharts)
  const depthMin = useViewStore((s) => single ? s.subsidenceSingleDepthMin : s.subsidenceMultiDepthMin)
  const depthMax = useViewStore((s) => single ? s.subsidenceSingleDepthMax : s.subsidenceMultiDepthMax)
  const ageMin = useViewStore((s) => single ? s.subsidenceSingleAgeMin : s.subsidenceMultiAgeMin)
  const ageMax = useViewStore((s) => single ? s.subsidenceSingleAgeMax : s.subsidenceMultiAgeMax)
  const reconstructStratUnitId = useViewStore((s) => s.subsidenceReconstructStratUnitId)
  const truncateBelowStratUnitId = useViewStore((s) => s.subsidenceTruncateBelowStratUnitId)
  const setDepthMin = useViewStore((s) => single ? s.setSubsidenceSingleDepthMin : s.setSubsidenceMultiDepthMin)
  const setDepthMax = useViewStore((s) => single ? s.setSubsidenceSingleDepthMax : s.setSubsidenceMultiDepthMax)
  const setAgeMin = useViewStore((s) => single ? s.setSubsidenceSingleAgeMin : s.setSubsidenceMultiAgeMin)
  const setAgeMax = useViewStore((s) => single ? s.setSubsidenceSingleAgeMax : s.setSubsidenceMultiAgeMax)

  const [stratUnits, setStratUnits] = useState<StratUnitOption[]>([])
  const activeStratChartId = stratCharts.find((chart) => chart.is_active)?.id ?? null

  useEffect(() => {
    if (activeStratChartId === null) {
      setStratUnits([])
      return
    }
    let cancelled = false
    const params = new URLSearchParams({ chart_id: String(activeStratChartId), limit: '1000' })
    void fetch(`/api/strat-units?${params.toString()}`)
      .then((response) => response.ok ? response.json() as Promise<StratUnitOption[]> : [])
      .then((rows) => {
        if (!cancelled) setStratUnits(rows)
      })
      .catch(() => {
        if (!cancelled) setStratUnits([])
      })
    return () => { cancelled = true }
  }, [activeStratChartId])

  const stratUnitById = new Map(stratUnits.map((unit) => [unit.id, unit]))
  const reconstructAgeMa = reconstructAgeForUnit(
    reconstructStratUnitId !== null ? stratUnitById.get(reconstructStratUnitId) ?? null : null,
  )
  const truncateBelowAgeMa = truncateAgeForUnit(
    truncateBelowStratUnitId !== null ? stratUnitById.get(truncateBelowStratUnitId) ?? null : null,
  )

  const curves = single
    ? applyGlobalStratCutoffs(singleCurves, { reconstructAgeMa, truncateBelowAgeMa })
    : multiResults.flatMap((result) => applyGlobalStratCutoffs(result.curves, { reconstructAgeMa, truncateBelowAgeMa }))
  const autoDepth = paddedDepthExtent(curveDepthExtent(curves))
  const autoAge = curveAgeExtent(curves) ?? { min: 0, max: 100 }
  const depthMinPlaceholder = Number.isFinite(autoDepth.min) ? autoDepth.min.toFixed(0) : 'auto'
  const depthMaxPlaceholder = Number.isFinite(autoDepth.max) ? autoDepth.max.toFixed(0) : 'auto'
  const ageMinPlaceholder = Number.isFinite(autoAge.min) ? autoAge.min.toFixed(1) : 'auto'
  const ageMaxPlaceholder = Number.isFinite(autoAge.max) ? autoAge.max.toFixed(1) : 'auto'

  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Object</div>
        <div className="template-panel__value">
          {single ? 'Single-well chart' : 'Multi-well comparison chart'}
        </div>
      </div>
      <div className="sf-row">
        <span>Depth min (m)</span>
        <CommitNumberInput
          step="100"
          min="0"
          placeholder={depthMinPlaceholder}
          value={depthMin}
          onCommit={setDepthMin}
        />
      </div>
      <div className="sf-row">
        <span>Depth max (m)</span>
        <CommitNumberInput
          step="100"
          min="0"
          placeholder={depthMaxPlaceholder}
          value={depthMax}
          onCommit={setDepthMax}
        />
      </div>
      <div className="sf-row">
        <span>Depth range</span>
        <button type="button" onClick={() => { setDepthMin(null); setDepthMax(null) }}>Auto</button>
      </div>
      <div className="sf-row">
        <span>Age min (Ma)</span>
        <CommitNumberInput
          step="10"
          min="0"
          placeholder={ageMinPlaceholder}
          value={ageMin}
          onCommit={setAgeMin}
        />
      </div>
      <div className="sf-row">
        <span>Age max (Ma)</span>
        <CommitNumberInput
          step="10"
          min="0"
          placeholder={ageMaxPlaceholder}
          value={ageMax}
          onCommit={setAgeMax}
        />
      </div>
      <div className="sf-row">
        <span>Age range</span>
        <button type="button" onClick={() => { setAgeMin(null); setAgeMax(null) }}>Auto</button>
      </div>
    </div>
  )
}
