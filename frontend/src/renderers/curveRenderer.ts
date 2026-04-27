import type { ScaleLinear, ScaleLogarithmic } from 'd3-scale'

interface CurveStyle {
  color: string
  lineWidth: number
  lineStyle: 'solid' | 'dashed' | 'dotted'
}

function lineDash(style: CurveStyle['lineStyle']): number[] {
  switch (style) {
    case 'dashed':
      return [8, 6]
    case 'dotted':
      return [2, 6]
    default:
      return []
  }
}

function computeGapThreshold(depths: Float32Array, multiplier: number): number {
  if (depths.length < 2) return Infinity
  const n = depths.length - 1
  const stride = Math.max(1, Math.floor(n / 500))
  const steps: number[] = []
  for (let i = 0; i + 1 < depths.length; i += stride) {
    const d = depths[i + 1] - depths[i]
    if (d > 0 && Number.isFinite(d)) steps.push(d)
  }
  if (steps.length === 0) return Infinity
  steps.sort((a, b) => a - b)
  return steps[Math.floor(steps.length / 2)] * multiplier
}

export function drawCurve(
  ctx: CanvasRenderingContext2D,
  depths: Float32Array,
  values: Float32Array,
  depthScale: ScaleLinear<number, number>,
  valueScale: ScaleLinear<number, number> | ScaleLogarithmic<number, number>,
  style: CurveStyle,
  nullValue: number | null = null,
  isSelected = false,
  gapMultiplier = 5,
): void {
  if (depths.length === 0 || values.length === 0) {
    return
  }

  const gapThreshold = computeGapThreshold(depths, gapMultiplier)

  ctx.save()
  ctx.strokeStyle = style.color
  ctx.lineWidth = isSelected ? style.lineWidth * 2 : style.lineWidth
  ctx.setLineDash(lineDash(style.lineStyle))
  if (isSelected) {
    ctx.shadowBlur = 8
    ctx.shadowColor = style.color
  }

  let path = new Path2D()
  let hasSegment = false
  let prevValidDepth = Infinity

  for (let index = 0; index < depths.length; index += 1) {
    const depth = depths[index]
    const value = values[index]
    const isNull = nullValue !== null && value === nullValue
    const isFinitePoint = Number.isFinite(depth) && Number.isFinite(value)

    if (isNull || !isFinitePoint) {
      if (hasSegment) {
        ctx.stroke(path)
        path = new Path2D()
        hasSegment = false
      }
      prevValidDepth = Infinity
      continue
    }

    if (hasSegment && depth - prevValidDepth > gapThreshold) {
      ctx.stroke(path)
      path = new Path2D()
      hasSegment = false
    }

    prevValidDepth = depth

    const x = valueScale(value)
    const y = depthScale(depth)

    if (!hasSegment) {
      path.moveTo(x, y)
      hasSegment = true
    } else {
      path.lineTo(x, y)
    }
  }

  if (hasSegment) {
    ctx.stroke(path)
  }

  ctx.restore()
}
