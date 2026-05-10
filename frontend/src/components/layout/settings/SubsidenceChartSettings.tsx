import { useEffect, useState } from 'react'

import { useComputedStore, useViewStore } from '@/stores'
import { useMultiWellStore } from '@/stores/multiWellStore'
import { useWellDataStore } from '@/stores/wellDataStore'
import { applyChartCutoff, curveAgeExtent, curveDepthExtent, paddedDepthExtent } from '@/utils/subsidenceChartDomain'

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

export function SubsidenceChartSettings({ chartType }: SubsidenceChartSettingsProps) {
  const single = chartType === 'single'

  const singleCurves = useComputedStore((s) => s.subsidenceCurves)
  const multiResults = useMultiWellStore((s) => s.wellResults)
  const currentWellId = useWellDataStore((s) => s.well?.well_id ?? null)
  const formations = useWellDataStore((s) => s.formations)
  const wellInventories = useWellDataStore((s) => s.wellInventories)
  const topSets = useWellDataStore((s) => s.topSets)
  const depthMin = useViewStore((s) => single ? s.subsidenceSingleDepthMin : s.subsidenceMultiDepthMin)
  const depthMax = useViewStore((s) => single ? s.subsidenceSingleDepthMax : s.subsidenceMultiDepthMax)
  const ageMin = useViewStore((s) => single ? s.subsidenceSingleAgeMin : s.subsidenceMultiAgeMin)
  const ageMax = useViewStore((s) => single ? s.subsidenceSingleAgeMax : s.subsidenceMultiAgeMax)
  const compareByMarkerByWellId = useViewStore((s) => s.subsidenceCompareByMarkerByWellId)
  const compareMarkerHorizonIdByWellId = useViewStore((s) => s.subsidenceCompareMarkerHorizonIdByWellId)
  const setDepthMin = useViewStore((s) => single ? s.setSubsidenceSingleDepthMin : s.setSubsidenceMultiDepthMin)
  const setDepthMax = useViewStore((s) => single ? s.setSubsidenceSingleDepthMax : s.setSubsidenceMultiDepthMax)
  const setAgeMin = useViewStore((s) => single ? s.setSubsidenceSingleAgeMin : s.setSubsidenceMultiAgeMin)
  const setAgeMax = useViewStore((s) => single ? s.setSubsidenceSingleAgeMax : s.setSubsidenceMultiAgeMax)

  const horizonById = new Map(topSets.flatMap((topSet) => topSet.horizons ?? []).map((horizon) => [horizon.id, horizon]))
  const inventoryByWellId = new Map(wellInventories.map((well) => [well.well_id, well]))
  const singleHorizonId = currentWellId ? compareMarkerHorizonIdByWellId[currentWellId] : null
  const singleHorizon = singleHorizonId !== null && singleHorizonId !== undefined ? horizonById.get(singleHorizonId) : undefined
  const singlePick = singleHorizonId !== null && singleHorizonId !== undefined
    ? formations.find((formation) => formation.horizon_id === singleHorizonId)
    : undefined

  const curves = single
    ? applyChartCutoff(
      singleCurves,
      currentWellId && compareByMarkerByWellId[currentWellId] && singleHorizonId !== null && singleHorizonId !== undefined
        ? {
          maxAgeMa: singleHorizon?.age_ma ?? undefined,
          maxDepthM: singlePick?.depth_md ?? undefined,
        }
        : null,
    )
    : multiResults.flatMap((result) => {
      if (!compareByMarkerByWellId[result.wellId]) return result.curves
      const horizonId = compareMarkerHorizonIdByWellId[result.wellId]
      if (horizonId === null || horizonId === undefined) return result.curves
      const horizon = horizonById.get(horizonId)
      const pick = inventoryByWellId.get(result.wellId)?.formations.find((formation) => formation.horizon_id === horizonId)
      const maxAgeMa = horizon?.age_ma ?? undefined
      const maxDepthM = pick?.depth_md ?? undefined
      if (maxAgeMa === undefined && maxDepthM === undefined) return result.curves
      return applyChartCutoff(result.curves, { maxAgeMa, maxDepthM })
    })
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
