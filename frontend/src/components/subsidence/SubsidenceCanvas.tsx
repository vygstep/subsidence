import { useCallback, useMemo, useRef } from 'react'

import { useCanvasRenderer } from '@/hooks/useCanvasRenderer'
import { drawBurialCurves, drawFormationFills } from '@/renderers/subsidenceRenderer'
import { useComputedStore, useViewStore } from '@/stores'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useWellDataStore } from '@/stores/wellDataStore'
import type { SubsidenceResult } from '@/types/subsidence'
import { GeologicalTimescale } from './GeologicalTimescale'

const TIMESCALE_HEIGHT = 52
const PADDING = { top: 12, right: 100, bottom: 48, left: 64 }

function drawAxes(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  maxAge: number,
  minDepthM: number,
  maxDepthM: number,
  timeToX: (age: number) => number,
  depthToY: (depthM: number) => number,
) {
  const plotW = width - PADDING.left - PADDING.right
  const plotH = height - PADDING.top - PADDING.bottom

  ctx.save()
  ctx.strokeStyle = '#94a3b8'
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

  ctx.fillStyle = '#64748b'
  ctx.font = '10px system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'

  // Y tick marks — depth in km
  const minDepthKm = minDepthM / 1000
  const maxDepthKm = maxDepthM / 1000
  const depthStepKm = niceStep(maxDepthKm - minDepthKm, 5)
  const firstTickKm = Math.ceil(minDepthKm / depthStepKm) * depthStepKm
  for (let dKm = firstTickKm; dKm <= maxDepthKm + depthStepKm * 0.01; dKm += depthStepKm) {
    const y = depthToY(dKm * 1000)
    ctx.beginPath()
    ctx.moveTo(PADDING.left - 4, y)
    ctx.lineTo(PADDING.left, y)
    ctx.stroke()
    const label = Number.isInteger(depthStepKm) ? `${dKm}` : dKm.toFixed(1)
    ctx.fillText(label, PADDING.left - 6, y)
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'

  // X tick marks — age Ma, right=0, left=maxAge
  const ageStep = niceStep(maxAge, 5)
  for (let age = 0; age <= maxAge + ageStep * 0.01; age += ageStep) {
    const x = timeToX(age)
    ctx.beginPath()
    ctx.moveTo(x, PADDING.top + plotH)
    ctx.lineTo(x, PADDING.top + plotH + 4)
    ctx.stroke()
    ctx.fillText(`${age}`, x, PADDING.top + plotH + 6)
  }

  // Y axis label — "Depth (km)"
  ctx.save()
  ctx.font = '11px system-ui, sans-serif'
  ctx.fillStyle = '#94a3b8'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const midY = PADDING.top + plotH / 2
  ctx.translate(14, midY)
  ctx.rotate(-Math.PI / 2)
  ctx.fillText('Depth (km)', 0, 0)
  ctx.restore()

  // X axis label — "Age (Ma)"
  ctx.font = '11px system-ui, sans-serif'
  ctx.fillStyle = '#94a3b8'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText('Age (Ma)', PADDING.left + plotW / 2, height - 4)

  ctx.restore()
}

function drawFormationLabels(
  ctx: CanvasRenderingContext2D,
  curves: SubsidenceResult[],
  plotRight: number,
  depthToY: (depth: number) => number,
) {
  ctx.save()
  ctx.font = '10px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'

  for (const curve of curves) {
    if (curve.burial_path.length === 0) continue
    // youngest point = rightmost on chart (smallest age_ma)
    const youngest = curve.burial_path.reduce((a, b) => (a.age_ma < b.age_ma ? a : b))
    const y = depthToY(youngest.depth_m)
    const x = plotRight + 6

    // colored dot
    ctx.fillStyle = curve.color
    ctx.beginPath()
    ctx.arc(x + 3, y, 3, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#334155'
    ctx.fillText(curve.formation_name, x + 10, y)
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
  const crosshairRef = useRef<HTMLCanvasElement>(null)
  const maxAgeRef = useRef(100)
  const minDepthMRef = useRef(0)
  const maxDepthMRef = useRef(3000)

  const subsidenceCurves = useComputedStore((s) => s.subsidenceCurves)
  const showFormationFills = useComputedStore((s) => s.showFormationFills)
  const showBurialCurves = useComputedStore((s) => s.showBurialCurves)

  const subsidenceDepthMinM = useViewStore((s) => s.subsidenceSingleDepthMin)
  const subsidenceDepthMaxM = useViewStore((s) => s.subsidenceSingleDepthMax)

  const wellName = useWellDataStore((s) => s.well?.well_name ?? null)
  const formations = useWellDataStore((s) => s.formations)
  const selectedObject = useWorkspaceStore((s) => s.selectedObject)
  const setSelectedObject = useWorkspaceStore((s) => s.setSelectedObject)

  const isSelected = selectedObject?.type === 'subsidence-chart' && selectedObject.chartType === 'single'

  const handleTitleClick = useCallback(() => {
    setSelectedObject(isSelected ? null : { type: 'subsidence-chart', chartType: 'single' })
  }, [isSelected, setSelectedObject])

  // X axis: 0 (present, right) → oldest formation age (left)
  const maxAge = useMemo(() => {
    let max = 0
    for (const f of formations) {
      if (f.age_ma != null && f.age_ma > max) max = f.age_ma
    }
    return max > 0 ? max : 100
  }, [formations])

  // Y axis auto range: fit to burial data (no tdMd padding)
  const autoMaxDepthM = useMemo(() => {
    let max = 0
    for (const c of subsidenceCurves) {
      for (const pt of c.burial_path) {
        if (pt.depth_m > max) max = pt.depth_m
      }
    }
    return max > 0 ? max : 3000
  }, [subsidenceCurves])

  const effectiveMinDepthM = subsidenceDepthMinM ?? 0
  const effectiveMaxDepthM = subsidenceDepthMaxM ?? autoMaxDepthM

  // Keep refs in sync so crosshair handler always has latest values without re-binding
  maxAgeRef.current = maxAge
  minDepthMRef.current = effectiveMinDepthM
  maxDepthMRef.current = effectiveMaxDepthM

  const drawCrosshair = useCallback((cssX: number | null, cssY: number | null) => {
    const canvas = crosshairRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const ratio = window.devicePixelRatio || 1
    const w = canvas.clientWidth || 1
    const h = canvas.clientHeight || 1
    const bw = Math.round(w * ratio)
    const bh = Math.round(h * ratio)
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw
      canvas.height = bh
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (cssX === null || cssY === null) return

    const currentMaxAge = maxAgeRef.current
    const currentMinDepthM = minDepthMRef.current
    const currentMaxDepthM = maxDepthMRef.current
    const plotW = w - PADDING.left - PADDING.right
    const plotH = h - PADDING.top - PADDING.bottom
    if (plotW <= 0 || plotH <= 0) return
    if (cssX < PADDING.left || cssX > PADDING.left + plotW) return
    if (cssY < PADDING.top || cssY > PADDING.top + plotH) return

    const age = currentMaxAge * (1 - (cssX - PADDING.left) / plotW)
    const depthM = currentMinDepthM + (currentMaxDepthM - currentMinDepthM) * (cssY - PADDING.top) / plotH

    ctx.save()
    ctx.scale(ratio, ratio)

    // Crosshair lines
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)'
    ctx.lineWidth = 0.75
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(PADDING.left, cssY)
    ctx.lineTo(PADDING.left + plotW, cssY)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cssX, PADDING.top)
    ctx.lineTo(cssX, PADDING.top + plotH)
    ctx.stroke()
    ctx.setLineDash([])

    // Depth readout on Y axis
    const depthLabel = depthM < 1000
      ? `${Math.round(depthM)} m`
      : `${(depthM / 1000).toFixed(2)} km`
    ctx.font = 'bold 9px system-ui, sans-serif'
    const dw = ctx.measureText(depthLabel).width + 6
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(PADDING.left - dw - 2, cssY - 8, dw, 16)
    ctx.fillStyle = '#f8fafc'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText(depthLabel, PADDING.left - 5, cssY)

    // Age readout on X axis
    const ageLabel = `${age.toFixed(1)} Ma`
    ctx.font = 'bold 9px system-ui, sans-serif'
    const aw = ctx.measureText(ageLabel).width + 6
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(cssX - aw / 2, PADDING.top + plotH + 2, aw, 14)
    ctx.fillStyle = '#f8fafc'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(ageLabel, cssX, PADDING.top + plotH + 4)

    ctx.restore()
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    drawCrosshair(e.clientX - rect.left, e.clientY - rect.top)
  }, [drawCrosshair])

  const handleMouseLeave = useCallback(() => {
    drawCrosshair(null, null)
  }, [drawCrosshair])

  const draw = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    const plotW = width - PADDING.left - PADDING.right
    const plotH = height - PADDING.top - PADDING.bottom
    if (plotW <= 0 || plotH <= 0) return

    const timeToX = (age: number) =>
      PADDING.left + ((maxAge - age) / (maxAge || 1)) * plotW

    const depthRange = effectiveMaxDepthM - effectiveMinDepthM || 1
    const depthToY = (depthM: number) =>
      PADDING.top + ((depthM - effectiveMinDepthM) / depthRange) * plotH

    drawAxes(ctx, width, height, maxAge, effectiveMinDepthM, effectiveMaxDepthM, timeToX, depthToY)

    ctx.save()
    ctx.beginPath()
    ctx.rect(PADDING.left, PADDING.top, plotW, plotH)
    ctx.clip()

    if (showFormationFills) drawFormationFills(ctx, subsidenceCurves, timeToX, depthToY)
    if (showBurialCurves) drawBurialCurves(ctx, subsidenceCurves, timeToX, depthToY)

    ctx.restore()

    drawFormationLabels(ctx, subsidenceCurves, PADDING.left + plotW, depthToY)
  }, [subsidenceCurves, maxAge, effectiveMinDepthM, effectiveMaxDepthM, showFormationFills, showBurialCurves])

  const canvasRef = useCanvasRenderer(draw, [draw])

  return (
    <div ref={containerRef} className="subsidence-canvas-container">
      {wellName && (
        <div
          className={`subsidence-chart-title subsidence-chart-title--clickable${isSelected ? ' subsidence-chart-title--selected' : ''}`}
          onClick={handleTitleClick}
        >
          {wellName} — Total subsidence
        </div>
      )}
      <GeologicalTimescale
        timeRange={{ min_ma: 0, max_ma: maxAge }}
        height={TIMESCALE_HEIGHT}
        paddingLeft={PADDING.left}
        paddingRight={PADDING.right}
      />
      <div
        className="subsidence-canvas-wrapper"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <canvas ref={canvasRef} className="subsidence-canvas" />
        <canvas ref={crosshairRef} className="subsidence-canvas subsidence-canvas--crosshair" />
      </div>
    </div>
  )
}
