import type { ScaleLinear } from 'd3-scale'

export function drawDepthLabels(
  ctx: CanvasRenderingContext2D,
  depthScale: ScaleLinear<number, number>,
  width: number,
  majorInterval: number,
  unit: 'm' | 'km' | 'ft' = 'm',
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
    const displayValue =
      unit === 'km' ? depth / 1000 : unit === 'ft' ? depth * 3.28084 : depth
    const digits = unit === 'm' ? 0 : 2
    ctx.fillText(`${displayValue.toFixed(digits)} ${unit}`, width - 10, y)
  }

  ctx.restore()
}
