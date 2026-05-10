import type { SubsidenceResult } from '@/types/subsidence'

export interface NumericExtent {
  min: number
  max: number
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
  const paddedMin = extent.min - padding
  const min = extent.min < 0 ? paddedMin : Math.max(0, paddedMin)
  return {
    min,
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
