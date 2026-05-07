import { describe, expect, it } from 'vitest'

import { mdToTvd, minCurvatureToTVD } from '@/utils/depthTransform'

describe('depthTransform', () => {
  it('extends MD to TVD below the last survey point with the last inclination', () => {
    const table = minCurvatureToTVD([
      { md: 0, inclination_deg: 60, azimuth_deg: 0 },
      { md: 100, inclination_deg: 60, azimuth_deg: 0 },
    ])

    expect(mdToTvd(100, table)).toBeCloseTo(50)
    expect(mdToTvd(200, table)).toBeCloseTo(100)
  })
})
