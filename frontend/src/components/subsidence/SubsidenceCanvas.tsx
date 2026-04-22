import { useCallback, useMemo, useRef } from 'react'

import { useCanvasRenderer } from '@/hooks/useCanvasRenderer'
import { drawBurialCurves, drawFormationFills } from '@/renderers/subsidenceRenderer'
import { useComputedStore } from '@/stores'
import { GeologicalTimescale } from './GeologicalTimescale'

const TIMESCALE_HEIGHT = 40
const PADDING = { top: 12, right: 16, bottom: 32, left: 52 }

function drawAxes(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  minAge: number,
  maxAge: number,
  maxDepth: number,
  timeToX: (age: number) => number,
  depthToY: (depth: number) => number,
) {
  const plotW = width - PADDING.left - PADDING.right
  const plotH = height - PADDING.top - PADDING.bottom

  ctx.save()
  ctx.strokeStyle = '#475569'
  ctx.lineWidth = 1

  // Y axis
  ctx.beginPath()
  ctx.moveTo(PADDING.left, PADDING.top)
  ctx.lineTo(PADDING.left, PADDING.top + plotH)
  ctx.stroke()

  // X axis
  ctx.beginPath()
  ctx.moveTo(PADDING.left, PADDING.top + plotH)
  ctx.lineTo(PADDING.left + plotW, PADDING.top + plotH)
  ctx.stroke()

  ctx.fillStyle = '#94a3b8'
  ctx.font = '10px system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'

  // Y tick marks (depth)
  const depthStep = niceStep(maxDepth, 5)
  for (let d = 0; d <= maxDepth; d += depthStep) {
    const y = depthToY(d)
    ctx.beginPath()
    ctx.moveTo(PADDING.left - 4, y)
    ctx.lineTo(PADDING.left, y)
    ctx.stroke()
    ctx.fillText(`${d}`, PADDING.left - 6, y)
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'

  // X tick marks (age Ma)
  const ageStep = niceStep(maxAge - minAge, 5)
  for (let age = Math.ceil(minAge / ageStep) * ageStep; age <= maxAge; age += ageStep) {
    const x = timeToX(age)
    ctx.beginPath()
    ctx.moveTo(x, PADDING.top + plotH)
    ctx.lineTo(x, PADDING.top + plotH + 4)
    ctx.stroke()
    ctx.fillText(`${age}`, x, PADDING.top + plotH + 6)
  }

  ctx.restore()
}

function niceStep(range: number, targetTicks: number): number {
  const raw = range / targetTicks
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  if (norm < 1.5) return mag
  if (norm < 3.5) return 2 * mag
  if (norm < 7.5) return 5 * mag
  return 10 * mag
}

export function SubsidenceCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)

  const subsidenceCurves = useComputedStore((s) => s.subsidenceCurves)
  const showFormationFills = useComputedStore((s) => s.showFormationFills)
  const showBurialCurves = useComputedStore((s) => s.showBurialCurves)

  const { minAge, maxAge, maxDepth } = useMemo(() => {
    if (subsidenceCurves.length === 0) return { minAge: 0, maxAge: 100, maxDepth: 3000 }
    let minA = Infinity, maxA = 0, maxD = 0
    for (const curve of subsidenceCurves) {
      for (const pt of curve.burial_path) {
        if (pt.age_ma < minA) minA = pt.age_ma
        if (pt.age_ma > maxA) maxA = pt.age_ma
        if (pt.depth_m > maxD) maxD = pt.depth_m
      }
    }
    return { minAge: Math.max(0, minA), maxAge: maxA * 1.02, maxDepth: maxD * 1.1 }
  }, [subsidenceCurves])

  const draw = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, width, height)

    const plotW = width - PADDING.left - PADDING.right
    const plotH = height - PADDING.top - PADDING.bottom
    if (plotW <= 0 || plotH <= 0) return

    // Oldest (maxAge) at left, present (0) at right
    const timeToX = (age: number) =>
      PADDING.left + ((maxAge - age) / (maxAge - minAge || 1)) * plotW

    // 0 at top, maxDepth at bottom
    const depthToY = (depth: number) =>
      PADDING.top + (depth / (maxDepth || 1)) * plotH

    drawAxes(ctx, width, height, minAge, maxAge, maxDepth, timeToX, depthToY)

    // Clip to plot area
    ctx.save()
    ctx.beginPath()
    ctx.rect(PADDING.left, PADDING.top, plotW, plotH)
    ctx.clip()

    if (showFormationFills) drawFormationFills(ctx, subsidenceCurves, timeToX, depthToY)
    if (showBurialCurves) drawBurialCurves(ctx, subsidenceCurves, timeToX, depthToY)

    ctx.restore()
  }, [subsidenceCurves, minAge, maxAge, maxDepth, showFormationFills, showBurialCurves])

  const canvasRef = useCanvasRenderer(draw, [draw])

  return (
    <div ref={containerRef} className="subsidence-canvas-container">
      <GeologicalTimescale
        timeRange={{ min_ma: minAge, max_ma: maxAge }}
        height={TIMESCALE_HEIGHT}
        paddingLeft={PADDING.left}
        paddingRight={PADDING.right}
      />
      <div className="subsidence-canvas-wrapper">
        <canvas ref={canvasRef} className="subsidence-canvas" />
      </div>
    </div>
  )
}
