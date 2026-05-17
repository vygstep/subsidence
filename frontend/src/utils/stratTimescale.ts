import type { StratUnitOption } from '@/types'

export interface TimescaleBlockUnit {
  id: string
  name: string
  label: string
  start_ma: number
  end_ma: number
  color: string
}

export interface TimescaleRowData {
  rank: string | null
  units: TimescaleBlockUnit[]
  isFallback: boolean
}

export type StratTimescaleUnitLabelMode = 'auto' | 'unit-name' | 'unit-code'

const DEFAULT_COLOR = '#e2e8f0'

const RANK_ORDER = [
  'super eon',
  'super-eon',
  'supereon',
  'super eonothem',
  'super-eonothem',
  'supereonothem',
  'eon',
  'eonothem',
  'era',
  'erathem',
  'period',
  'system',
  'subperiod',
  'sub-period',
  'subsystem',
  'sub-system',
  'epoch',
  'series',
  'subepoch',
  'sub-epoch',
  'subseries',
  'sub-series',
  'age',
  'stage',
]

const NORMALIZED_RANK_ORDER = new Map<string, number>(
  RANK_ORDER.map((rank, index) => [normalizeRank(rank), index]),
)

function normalizeRank(rank: string | null | undefined): string {
  return (rank ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
}

function rankOrder(rank: string | null | undefined): number {
  const normalized = normalizeRank(rank)
  return NORMALIZED_RANK_ORDER.get(normalized) ?? 1000
}

function rankLabel(rank: string): string {
  return rank.trim()
}

function ageTop(unit: StratUnitOption): number | null {
  return Number.isFinite(unit.age_top_ma) ? unit.age_top_ma ?? null : null
}

function ageBase(unit: StratUnitOption): number | null {
  return Number.isFinite(unit.age_base_ma) ? unit.age_base_ma ?? null : null
}

function unitOverlapsRange(unit: StratUnitOption, minMa: number, maxMa: number): boolean {
  const top = ageTop(unit)
  const base = ageBase(unit)
  if (top === null || base === null) return false
  return Math.max(top, minMa) < Math.min(base, maxMa)
}

function availableRanks(units: StratUnitOption[], minMa: number, maxMa: number): string[] {
  const ranks = new Map<string, string>()
  for (const unit of units) {
    if (!unit.rank || !unitOverlapsRange(unit, minMa, maxMa)) continue
    const key = normalizeRank(unit.rank)
    if (!ranks.has(key)) ranks.set(key, unit.rank)
  }
  return Array.from(ranks.values()).sort((a, b) => {
    const orderDelta = rankOrder(a) - rankOrder(b)
    if (orderDelta !== 0) return orderDelta
    return a.localeCompare(b)
  })
}

function resolveRank(
  requestedRank: string | null | undefined,
  ranks: string[],
  fallbackStartIndex: number,
): { rank: string | null; isFallback: boolean; index: number } {
  if (ranks.length === 0) return { rank: null, isFallback: false, index: -1 }

  if (!requestedRank) {
    const index = Math.min(Math.max(fallbackStartIndex, 0), ranks.length - 1)
    return { rank: ranks[index], isFallback: false, index }
  }

  const requestedKey = normalizeRank(requestedRank)
  const exactIndex = ranks.findIndex((rank) => normalizeRank(rank) === requestedKey)
  if (exactIndex !== -1) return { rank: ranks[exactIndex], isFallback: false, index: exactIndex }

  const requestedOrder = rankOrder(requestedRank)
  let bestIndex = -1
  let bestScore = Number.POSITIVE_INFINITY
  for (let i = 0; i < ranks.length; i++) {
    const order = rankOrder(ranks[i])
    const isCoarser = order < requestedOrder ? 0 : 1
    const score = isCoarser * 1000 + Math.abs(order - requestedOrder)
    if (score < bestScore) {
      bestScore = score
      bestIndex = i
    }
  }

  if (bestIndex === -1) return { rank: null, isFallback: false, index: -1 }
  return { rank: ranks[bestIndex], isFallback: true, index: bestIndex }
}

function unitLabel(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length <= 12) return trimmed
  return trimmed
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 6)
    .toUpperCase() || trimmed.slice(0, 6)
}

function unitDisplayLabel(unit: StratUnitOption, labelMode: StratTimescaleUnitLabelMode): string {
  const code = unit.unit_code?.trim()
  if (labelMode === 'unit-name') return unitLabel(unit.name)
  if (labelMode === 'unit-code') return code || unitLabel(unit.name)
  return code || unitLabel(unit.name)
}

function unitsForRank(
  units: StratUnitOption[],
  rank: string | null,
  labelMode: StratTimescaleUnitLabelMode,
): TimescaleBlockUnit[] {
  if (rank === null) return []
  const key = normalizeRank(rank)
  return units
    .filter((unit) => normalizeRank(unit.rank) === key)
    .flatMap((unit) => {
      const top = ageTop(unit)
      const base = ageBase(unit)
      if (top === null || base === null || top >= base) return []
      return [{
        id: String(unit.id),
        name: unit.name,
        label: unitDisplayLabel(unit, labelMode),
        start_ma: base,
        end_ma: top,
        color: unit.color_hex ?? DEFAULT_COLOR,
      }]
    })
    .sort((a, b) => a.end_ma - b.end_ma)
}

