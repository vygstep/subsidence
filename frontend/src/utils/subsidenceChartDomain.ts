import type { SubsidenceResult } from '@/types/subsidence'

export interface NumericExtent {
  min: number
  max: number
}

export interface ChartCutoff {
  maxAgeMa?: number
  maxDepthM?: number
}

export function applyChartCutoff(curves: SubsidenceResult[], cutoff: ChartCutoff | null): SubsidenceResult[] {
  if (cutoff === null || (cutoff.maxAgeMa === undefined && cutoff.maxDepthM === undefined)) {
    return curves
  }

  return curves.filter((curve) => {
    if (curve.burial_path.length === 0) return false

    const oldestAge = Math.max(...curve.burial_path.map((point) => point.age_ma))
    const presentDepthPoint = curve.burial_path.reduce((present, point) => (
      point.age_ma < present.age_ma ? point : present
    ))

    if (cutoff.maxAgeMa !== undefined && oldestAge > cutoff.maxAgeMa) return false
    if (cutoff.maxDepthM !== undefined && presentDepthPoint.depth_m > cutoff.maxDepthM) return false
    return true
  })
}

export function curveAgeExtent(curves: SubsidenceResult[]): NumericExtent | null {
  let min = Infinity
  let max = -Infinity

  for (const curve of curves) {
    for (const point of curve.burial_path) {
      if (!Number.isFinite(point.age_ma)) continue
      min = Math.min(min, point.age_ma)
      max = Math.max(max, point.age_ma)
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return null
  }
  return { min, max }
}

export function curveDepthExtent(curves: SubsidenceResult[]): NumericExtent | null {
  let min = Infinity
  let max = -Infinity

  for (const curve of curves) {
    for (const point of curve.burial_path) {
      if (!Number.isFinite(point.depth_m)) continue
      min = Math.min(min, point.depth_m)
      max = Math.max(max, point.depth_m)
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return null
  }
  return { min, max }
}

export function paddedDepthExtent(extent: NumericExtent | null, fallbackMax = 3000): NumericExtent {
  if (extent === null) {
    return { min: 0, max: fallbackMax }
  }

  const span = Math.max(1, extent.max - extent.min)
  const padding = Math.min(span * 0.1, 300)
  return {
    min: extent.min - padding,
    max: extent.max + padding,
  }
}

export function resolveRange(
  autoExtent: NumericExtent,
  manualMin: number | null,
  manualMax: number | null,
): NumericExtent {
  const min = manualMin ?? autoExtent.min
  const max = manualMax ?? autoExtent.max
  if (max > min) {
    return { min, max }
  }
  return { min, max: min + 1 }
}

export function zoomRangeAround(
  range: NumericExtent,
  anchorFraction: number,
  zoomFactor: number,
  minSpan = 1,
): NumericExtent {
  const span = Math.max(minSpan, range.max - range.min)
  const anchor = range.min + span * Math.min(1, Math.max(0, anchorFraction))
  const nextSpan = Math.max(minSpan, span * zoomFactor)
  const left = anchor - range.min
  const right = range.max - anchor
  const leftRatio = span > 0 ? left / span : 0.5
  const rightRatio = span > 0 ? right / span : 0.5
  return {
    min: anchor - nextSpan * leftRatio,
    max: anchor + nextSpan * rightRatio,
  }
}

export function clampRangeToBounds(range: NumericExtent, bounds: NumericExtent): NumericExtent {
  const boundsSpan = bounds.max - bounds.min
  const rangeSpan = range.max - range.min
  if (boundsSpan <= 0 || rangeSpan <= 0 || rangeSpan >= boundsSpan) {
    return { ...bounds }
  }

  if (range.min < bounds.min) {
    return { min: bounds.min, max: bounds.min + rangeSpan }
  }
  if (range.max > bounds.max) {
    return { min: bounds.max - rangeSpan, max: bounds.max }
  }
  return range
}

export function panRange(range: NumericExtent, delta: number, bounds: NumericExtent): NumericExtent {
  const rangeSpan = range.max - range.min
  const boundsSpan = bounds.max - bounds.min
  if (rangeSpan <= 0 || boundsSpan <= 0 || rangeSpan >= boundsSpan) {
    return range
  }
  return clampRangeToBounds({
    min: range.min + delta,
    max: range.max + delta,
  }, bounds)
}
