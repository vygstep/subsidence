export type DepthGridStepMode = 'auto' | 'manual'

export interface DepthGridIntervals {
  majorInterval: number
  minorInterval: number
}

const ALLOWED_MAJOR_INTERVALS = [1, 10, 100, 250, 500, 1000] as const
const TARGET_MAJOR_LINE_COUNT = 12

export function chooseAutoDepthGridIntervals(visibleSpanM: number): DepthGridIntervals {
  const span = Number.isFinite(visibleSpanM) ? Math.max(visibleSpanM, 1) : 1
  const targetInterval = span / TARGET_MAJOR_LINE_COUNT
  const majorInterval = ALLOWED_MAJOR_INTERVALS.find((interval) => interval >= targetInterval)
    ?? ALLOWED_MAJOR_INTERVALS[ALLOWED_MAJOR_INTERVALS.length - 1]

  return {
    majorInterval,
    minorInterval: majorInterval === 1 ? 1 : Math.max(1, majorInterval / 10),
  }
}

export function resolveDepthGridIntervals(
  mode: DepthGridStepMode | undefined,
  visibleSpanM: number,
  manualMajorInterval: number,
  manualMinorInterval: number,
): DepthGridIntervals {
  if (mode !== 'manual') {
    return chooseAutoDepthGridIntervals(visibleSpanM)
  }

  const majorInterval = Number.isFinite(manualMajorInterval) && manualMajorInterval > 0
    ? manualMajorInterval
    : 100
  const minorInterval = Number.isFinite(manualMinorInterval) && manualMinorInterval > 0
    ? manualMinorInterval
    : Math.max(1, majorInterval / 10)

  return { majorInterval, minorInterval }
}
