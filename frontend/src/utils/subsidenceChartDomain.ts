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
