import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { logDiagnosticEvent } from '@/utils/diagnostics'
import { useCanvasRenderer } from '@/hooks/useCanvasRenderer'
import { useMultiWellStore } from '@/stores/multiWellStore'
import { useViewStore } from '@/stores/viewStore'
import { useWellDataStore } from '@/stores/wellDataStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import type { StratUnitOption } from '@/types'
import { applyGlobalStratCutoffs, clampRangeToBounds, curveDepthExtent, paddedDepthExtent, panRange, resolveRange, zoomRangeAround } from '@/utils/subsidenceChartDomain'
import { GeologicalTimescale } from './GeologicalTimescale'

const PADDING = { top: 12, right: 120, bottom: 40, left: 64 }
const TIMESCALE_HEIGHT = 52

const WELL_COLORS = [
  '#2196f3', '#e63946', '#43a047', '#ff9800', '#9c27b0', '#00bcd4',
  '#ff5722', '#607d8b', '#8bc34a', '#f06292',
]

function niceStep(range: number, targetTicks: number): number {
  if (range <= 0) return 1
  const raw = range / targetTicks
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  if (norm < 1.5) return mag
  if (norm < 3.5) return 2 * mag
  if (norm < 7.5) return 5 * mag
  return 10 * mag
}

async function fetchStratUnits(chartId: number): Promise<StratUnitOption[]> {
  const params = new URLSearchParams({ chart_id: String(chartId), limit: '1000' })
  const response = await fetch(`/api/strat-units?${params.toString()}`)
  if (!response.ok) {
    throw new Error(`Failed to load strat units (${response.status})`)
  }
  return (await response.json()) as StratUnitOption[]
}

function reconstructAgeForUnit(unit: StratUnitOption | null): number | null {
  if (unit === null) return null
  return unit.age_base_ma ?? unit.age_top_ma ?? null
}

function truncateAgeForUnit(unit: StratUnitOption | null): number | null {
  if (unit === null) return null
  return unit.age_top_ma ?? unit.age_base_ma ?? null
}