function blockOverlapsRange(unit: TimescaleBlockUnit, minMa: number, maxMa: number): boolean {
  return Math.max(unit.end_ma, minMa) < Math.min(unit.start_ma, maxMa)
}

function stratUnitOverlapsRange(unit: StratUnitOption, minMa: number, maxMa: number): boolean {
  const top = ageTop(unit)
  const base = ageBase(unit)
  if (top === null || base === null) return false
  return Math.max(top, minMa) < Math.min(base, maxMa)
}

function fallbackRankForInterval({
  units,
  intervalMinMa,
  intervalMaxMa,
  upperRank,
  requestedLowerRank,
}: {
  units: StratUnitOption[]
  intervalMinMa: number
  intervalMaxMa: number
  upperRank: string | null
  requestedLowerRank: string
}): string | null {
  const upperOrder = rankOrder(upperRank)
  const requestedOrder = rankOrder(requestedLowerRank)
  const intervalRanks = availableRanks(units, intervalMinMa, intervalMaxMa)
    .filter((rank) => {
      const order = rankOrder(rank)
      return order > upperOrder && order !== requestedOrder
    })

  let bestRank: string | null = null
  let bestScore = Number.POSITIVE_INFINITY
  for (const rank of intervalRanks) {
    const order = rankOrder(rank)
    const isCoarserThanRequested = order < requestedOrder ? 0 : 1
    const score = isCoarserThanRequested * 1000 + Math.abs(order - requestedOrder)
    if (score < bestScore) {
      bestScore = score
      bestRank = rank
    }
  }
  return bestRank
}

function fillSparseLowerIntervals({
  units,
  upperUnits,
  lowerUnits,
  upperRank,
  requestedLowerRank,
  labelMode,
}: {
  units: StratUnitOption[]
  upperUnits: TimescaleBlockUnit[]
  lowerUnits: TimescaleBlockUnit[]
  upperRank: string | null
  requestedLowerRank: string | null | undefined
  labelMode: StratTimescaleUnitLabelMode
}): { units: TimescaleBlockUnit[]; isFallback: boolean } {
  if (!requestedLowerRank || upperUnits.length === 0) {
    return { units: lowerUnits, isFallback: false }
  }

  const mixed = [...lowerUnits]
  let usedFallback = false
  for (const upperUnit of upperUnits) {
    const intervalMinMa = upperUnit.end_ma
    const intervalMaxMa = upperUnit.start_ma
    const hasSelectedLower = lowerUnits.some((unit) => blockOverlapsRange(unit, intervalMinMa, intervalMaxMa))
    if (hasSelectedLower) continue

    const fallbackRank = fallbackRankForInterval({
      units,
      intervalMinMa,
      intervalMaxMa,
      upperRank,
      requestedLowerRank,
    })
    if (fallbackRank === null) continue

    const fallbackUnits = units
      .filter((unit) => normalizeRank(unit.rank) === normalizeRank(fallbackRank))
      .filter((unit) => stratUnitOverlapsRange(unit, intervalMinMa, intervalMaxMa))
      .flatMap((unit) => {
        const top = ageTop(unit)
        const base = ageBase(unit)
        if (top === null || base === null || top >= base) return []
        return [{
          id: `fallback-${unit.id}`,
          name: unit.name,
          label: unitDisplayLabel(unit, labelMode),
          start_ma: base,
          end_ma: top,
          color: unit.color_hex ?? DEFAULT_COLOR,
        }]
      })
    if (fallbackUnits.length > 0) {
      mixed.push(...fallbackUnits)
      usedFallback = true
    }
  }

  return {
    units: mixed.sort((a, b) => a.end_ma - b.end_ma),
    isFallback: usedFallback,
  }
}

export function buildStratTimescaleRows({
  units,
  minMa,
  maxMa,
  upperRank,
  lowerRank,
  labelMode = 'auto',
}: {
  units: StratUnitOption[]
  minMa: number
  maxMa: number
  upperRank?: string | null
  lowerRank?: string | null
  labelMode?: StratTimescaleUnitLabelMode
}): TimescaleRowData[] {
  const ranks = availableRanks(units, minMa, maxMa)
  const upper = resolveRank(upperRank, ranks, 0)
  const lowerFallbackStart = upper.index >= 0 ? upper.index + 1 : 1
  const lower = resolveRank(lowerRank, ranks, lowerFallbackStart)
  const upperUnits = unitsForRank(units, upper.rank, labelMode)
  const lowerResult = fillSparseLowerIntervals({
    units,
    upperUnits,
    lowerUnits: unitsForRank(units, lower.rank, labelMode),
    upperRank: upper.rank,
    requestedLowerRank: lowerRank,
    labelMode,
  })
  const rows = [
    {
      rank: upper.rank,
      units: upperUnits,
      isFallback: upper.isFallback,
    },
  ]

  if (lower.rank !== null && normalizeRank(lower.rank) !== normalizeRank(upper.rank)) {
    rows.push({
      rank: lower.rank,
      units: lowerResult.units,
      isFallback: lower.isFallback || lowerResult.isFallback,
    })
  } else {
    rows.push({ rank: null, units: [], isFallback: false })
  }

  return rows.map((row) => ({
    ...row,
    rank: row.rank ? rankLabel(row.rank) : null,
  }))
}
