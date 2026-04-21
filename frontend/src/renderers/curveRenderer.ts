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

export function drawCurve(
  ctx: CanvasRenderingContext2D,
  depths: Float32Array,
  values: Float32Array,
  depthScale: ScaleLinear<number, number>,
  valueScale: ScaleLinear<number, number> | ScaleLogarithmic<number, number>,
  style: CurveStyle,
  nullValue: number | null = null,
  isSelected = false,
): void {
  if (depths.length === 0 || values.length === 0) {
    return
  }

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
      continue
    }

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