export function MultiWellPanel() {
  const wellResults = useMultiWellStore((s) => s.wellResults)
  const fetchResults = useMultiWellStore((s) => s.fetchResults)
  const activeWellId = useWellDataStore((s) => s.well?.well_id ?? null)
  const wellInventories = useWellDataStore((s) => s.wellInventories)
  const stratCharts = useWellDataStore((s) => s.stratCharts)
  const subsidenceDepthMinM = useViewStore((s) => s.subsidenceMultiDepthMin)
  const subsidenceDepthMaxM = useViewStore((s) => s.subsidenceMultiDepthMax)
  const subsidenceAgeMinMa = useViewStore((s) => s.subsidenceMultiAgeMin)
  const subsidenceAgeMaxMa = useViewStore((s) => s.subsidenceMultiAgeMax)
  const subsidenceViewport = useViewStore((s) => s.subsidenceMultiViewport)
  const reconstructStratUnitId = useViewStore((s) => s.subsidenceReconstructStratUnitId)
  const truncateBelowStratUnitId = useViewStore((s) => s.subsidenceTruncateBelowStratUnitId)
  const setSubsidenceViewport = useViewStore((s) => s.setSubsidenceMultiViewport)
  const setSubsidenceDisplayedRange = useViewStore((s) => s.setSubsidenceMultiDisplayedRange)

  const selectedObject = useWorkspaceStore((s) => s.selectedObject)
  const setSelectedObject = useWorkspaceStore((s) => s.setSelectedObject)

  const isSelected = selectedObject?.type === 'subsidence-chart' && selectedObject.chartType === 'multi'
  const wellColorById = useMemo(() => (
    new Map(wellInventories.map((well) => [well.well_id, well.color_hex]))
  ), [wellInventories])
  const activeStratChartId = stratCharts.find((chart) => chart.is_active)?.id ?? null
  const [stratUnits, setStratUnits] = useState<StratUnitOption[]>([])

  useEffect(() => {
    if (activeStratChartId === null) {
      setStratUnits([])
      return
    }

    let cancelled = false
    void fetchStratUnits(activeStratChartId)
      .then((rows) => {
        if (!cancelled) setStratUnits(rows)
      })
      .catch(() => {
        if (!cancelled) setStratUnits([])
      })

    return () => { cancelled = true }
  }, [activeStratChartId])

  const stratUnitById = useMemo(() => new Map(stratUnits.map((unit) => [unit.id, unit])), [stratUnits])
  const reconstructAgeMa = reconstructAgeForUnit(
    reconstructStratUnitId !== null ? stratUnitById.get(reconstructStratUnitId) ?? null : null,
  )
  const truncateBelowAgeMa = truncateAgeForUnit(
    truncateBelowStratUnitId !== null ? stratUnitById.get(truncateBelowStratUnitId) ?? null : null,
  )

  const visibleWellResults = useMemo(() => (
    wellResults.map((result) => {
      return {
        ...result,
        curves: applyGlobalStratCutoffs(result.curves, { reconstructAgeMa, truncateBelowAgeMa }),
      }
    })
  ), [reconstructAgeMa, truncateBelowAgeMa, wellResults])

  const handleTitleClick = useCallback(() => {
    setSelectedObject(isSelected ? null : { type: 'subsidence-chart', chartType: 'multi' })
  }, [isSelected, setSelectedObject])

  const crosshairRef = useRef<HTMLCanvasElement>(null)
  const maxAgeRef = useRef(100)
  const minDepthMRef = useRef(0)
  const maxDepthMRef = useRef(3000)
  const panStartRef = useRef<{
    x: number
    y: number
    age: { min: number; max: number }
    depth: { min: number; max: number }
  } | null>(null)

  useEffect(() => {
    void fetchResults()
  }, [fetchResults])

  useEffect(() => {
    if (visibleWellResults.length === 0) return
    logDiagnosticEvent({
      level: 'info',
      operation: 'subsidence.visualize.multi',
      phase: 'event',
      details: {
        wellCount: visibleWellResults.length,
        wells: visibleWellResults.map(wr => {
          const allDepths = wr.curves.flatMap(c => c.burial_path.map(p => p.depth_m))
          return {
            wellId: wr.wellId,
            wellName: wr.wellName,
            curveCount: wr.curves.length,
            maxDepthM: allDepths.length > 0 ? Math.max(...allDepths) : 0,
          }
        }),
      },
    })
  }, [visibleWellResults])

  const maxAge = useMemo(() => {
    let max = 0
    for (const wr of visibleWellResults) {
      for (const curve of wr.curves) {
        for (const pt of curve.burial_path) {
          if (pt.age_ma > max) max = pt.age_ma
        }
      }
    }
    return max > 0 ? max : 100
  }, [visibleWellResults])
  const minAge = useMemo(() => {
    let min = Infinity
    for (const wr of visibleWellResults) {
      for (const curve of wr.curves) {
        for (const pt of curve.burial_path) {
          if (Number.isFinite(pt.age_ma) && pt.age_ma < min) min = pt.age_ma
        }
      }
    }
    return Number.isFinite(min) ? Math.max(0, min) : 0
  }, [visibleWellResults])

  const autoDepthExtentM = useMemo(() => {
    return paddedDepthExtent(curveDepthExtent(visibleWellResults.flatMap((wr) => wr.curves)))
  }, [visibleWellResults])

  const baseDepthRangeM = resolveRange(autoDepthExtentM, subsidenceDepthMinM, subsidenceDepthMaxM)
  const autoAgeExtentMa = { min: minAge, max: maxAge }
  const baseAgeRangeMa = resolveRange(autoAgeExtentMa, subsidenceAgeMinMa, subsidenceAgeMaxMa)
  const viewportDepthRangeM = subsidenceViewport
    ? clampRangeToBounds({ min: subsidenceViewport.depthMinM, max: subsidenceViewport.depthMaxM }, baseDepthRangeM)
    : null
  const viewportAgeRangeMa = subsidenceViewport
    ? clampRangeToBounds({ min: subsidenceViewport.ageMinMa, max: subsidenceViewport.ageMaxMa }, baseAgeRangeMa)
    : null
  const depthRangeM = viewportDepthRangeM
    ? viewportDepthRangeM
    : baseDepthRangeM
  const ageRangeMa = viewportAgeRangeMa
    ? viewportAgeRangeMa
    : baseAgeRangeMa
  const effectiveMinDepthM = depthRangeM.min
  const effectiveMaxDepthM = depthRangeM.max
  const effectiveMinAgeMa = ageRangeMa.min
  const effectiveMaxAgeMa = ageRangeMa.max

  useEffect(() => {
    maxAgeRef.current = effectiveMaxAgeMa
    minDepthMRef.current = effectiveMinDepthM
    maxDepthMRef.current = effectiveMaxDepthM
    setSubsidenceDisplayedRange({
      ageMinMa: effectiveMinAgeMa,
      ageMaxMa: effectiveMaxAgeMa,
      depthMinM: effectiveMinDepthM,
      depthMaxM: effectiveMaxDepthM,
    })
  }, [effectiveMaxAgeMa, effectiveMaxDepthM, effectiveMinAgeMa, effectiveMinDepthM, setSubsidenceDisplayedRange])

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

    const age = effectiveMinAgeMa + (currentMaxAge - effectiveMinAgeMa) * (1 - (cssX - PADDING.left) / plotW)
    const depthM = currentMinDepthM + (currentMaxDepthM - currentMinDepthM) * (cssY - PADDING.top) / plotH

    ctx.save()
    ctx.scale(ratio, ratio)

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
  }, [effectiveMinAgeMa])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    drawCrosshair(e.clientX - rect.left, e.clientY - rect.top)
  }, [drawCrosshair])

  const handleMouseLeave = useCallback(() => {
    drawCrosshair(null, null)
  }, [drawCrosshair])

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const plotW = rect.width - PADDING.left - PADDING.right
    const plotH = rect.height - PADDING.top - PADDING.bottom
    if (plotW <= 0 || plotH <= 0) return

    const cssX = e.clientX - rect.left
    const cssY = e.clientY - rect.top
    if (cssX < PADDING.left || cssX > PADDING.left + plotW) return
    if (cssY < PADDING.top || cssY > PADDING.top + plotH) return

    e.preventDefault()
    const zoomFactor = e.deltaY < 0 ? 0.85 : 1.15
    const ageAnchor = 1 - ((cssX - PADDING.left) / plotW)
    const depthAnchor = (cssY - PADDING.top) / plotH
    const nextAge = clampRangeToBounds(
      zoomRangeAround({ min: effectiveMinAgeMa, max: effectiveMaxAgeMa }, ageAnchor, zoomFactor, 0.1),
      baseAgeRangeMa,
    )
    const nextDepth = clampRangeToBounds(
      zoomRangeAround({ min: effectiveMinDepthM, max: effectiveMaxDepthM }, depthAnchor, zoomFactor, 1),
      baseDepthRangeM,
    )

    setSubsidenceViewport({
      ageMinMa: nextAge.min,
      ageMaxMa: nextAge.max,
      depthMinM: nextDepth.min,
      depthMaxM: nextDepth.max,
    })
  }, [
    baseAgeRangeMa,
    baseDepthRangeM,
    effectiveMaxAgeMa,
    effectiveMaxDepthM,
    effectiveMinAgeMa,
    effectiveMinDepthM,
    setSubsidenceViewport,
  ])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 1) return
    const rect = e.currentTarget.getBoundingClientRect()
    const plotW = rect.width - PADDING.left - PADDING.right
    const plotH = rect.height - PADDING.top - PADDING.bottom
    if (plotW <= 0 || plotH <= 0) return
    const cssX = e.clientX - rect.left
    const cssY = e.clientY - rect.top
    if (cssX < PADDING.left || cssX > PADDING.left + plotW) return
    if (cssY < PADDING.top || cssY > PADDING.top + plotH) return

    e.preventDefault()
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      age: { min: effectiveMinAgeMa, max: effectiveMaxAgeMa },
      depth: { min: effectiveMinDepthM, max: effectiveMaxDepthM },
    }

    const onMove = (event: MouseEvent) => {
      const start = panStartRef.current
      if (start === null) return
      const dx = event.clientX - start.x
      const dy = event.clientY - start.y
      const ageSpan = start.age.max - start.age.min
      const depthSpan = start.depth.max - start.depth.min
      const ageDelta = dx / plotW * ageSpan
      const depthDelta = -dy / plotH * depthSpan
      const nextAge = panRange(start.age, ageDelta, baseAgeRangeMa)
      const nextDepth = panRange(start.depth, depthDelta, baseDepthRangeM)
      setSubsidenceViewport({
        ageMinMa: nextAge.min,
        ageMaxMa: nextAge.max,
        depthMinM: nextDepth.min,
        depthMaxM: nextDepth.max,
      })
    }
    const onUp = () => {
      panStartRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [
    baseAgeRangeMa,
    baseDepthRangeM,
    effectiveMaxAgeMa,
    effectiveMaxDepthM,
    effectiveMinAgeMa,
    effectiveMinDepthM,
    setSubsidenceViewport,
  ])

  const draw = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    const plotW = width - PADDING.left - PADDING.right
    const plotH = height - PADDING.top - PADDING.bottom
    if (plotW <= 0 || plotH <= 0 || visibleWellResults.length === 0) {
      if (visibleWellResults.length === 0) {
        ctx.fillStyle = '#94a3b8'
        ctx.font = '11px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('No stored results — compute subsidence to populate', width / 2, height / 2)
      }
      return
    }

    const ageRange = effectiveMaxAgeMa - effectiveMinAgeMa || 1
    const timeToX = (age: number) =>
      PADDING.left + ((effectiveMaxAgeMa - age) / ageRange) * plotW

    const depthRange = effectiveMaxDepthM - effectiveMinDepthM || 1
    const depthToY = (depthM: number) =>
      PADDING.top + ((depthM - effectiveMinDepthM) / depthRange) * plotH

    // Axes
    ctx.save()
    ctx.strokeStyle = '#94a3b8'
    ctx.lineWidth = 1

    ctx.beginPath()
    ctx.moveTo(PADDING.left, PADDING.top)
    ctx.lineTo(PADDING.left, PADDING.top + plotH)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(PADDING.left, PADDING.top + plotH)
    ctx.lineTo(PADDING.left + plotW, PADDING.top + plotH)
    ctx.stroke()

    ctx.fillStyle = '#64748b'
    ctx.font = '10px system-ui, sans-serif'

    // Y ticks (depth in km)
    const minDepthKm = effectiveMinDepthM / 1000
    const maxDepthKm = effectiveMaxDepthM / 1000
    const depthStep = niceStep(maxDepthKm - minDepthKm, 4)
    const firstTickKm = Math.ceil(minDepthKm / depthStep) * depthStep
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (let dKm = firstTickKm; dKm <= maxDepthKm + depthStep * 0.01; dKm += depthStep) {
      const y = depthToY(dKm * 1000)
      ctx.beginPath()
      ctx.moveTo(PADDING.left - 4, y)
      ctx.lineTo(PADDING.left, y)
      ctx.stroke()
      ctx.fillText(Number.isInteger(depthStep) ? `${dKm}` : dKm.toFixed(1), PADDING.left - 6, y)
    }

    // X ticks (age Ma)
    const ageStep = niceStep(effectiveMaxAgeMa - effectiveMinAgeMa, 5)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    const firstAgeTick = Math.ceil(effectiveMinAgeMa / ageStep) * ageStep
    for (let age = firstAgeTick; age <= effectiveMaxAgeMa + ageStep * 0.01; age += ageStep) {
      const x = timeToX(age)
      ctx.beginPath()
      ctx.moveTo(x, PADDING.top + plotH)
      ctx.lineTo(x, PADDING.top + plotH + 4)
      ctx.stroke()
      ctx.fillText(`${age}`, x, PADDING.top + plotH + 6)
    }

    // Axis labels
    ctx.save()
    ctx.font = '11px system-ui, sans-serif'
    ctx.fillStyle = '#94a3b8'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.translate(14, PADDING.top + plotH / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText('Depth (km)', 0, 0)
    ctx.restore()

    ctx.font = '11px system-ui, sans-serif'
    ctx.fillStyle = '#94a3b8'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText('Age (Ma)', PADDING.left + plotW / 2, height - 4)

    ctx.restore()

    // Plot curves (deepest formation per well)
    ctx.save()
    ctx.beginPath()
    ctx.rect(PADDING.left, PADDING.top, plotW, plotH)
    ctx.clip()

    for (let i = 0; i < visibleWellResults.length; i++) {
      const wr = visibleWellResults[i]
      if (wr.curves.length === 0) continue
      const color = wellColorById.get(wr.wellId) ?? WELL_COLORS[i % WELL_COLORS.length]
      const isActive = wr.wellId === activeWellId

      // pick the formation with the greatest burial depth
      const curve = wr.curves.reduce((best, c) => {
        const maxD = c.burial_path.reduce((m, p) => Math.max(m, p.depth_m), 0)
        const bestD = best.burial_path.reduce((m, p) => Math.max(m, p.depth_m), 0)
        return maxD > bestD ? c : best
      }, wr.curves[0])
      const path = [...curve.burial_path].sort((a, b) => b.age_ma - a.age_ma)

      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.lineWidth = isActive ? 2.5 : 1.5
      ctx.globalAlpha = isActive ? 1 : 0.55
      let first = true
      for (const pt of path) {
        const x = timeToX(pt.age_ma)
        const y = depthToY(pt.depth_m)
        if (first) { ctx.moveTo(x, y); first = false } else { ctx.lineTo(x, y) }
      }
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    ctx.restore()

    // Legend (right margin)
    const legendX = PADDING.left + plotW + 8
    ctx.font = '10px system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'

    for (let i = 0; i < visibleWellResults.length; i++) {
      const wr = visibleWellResults[i]
      const color = wellColorById.get(wr.wellId) ?? WELL_COLORS[i % WELL_COLORS.length]
      const isActive = wr.wellId === activeWellId
      const y = PADDING.top + 10 + i * 18

      ctx.fillStyle = color
      ctx.globalAlpha = isActive ? 1 : 0.55
      ctx.fillRect(legendX, y - 4, 12, 8)
      ctx.globalAlpha = 1

      ctx.fillStyle = isActive ? '#1e293b' : '#64748b'
      ctx.font = isActive ? 'bold 10px system-ui, sans-serif' : '10px system-ui, sans-serif'
      ctx.fillText(wr.wellName, legendX + 16, y)
    }
  }, [visibleWellResults, activeWellId, effectiveMinAgeMa, effectiveMaxAgeMa, effectiveMinDepthM, effectiveMaxDepthM, wellColorById])

  const canvasRef = useCanvasRenderer(draw, [draw])

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (visibleWellResults.length === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const cssX = e.clientX - rect.left
    const cssY = e.clientY - rect.top

    const legendX = rect.width - PADDING.right + 8
    if (cssX < legendX) return

    for (let i = 0; i < visibleWellResults.length; i++) {
      const itemY = PADDING.top + 10 + i * 18
      if (Math.abs(cssY - itemY) < 10) {
        void useWellDataStore.getState().loadWell(visibleWellResults[i].wellId)
        return
      }
    }
  }, [visibleWellResults])

  return (
    <div className="multi-well-panel">
      <div
        className={`subsidence-chart-title subsidence-chart-title--clickable${isSelected ? ' subsidence-chart-title--selected' : ''}`}
        onClick={handleTitleClick}
      >
        Multi-well subsidence chart
      </div>
      <GeologicalTimescale
        timeRange={{ min_ma: effectiveMinAgeMa, max_ma: effectiveMaxAgeMa }}
        height={TIMESCALE_HEIGHT}
        paddingLeft={PADDING.left}
        paddingRight={PADDING.right}
      />
      <div
        className="multi-well-canvas-wrapper"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        style={{ cursor: 'pointer' }}
      >
        <canvas ref={canvasRef} className="subsidence-canvas" />
        <canvas ref={crosshairRef} className="subsidence-canvas subsidence-canvas--crosshair" />
      </div>
    </div>
  )
}
