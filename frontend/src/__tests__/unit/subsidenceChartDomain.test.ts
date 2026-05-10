import { describe, expect, it } from 'vitest'

import type { SubsidenceResult } from '@/types/subsidence'
import { curveAgeExtent } from '@/utils/subsidenceChartDomain'

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
})
