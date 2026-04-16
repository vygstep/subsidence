import { scaleLinear, type ScaleLinear } from 'd3-scale'

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
  const scale = scaleLinear()
    .domain([visibleDepthRange.min, visibleDepthRange.max])
    .range([0, canvasHeight])

  return {
    depthToPixel: (depth) => scale(depth),
    pixelToDepth: (pixel) => scale.invert(pixel),
    scale,
  }
}
