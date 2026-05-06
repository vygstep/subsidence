import type { ScaleLinear } from 'd3-scale'

const WELL_PADDING_FILL = 'rgba(226,232,240,0.86)'
const WELL_BOUNDARY_STROKE = 'rgba(100,116,139,0.72)'

function clampPixel(value: number, height: number): number {
  return Math.max(0, Math.min(height, value))
}

export function drawWellPaddingZones(
  ctx: CanvasRenderingContext2D,
  depthScale: ScaleLinear<number, number>,
  width: number,
  height: number,
  wellTopDepth: number,
  wellBottomDepth: number,
): void {
  const [visibleTop, visibleBottom] = depthScale.domain()

  ctx.save()
  ctx.fillStyle = WELL_PADDING_FILL

  if (visibleTop < wellTopDepth) {
    const yBottom = clampPixel(depthScale(Math.min(wellTopDepth, visibleBottom)), height)
    if (yBottom > 0) {
      ctx.fillRect(0, 0, width, yBottom)
    }
  }

  if (visibleBottom > wellBottomDepth) {
    const yTop = clampPixel(depthScale(Math.max(wellBottomDepth, visibleTop)), height)
    if (yTop < height) {
      ctx.fillRect(0, yTop, width, height - yTop)
    }
  }

  ctx.strokeStyle = WELL_BOUNDARY_STROKE
  ctx.lineWidth = 1
  for (const depth of [wellTopDepth, wellBottomDepth]) {
    if (depth < visibleTop || depth > visibleBottom) continue
    const y = Math.round(clampPixel(depthScale(depth), height)) + 0.5
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }

  ctx.restore()
}
