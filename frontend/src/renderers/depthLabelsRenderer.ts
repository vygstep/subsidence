import type { ScaleLinear } from 'd3-scale'

export function drawDepthLabels(
  ctx: CanvasRenderingContext2D,
  depthScale: ScaleLinear<number, number>,
  width: number,
  majorInterval: number,
): void {
  const [depthStart, depthEnd] = depthScale.domain()
  const firstLabel = Math.ceil(depthStart / majorInterval) * majorInterval

  ctx.save()
  ctx.fillStyle = '#516273'
  ctx.font = '12px Segoe UI'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'

  for (let depth = firstLabel; depth <= depthEnd; depth += majorInterval) {
    const y = depthScale(depth)
    ctx.fillText(`${depth.toFixed(0)} m`, width - 10, y)
  }

  ctx.restore()
}
