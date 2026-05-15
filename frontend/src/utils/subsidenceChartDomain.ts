import type { SubsidenceResult } from '@/types/subsidence'
import type { BurialPoint } from '@/types/subsidence'

export interface NumericExtent {
  min: number
  max: number
}

function cloneCurveWithPath(curve: SubsidenceResult, burialPath: BurialPoint[]): SubsidenceResult {
  return {
    ...curve,
    burial_path: burialPath,
  }
}

function interpolateBoundaryPoint(a: BurialPoint, b: BurialPoint, cutoffAgeMa: number): BurialPoint {
  const ageSpan = b.age_ma - a.age_ma
  if (ageSpan === 0) {
    return { age_ma: cutoffAgeMa, depth_m: a.depth_m }
  }
  const t = (cutoffAgeMa - a.age_ma) / ageSpan
  return {
    age_ma: cutoffAgeMa,
    depth_m: a.depth_m + (b.depth_m - a.depth_m) * t,
  }
}

export function clipBurialPathToAgeRange(
  burialPath: BurialPoint[],
  minAgeMa: number | null,
  maxAgeMa: number | null,
): BurialPoint[] {
  const sorted = [...burialPath]
    .filter((point) => Number.isFinite(point.age_ma) && Number.isFinite(point.depth_m))
    .sort((a, b) => a.age_ma - b.age_ma)

  if (sorted.length === 0) return []

  const hasMin = minAgeMa !== null && Number.isFinite(minAgeMa)
  const hasMax = maxAgeMa !== null && Number.isFinite(maxAgeMa)
  const minAge = hasMin ? minAgeMa : -Infinity
  const maxAge = hasMax ? maxAgeMa : Infinity
  if (maxAge < minAge) return []

  const clipped: BurialPoint[] = []
  for (let index = 0; index < sorted.length; index += 1) {
    const point = sorted[index]
    const previous = sorted[index - 1]

    if (previous) {
      const lowerAge = Math.min(previous.age_ma, point.age_ma)
      const upperAge = Math.max(previous.age_ma, point.age_ma)
      if (hasMin && minAgeMa > lowerAge && minAgeMa < upperAge) {
        clipped.push(interpolateBoundaryPoint(previous, point, minAgeMa))
      }
      if (hasMax && maxAgeMa > lowerAge && maxAgeMa < upperAge) {
        clipped.push(interpolateBoundaryPoint(previous, point, maxAgeMa))
      }
    }

    if (point.age_ma >= minAge && point.age_ma <= maxAge) {
      clipped.push(point)
    }
  }

  return clipped
    .filter((point, index, points) => (
      index === 0
      || point.age_ma !== points[index - 1].age_ma
      || point.depth_m !== points[index - 1].depth_m
    ))
    .sort((a, b) => b.age_ma - a.age_ma)
}

export function truncateCurvesBelowAge(curves: SubsidenceResult[], cutoffAgeMa: number | null): SubsidenceResult[] {
  if (cutoffAgeMa === null || !Number.isFinite(cutoffAgeMa)) return curves
  return curves.filter((curve) => {
    const validAges = curve.burial_path
      .map((point) => point.age_ma)
      .filter((age) => Number.isFinite(age))
    if (validAges.length === 0) return false
    return Math.max(...validAges) <= cutoffAgeMa
  })
}

export function reconstructCurvesToAge(curves: SubsidenceResult[], reconstructionAgeMa: number | null): SubsidenceResult[] {
  if (reconstructionAgeMa === null || !Number.isFinite(reconstructionAgeMa)) return curves
  return curves
    .map((curve) => cloneCurveWithPath(curve, clipBurialPathToAgeRange(curve.burial_path, reconstructionAgeMa, null)))
    .filter((curve) => curve.burial_path.length > 0)
}

export function applyGlobalStratCutoffs(
  curves: SubsidenceResult[],
  options: {
    reconstructAgeMa?: number | null
    truncateBelowAgeMa?: number | null
  },
): SubsidenceResult[] {
  return truncateCurvesBelowAge(
    reconstructCurvesToAge(curves, options.reconstructAgeMa ?? null),
    options.truncateBelowAgeMa ?? null,
  )
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
