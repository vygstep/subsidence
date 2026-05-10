import { describe, expect, it } from 'vitest'

import type { SubsidenceResult } from '@/types/subsidence'
import {
  curveAgeExtent,
  curveDepthExtent,
  clampRangeToBounds,
  paddedDepthExtent,
  panRange,
  resolveRange,
  zoomRangeAround,
} from '@/utils/subsidenceChartDomain'

function curve(name: string, ages: number[]): SubsidenceResult {
  return {
    formation_name: name,
    color: '#000000',
    lithology: '',
    burial_path: ages.map((age_ma) => ({ age_ma, depth_m: age_ma * 10 })),
  }
}

describe('subsidenceChartDomain', () => {
  it('computes age extent from rendered curves only', () => {
    expect(curveAgeExtent([
      curve('active-well-zone-a', [0, 10, 20]),
      curve('active-well-zone-b', [5, 25]),
    ])).toEqual({ min: 0, max: 25 })
  })

  it('ignores invalid ages and returns null for empty data', () => {
    expect(curveAgeExtent([curve('invalid', [Number.NaN, Infinity])])).toBeNull()
    expect(curveAgeExtent([])).toBeNull()
  })

  it('computes depth extent and applies capped ten percent padding', () => {
    const extent = curveDepthExtent([
      {
        ...curve('depths', [0, 1, 2]),
        burial_path: [
          { age_ma: 0, depth_m: 100 },
          { age_ma: 1, depth_m: 200 },
        ],
      },
    ])

    expect(extent).toEqual({ min: 100, max: 200 })
    expect(paddedDepthExtent(extent)).toEqual({ min: 90, max: 210 })
    expect(paddedDepthExtent({ min: 0, max: 100 })).toEqual({ min: -10, max: 110 })
    expect(paddedDepthExtent({ min: 100, max: 10000 })).toEqual({ min: -200, max: 10300 })
  })

  it('resolves manual ranges and protects against inverted ranges', () => {
    expect(resolveRange({ min: 10, max: 20 }, null, null)).toEqual({ min: 10, max: 20 })
    expect(resolveRange({ min: 10, max: 20 }, 15, null)).toEqual({ min: 15, max: 20 })
    expect(resolveRange({ min: 10, max: 20 }, 30, 20)).toEqual({ min: 30, max: 31 })
  })

  it('zooms a range around an anchor fraction', () => {
    expect(zoomRangeAround({ min: 0, max: 100 }, 0.5, 0.5)).toEqual({ min: 25, max: 75 })
    expect(zoomRangeAround({ min: 0, max: 100 }, 0, 0.5)).toEqual({ min: 0, max: 50 })
    expect(zoomRangeAround({ min: 0, max: 100 }, 1, 0.5)).toEqual({ min: 50, max: 100 })
  })

  it('clamps and pans ranges inside data bounds', () => {
    const bounds = { min: 0, max: 100 }
    expect(clampRangeToBounds({ min: -10, max: 40 }, bounds)).toEqual({ min: 0, max: 50 })
    expect(clampRangeToBounds({ min: 80, max: 130 }, bounds)).toEqual({ min: 50, max: 100 })
    expect(clampRangeToBounds({ min: -20, max: 120 }, bounds)).toEqual(bounds)
    expect(panRange({ min: 20, max: 60 }, 30, bounds)).toEqual({ min: 50, max: 90 })
    expect(panRange({ min: 20, max: 60 }, -50, bounds)).toEqual({ min: 0, max: 40 })
    expect(panRange({ min: -20, max: 120 }, 10, bounds)).toEqual({ min: -20, max: 120 })
  })
})
