import type { ScaleLinear } from 'd3-scale'

export function drawLinearGrid(
  ctx: CanvasRenderingContext2D,
  xScale: ScaleLinear<number, number>,
  divisions: number,
  width: number,
  height: number,
  color: string,
): void {
  if (divisions <= 0) {
    return
  }

  const [domainStart, domainEnd] = xScale.domain()
  const step = (domainEnd - domainStart) / divisions

  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1

  for (let index = 0; index <= divisions; index += 1) {
    const xValue = domainStart + step * index
    const x = xScale(xValue)
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }

  ctx.beginPath()
  ctx.moveTo(0, height - 0.5)
  ctx.lineTo(width, height - 0.5)
  ctx.stroke()
  ctx.restore()
}

export function drawDepthGridlines(
  ctx: CanvasRenderingContext2D,
  depthScale: ScaleLinear<number, number>,
  width: number,
  majorInterval: number,
  minorInterval: number,
): void {
  const [depthStart, depthEnd] = depthScale.domain()
  const firstMinor = Math.ceil(depthStart / minorInterval) * minorInterval

  ctx.save()

  for (let depth = firstMinor; depth <= depthEnd; depth += minorInterval) {
    const y = depthScale(depth)
    const isMajor = depth % majorInterval === 0
    ctx.beginPath()
    ctx.strokeStyle = isMajor ? '#c4d0dc' : '#e2e8f0'
    ctx.lineWidth = isMajor ? 1.1 : 0.8
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }

  ctx.restore()
}
