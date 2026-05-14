import { describe, expect, it } from 'vitest'

import { chooseAutoDepthGridIntervals, resolveDepthGridIntervals } from '@/utils/depthGrid'

describe('depth grid intervals', () => {
  it.each([
    [8, 1],
    [100, 10],
    [1000, 100],
    [2500, 250],
    [6000, 500],
    [12000, 1000],
  ])('chooses %s m span major interval', (visibleSpanM, expectedMajor) => {
    expect(chooseAutoDepthGridIntervals(visibleSpanM).majorInterval).toBe(expectedMajor)
  })

  it('keeps minor interval at 1 m for 1 m major interval', () => {
    expect(chooseAutoDepthGridIntervals(8)).toEqual({ majorInterval: 1, minorInterval: 1 })
  })

  it('uses manual intervals in manual mode', () => {
    expect(resolveDepthGridIntervals('manual', 1000, 123, 12.3)).toEqual({
      majorInterval: 123,
      minorInterval: 12.3,
    })
  })

  it('falls back to auto mode when mode is missing', () => {
    expect(resolveDepthGridIntervals(undefined, 1000, 123, 12.3).majorInterval).toBe(100)
  })
})
