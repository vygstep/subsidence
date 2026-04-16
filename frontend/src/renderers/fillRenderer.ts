import type { ScaleLinear, ScaleLogarithmic } from 'd3-scale'

function isDrawable(value: number, nullValue: number | null): boolean {
  return Number.isFinite(value) && (nullValue === null || value !== nullValue)
}

function fillPolygon(
  ctx: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
  color: string,
  opacity: number,
): void {
  if (points.length < 3) {
    return
  }

  ctx.save()
  ctx.fillStyle = color
  ctx.globalAlpha = opacity
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)

  for (let index = 1; index < points.length; index += 1) {
    ctx.lineTo(points[index].x, points[index].y)
  }

  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

export function drawFillToBaseline(
  ctx: CanvasRenderingContext2D,
  depths: Float32Array,
  values: Float32Array,
  baseline: number,
  depthScale: ScaleLinear<number, number>,
  valueScale: ScaleLinear<number, number> | ScaleLogarithmic<number, number>,
  colorAbove: string,
  colorBelow: string,
  opacity: number,
  nullValue: number | null,
): void {
  if (depths.length < 2 || values.length < 2) {
    return
  }

  const baselineX = valueScale(baseline)

  for (let index = 0; index < depths.length - 1; index += 1) {
    const depthA = depths[index]
    const depthB = depths[index + 1]
    const valueA = values[index]
    const valueB = values[index + 1]

    if (!Number.isFinite(depthA) || !Number.isFinite(depthB)) {
      continue
    }
    if (!isDrawable(valueA, nullValue) || !isDrawable(valueB, nullValue)) {
      continue
    }

    const xA = valueScale(valueA)
    const xB = valueScale(valueB)
    const yA = depthScale(depthA)
    const yB = depthScale(depthB)
    const isAboveA = valueA > baseline
    const isAboveB = valueB > baseline

    if (isAboveA === isAboveB) {
      fillPolygon(
        ctx,
        [
          { x: baselineX, y: yA },
          { x: xA, y: yA },
          { x: xB, y: yB },
          { x: baselineX, y: yB },
        ],
        isAboveA ? colorAbove : colorBelow,
        opacity,
      )
      continue
    }

    const denominator = xB - xA
    if (denominator === 0) {
      continue
    }

    const t = (baselineX - xA) / denominator
    if (!Number.isFinite(t) || t < 0 || t > 1) {
      continue
    }

    const crossY = yA + (yB - yA) * t

    fillPolygon(
      ctx,
      [
        { x: baselineX, y: yA },
        { x: xA, y: yA },
        { x: baselineX, y: crossY },
      ],
      isAboveA ? colorAbove : colorBelow,
      opacity,
    )

    fillPolygon(
      ctx,
      [
        { x: baselineX, y: crossY },
        { x: xB, y: yB },
        { x: baselineX, y: yB },
      ],
      isAboveB ? colorAbove : colorBelow,
      opacity,
    )
  }
}

export function drawFillBetweenCurves(
  ctx: CanvasRenderingContext2D,
  depths: Float32Array,
  values1: Float32Array,
  values2: Float32Array,
  depthScale: ScaleLinear<number, number>,
  valueScale1: ScaleLinear<number, number> | ScaleLogarithmic<number, number>,
  valueScale2: ScaleLinear<number, number> | ScaleLogarithmic<number, number>,
  colorPositive: string,
  colorNegative: string,
  opacity: number,
  nullValue: number | null,
): void {
  const sampleCount = Math.min(depths.length, values1.length, values2.length)
  if (sampleCount < 2) {
    return
  }

  for (let index = 0; index < sampleCount - 1; index += 1) {
    const depthA = depths[index]
    const depthB = depths[index + 1]
    const value1A = values1[index]
    const value1B = values1[index + 1]
    const value2A = values2[index]
    const value2B = values2[index + 1]

    if (!Number.isFinite(depthA) || !Number.isFinite(depthB)) {
      continue
    }
    if (!isDrawable(value1A, nullValue) || !isDrawable(value1B, nullValue)) {
      continue
    }
    if (!isDrawable(value2A, nullValue) || !isDrawable(value2B, nullValue)) {
      continue
    }

    const x1A = valueScale1(value1A)
    const x1B = valueScale1(value1B)
    const x2A = valueScale2(value2A)
    const x2B = valueScale2(value2B)
    const yA = depthScale(depthA)
    const yB = depthScale(depthB)

    const deltaA = x1A - x2A
    const deltaB = x1B - x2B
    const positiveA = deltaA >= 0
    const positiveB = deltaB >= 0

    if (positiveA === positiveB) {
      fillPolygon(
        ctx,
        [
          { x: x1A, y: yA },
          { x: x2A, y: yA },
          { x: x2B, y: yB },
          { x: x1B, y: yB },
        ],
        positiveA ? colorPositive : colorNegative,
        opacity,
      )
      continue
    }

    const denominator = deltaA - deltaB
    if (denominator === 0) {
      continue
    }

    const t = deltaA / denominator
    if (!Number.isFinite(t) || t < 0 || t > 1) {
      continue
    }

    const crossY = yA + (yB - yA) * t
    const crossX = x1A + (x1B - x1A) * t

    fillPolygon(
      ctx,
      [
        { x: x1A, y: yA },
        { x: x2A, y: yA },
        { x: crossX, y: crossY },
      ],
      positiveA ? colorPositive : colorNegative,
      opacity,
    )

    fillPolygon(
      ctx,
      [
        { x: crossX, y: crossY },
        { x: x2B, y: yB },
        { x: x1B, y: yB },
      ],
      positiveB ? colorPositive : colorNegative,
      opacity,
    )
  }
}
