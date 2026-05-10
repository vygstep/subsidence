import { describe, expect, it } from 'vitest'

import type { SubsidenceResult } from '@/types/subsidence'
import { curveAgeExtent, curveDepthExtent, paddedDepthExtent, resolveRange } from '@/utils/subsidenceChartDomain'

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
    expect(paddedDepthExtent({ min: 100, max: 10000 })).toEqual({ min: 0, max: 10300 })
  })

  it('resolves manual ranges and protects against inverted ranges', () => {
    expect(resolveRange({ min: 10, max: 20 }, null, null)).toEqual({ min: 10, max: 20 })
    expect(resolveRange({ min: 10, max: 20 }, 15, null)).toEqual({ min: 15, max: 20 })
    expect(resolveRange({ min: 10, max: 20 }, 30, 20)).toEqual({ min: 30, max: 31 })
  })
})
