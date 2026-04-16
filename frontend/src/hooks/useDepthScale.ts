import { scaleLinear, type ScaleLinear } from 'd3-scale'
import { useMemo } from 'react'

interface VisibleDepthRange {
  min: number
  max: number
}

interface DepthScaleResult {
  depthToPixel: (depth: number) => number
  pixelToDepth: (pixel: number) => number
  scale: ScaleLinear<number, number>
}

export function useDepthScale(
  visibleDepthRange: VisibleDepthRange,
  canvasHeight: number,
): DepthScaleResult {
  const scale = useMemo(
    () => scaleLinear().domain([visibleDepthRange.min, visibleDepthRange.max]).range([0, canvasHeight]),
    [canvasHeight, visibleDepthRange.max, visibleDepthRange.min],
  )

  return {
    depthToPixel: (depth) => scale(depth),
    pixelToDepth: (pixel) => scale.invert(pixel),
    scale,
  }
}
