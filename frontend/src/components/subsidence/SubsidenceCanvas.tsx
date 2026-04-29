import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useCanvasRenderer } from '@/hooks/useCanvasRenderer'
import { drawBurialCurves, drawFormationFills } from '@/renderers/subsidenceRenderer'
import { useComputedStore, useViewStore } from '@/stores'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useWellDataStore } from '@/stores/wellDataStore'
import type { SeaLevelPoint } from '@/types'
import type { SubsidenceResult } from '@/types/subsidence'
import { GeologicalTimescale } from './GeologicalTimescale'

const TIMESCALE_HEIGHT = 52
const PADDING_BASE = { top: 12, right: 100, bottom: 48, left: 64 }
const SEA_LEVEL_AXIS_EXTRA = 70

type Padding = typeof PADDING_BASE

function drawAxes(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  maxAge: number,
  minDepthM: number,
  maxDepthM: number,
  timeToX: (age: number) => number,
  depthToY: (depthM: number) => number,
  padding: Padding,
) {
  const plotW = width - padding.left - padding.right
  const plotH = height - padding.top - padding.bottom

  ctx.save()
  ctx.strokeStyle = '#94a3b8'
  ctx.lineWidth = 1

  // Y axis
  ctx.beginPath()
  ctx.moveTo(padding.left, padding.top)
  ctx.lineTo(padding.left, padding.top + plotH)
  ctx.stroke()

  // X axis
  ctx.beginPath()
  ctx.moveTo(padding.left, padding.top + plotH)
  ctx.lineTo(padding.left + plotW, padding.top + plotH)
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
    ctx.moveTo(padding.left - 4, y)
    ctx.lineTo(padding.left, y)
    ctx.stroke()
    const label = Number.isInteger(depthStepKm) ? `${dKm}` : dKm.toFixed(1)
    ctx.fillText(label, padding.left - 6, y)
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'

  // X tick marks — age Ma, right=0, left=maxAge
  const ageStep = niceStep(maxAge, 5)
  for (let age = 0; age <= maxAge + ageStep * 0.01; age += ageStep) {
    const x = timeToX(age)
    ctx.beginPath()
    ctx.moveTo(x, padding.top + plotH)
    ctx.lineTo(x, padding.top + plotH + 4)
    ctx.stroke()
    ctx.fillText(`${age}`, x, padding.top + plotH + 6)
  }

  // Y axis label — "Depth (km)"
  ctx.save()
  ctx.font = '11px system-ui, sans-serif'
  ctx.fillStyle = '#94a3b8'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const midY = padding.top + plotH / 2
  ctx.translate(14, midY)
  ctx.rotate(-Math.PI / 2)
  ctx.fillText('Depth (km)', 0, 0)
  ctx.restore()

  // X axis label — "Age (Ma)"
  ctx.font = '11px system-ui, sans-serif'
  ctx.fillStyle = '#94a3b8'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText('Age (Ma)', padding.left + plotW / 2, height - 4)

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

interface SeaLevelAxisData {
  sorted: SeaLevelPoint[]
  slToY: (sl: number) => number
  minSL: number
  maxSL: number
}

function drawSeaLevelAxis(
  ctx: CanvasRenderingContext2D,
  data: SeaLevelAxisData,
  width: number,
  height: number,
  padding: Padding,
) {
  const plotH = height - padding.top - padding.bottom
  const axisX = width - SEA_LEVEL_AXIS_EXTRA + 2

  ctx.save()
  ctx.strokeStyle = '#0891b2'
  ctx.lineWidth = 1

  ctx.beginPath()
  ctx.moveTo(axisX, padding.top)
  ctx.lineTo(axisX, padding.top + plotH)
  ctx.stroke()

  ctx.fillStyle = '#0891b2'
  ctx.font = '10px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'

  const slStep = niceStep(data.maxSL - data.minSL || 1, 5)
  const firstTick = Math.ceil(data.minSL / slStep) * slStep
  for (let sl = firstTick; sl <= data.maxSL + slStep * 0.01; sl += slStep) {
    const y = data.slToY(sl)
    if (y < padding.top - 1 || y > padding.top + plotH + 1) continue
    ctx.beginPath()
    ctx.moveTo(axisX, y)
    ctx.lineTo(axisX + 4, y)
    ctx.stroke()
    const label = Number.isInteger(slStep) ? `${sl}` : sl.toFixed(1)
    ctx.fillText(label, axisX + 6, y)
  }

  ctx.save()
  ctx.font = '11px system-ui, sans-serif'
  ctx.fillStyle = '#0891b2'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.translate(width - 8, padding.top + plotH / 2)
  ctx.rotate(Math.PI / 2)
  ctx.fillText('Sea level (m)', 0, 0)
  ctx.restore()

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
  const paddingRightRef = useRef(PADDING_BASE.right)

  const subsidenceCurves = useComputedStore((s) => s.subsidenceCurves)
  const showFormationFills = useComputedStore((s) => s.showFormationFills)
  const showBurialCurves = useComputedStore((s) => s.showBurialCurves)

  const subsidenceDepthMinM = useViewStore((s) => s.subsidenceSingleDepthMin)
  const subsidenceDepthMaxM = useViewStore((s) => s.subsidenceSingleDepthMax)
  const showSeaLevel = useViewStore((s) => s.subsidenceSingleShowSeaLevel)
  const activeModelType = useViewStore((s) => s.activeSubsidenceModelType)
  const modelConfig = useViewStore((s) => s.subsidenceModelConfigs[s.activeSubsidenceModelType])

  const wellName = useWellDataStore((s) => s.well?.well_name ?? null)
  const formations = useWellDataStore((s) => s.formations)
  const wellInventories = useWellDataStore((s) => s.wellInventories)
  const well = useWellDataStore((s) => s.well)
  const loadSeaLevelPoints = useWellDataStore((s) => s.loadSeaLevelPoints)

  const selectedObject = useWorkspaceStore((s) => s.selectedObject)
  const setSelectedObject = useWorkspaceStore((s) => s.setSelectedObject)

  const isSelected = selectedObject?.type === 'subsidence-chart' && selectedObject.chartType === 'single'

  const handleTitleClick = useCallback(() => {
    setSelectedObject(isSelected ? null : { type: 'subsidence-chart', chartType: 'single' })
  }, [isSelected, setSelectedObject])

  // Resolve sea-level curve ID: model config override → well's active curve
  const seaLevelCurveId = useMemo(() => {
    if (modelConfig.seaLevelCurveId !== null) return modelConfig.seaLevelCurveId
    const inv = wellInventories.find((w) => w.well_id === well?.well_id)
    return inv?.active_sea_level_curve_id ?? null
  }, [modelConfig.seaLevelCurveId, wellInventories, well?.well_id])

  const [seaLevelPoints, setSeaLevelPoints] = useState<SeaLevelPoint[]>([])

  useEffect(() => {
    if (!showSeaLevel || seaLevelCurveId === null) {
      setSeaLevelPoints([])
      return
    }
    let cancelled = false
    loadSeaLevelPoints(seaLevelCurveId)
      .then((pts) => { if (!cancelled) setSeaLevelPoints(pts) })
      .catch(() => { if (!cancelled) setSeaLevelPoints([]) })
    return () => { cancelled = true }
  }, [showSeaLevel, seaLevelCurveId, loadSeaLevelPoints])

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
  paddingRightRef.current = showSeaLevel ? PADDING_BASE.right + SEA_LEVEL_AXIS_EXTRA : PADDING_BASE.right

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
    const paddingRight = paddingRightRef.current
    const plotW = w - PADDING_BASE.left - paddingRight
    const plotH = h - PADDING_BASE.top - PADDING_BASE.bottom
    if (plotW <= 0 || plotH <= 0) return
    if (cssX < PADDING_BASE.left || cssX > PADDING_BASE.left + plotW) return
    if (cssY < PADDING_BASE.top || cssY > PADDING_BASE.top + plotH) return

    const age = currentMaxAge * (1 - (cssX - PADDING_BASE.left) / plotW)
    const depthM = currentMinDepthM + (currentMaxDepthM - currentMinDepthM) * (cssY - PADDING_BASE.top) / plotH

    ctx.save()
    ctx.scale(ratio, ratio)

    // Crosshair lines
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)'
    ctx.lineWidth = 0.75
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(PADDING_BASE.left, cssY)
    ctx.lineTo(PADDING_BASE.left + plotW, cssY)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cssX, PADDING_BASE.top)
    ctx.lineTo(cssX, PADDING_BASE.top + plotH)
    ctx.stroke()
    ctx.setLineDash([])

    // Depth readout on Y axis
    const depthLabel = depthM < 1000
      ? `${Math.round(depthM)} m`
      : `${(depthM / 1000).toFixed(2)} km`
    ctx.font = 'bold 9px system-ui, sans-serif'
    const dw = ctx.measureText(depthLabel).width + 6
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(PADDING_BASE.left - dw - 2, cssY - 8, dw, 16)
    ctx.fillStyle = '#f8fafc'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText(depthLabel, PADDING_BASE.left - 5, cssY)

    // Age readout on X axis
    const ageLabel = `${age.toFixed(1)} Ma`
    ctx.font = 'bold 9px system-ui, sans-serif'
    const aw = ctx.measureText(ageLabel).width + 6
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(cssX - aw / 2, PADDING_BASE.top + plotH + 2, aw, 14)
    ctx.fillStyle = '#f8fafc'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(ageLabel, cssX, PADDING_BASE.top + plotH + 4)

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

    const pad: Padding = showSeaLevel
      ? { ...PADDING_BASE, right: PADDING_BASE.right + SEA_LEVEL_AXIS_EXTRA }
      : PADDING_BASE

    const plotW = width - pad.left - pad.right
    const plotH = height - pad.top - pad.bottom
    if (plotW <= 0 || plotH <= 0) return

    const timeToX = (age: number) =>
      pad.left + ((maxAge - age) / (maxAge || 1)) * plotW

    const depthRange = effectiveMaxDepthM - effectiveMinDepthM || 1
    const depthToY = (depthM: number) =>
      pad.top + ((depthM - effectiveMinDepthM) / depthRange) * plotH

    drawAxes(ctx, width, height, maxAge, effectiveMinDepthM, effectiveMaxDepthM, timeToX, depthToY, pad)

    // Compute sea-level mapping before clip (shared between line and axis)
    let slData: SeaLevelAxisData | null = null
    if (showSeaLevel && seaLevelPoints.length > 0) {
      const relevant = seaLevelPoints.filter((p) => p.age_ma >= 0 && p.age_ma <= maxAge)
      if (relevant.length > 0) {
        const minSL = Math.min(...relevant.map((p) => p.sea_level_m))
        const maxSL = Math.max(...relevant.map((p) => p.sea_level_m))
        const slRange = maxSL - minSL || 1
        const slToY = (sl: number) => pad.top + plotH - ((sl - minSL) / slRange) * plotH
        const sorted = [...seaLevelPoints].sort((a, b) => a.age_ma - b.age_ma)
        slData = { sorted, slToY, minSL, maxSL }
      }
    }

    ctx.save()
    ctx.beginPath()
    ctx.rect(pad.left, pad.top, plotW, plotH)
    ctx.clip()

    if (showFormationFills) drawFormationFills(ctx, subsidenceCurves, timeToX, depthToY)
    if (showBurialCurves) drawBurialCurves(ctx, subsidenceCurves, timeToX, depthToY)

    // Sea-level line (inside clip)
    if (slData) {
      ctx.strokeStyle = '#0891b2'
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      let started = false
      for (const pt of slData.sorted) {
        if (pt.age_ma < 0 || pt.age_ma > maxAge) continue
        const x = timeToX(pt.age_ma)
        const y = slData.slToY(pt.sea_level_m)
        if (!started) { ctx.moveTo(x, y); started = true }
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.setLineDash([])
    }

    ctx.restore()

    drawFormationLabels(ctx, subsidenceCurves, pad.left + plotW, depthToY)

    // Sea-level right axis (outside clip)
    if (slData) {
      drawSeaLevelAxis(ctx, slData, width, height, pad)
    }
  }, [subsidenceCurves, maxAge, effectiveMinDepthM, effectiveMaxDepthM, showFormationFills, showBurialCurves, showSeaLevel, seaLevelPoints])

  const canvasRef = useCanvasRenderer(draw, [draw])

  const paddingRight = showSeaLevel ? PADDING_BASE.right + SEA_LEVEL_AXIS_EXTRA : PADDING_BASE.right

  return (
    <div ref={containerRef} className="subsidence-canvas-container">
      {wellName && (
        <div
          className={`subsidence-chart-title subsidence-chart-title--clickable${isSelected ? ' subsidence-chart-title--selected' : ''}`}
          onClick={handleTitleClick}
        >
          {wellName} — {activeModelType === 'total' ? 'Total subsidence' : activeModelType}
        </div>
      )}
      <GeologicalTimescale
        timeRange={{ min_ma: 0, max_ma: maxAge }}
        height={TIMESCALE_HEIGHT}
        paddingLeft={PADDING_BASE.left}
        paddingRight={paddingRight}
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
