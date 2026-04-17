import type { ScaleLinear, ScaleLogarithmic } from 'd3-scale'

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

export function drawLogarithmicGrid(
  ctx: CanvasRenderingContext2D,
  xScale: ScaleLogarithmic<number, number>,
  decades: number,
  width: number,
  height: number,
  color: string,
  majorColor = '#8ea3b5',
): void {
  if (decades <= 0) {
    return
  }

  const [domainStart, domainEnd] = xScale.domain()
  if (domainStart <= 0 || domainEnd <= 0) {
    return
  }

  const startExponent = Math.floor(Math.log10(domainStart))
  const normalizedStart = domainStart / 10 ** startExponent
  const majorMantissa = Math.max(1, Math.min(9, Math.round(normalizedStart)))

  ctx.save()

  for (let exponent = startExponent; exponent <= startExponent + decades; exponent += 1) {
    const majorValue = majorMantissa * 10 ** exponent
    if (majorValue >= domainStart && majorValue <= domainEnd) {
      const x = xScale(majorValue)
      ctx.beginPath()
      ctx.strokeStyle = majorColor
      ctx.lineWidth = 1.1
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }

    if (exponent === startExponent + decades) {
      continue
    }

    for (let mantissa = majorMantissa + 1; mantissa <= 10; mantissa += 1) {
      const minorValue = mantissa * 10 ** exponent
      if (minorValue < domainStart || minorValue > domainEnd) {
        continue
      }

      const x = xScale(minorValue)
      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.lineWidth = 0.8
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }
  }

  ctx.beginPath()
  ctx.strokeStyle = color
  ctx.lineWidth = 1
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
