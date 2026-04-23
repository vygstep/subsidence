import { useCallback, useEffect, useMemo } from 'react'

import { useCanvasRenderer } from '@/hooks/useCanvasRenderer'
import { useMultiWellStore } from '@/stores/multiWellStore'
import { useWellDataStore } from '@/stores/wellDataStore'

const PADDING = { top: 12, right: 120, bottom: 40, left: 64 }

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

export function MultiWellPanel() {
  const wellResults = useMultiWellStore((s) => s.wellResults)
  const fetchResults = useMultiWellStore((s) => s.fetchResults)
  const activeWellId = useWellDataStore((s) => s.well?.well_id ?? null)

  useEffect(() => {
    void fetchResults()
  }, [fetchResults])

  const maxAge = useMemo(() => {
    let max = 0
    for (const wr of wellResults) {
      for (const curve of wr.curves) {
        for (const pt of curve.burial_path) {
          if (pt.age_ma > max) max = pt.age_ma
        }
      }
    }
    return max > 0 ? max : 100
  }, [wellResults])

  const maxDepthM = useMemo(() => {
    let max = 0
    for (const wr of wellResults) {
      for (const curve of wr.curves) {
        for (const pt of curve.burial_path) {
          if (pt.depth_m > max) max = pt.depth_m
        }
      }
    }
    return max > 0 ? max : 3000
  }, [wellResults])

  const draw = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    const plotW = width - PADDING.left - PADDING.right
    const plotH = height - PADDING.top - PADDING.bottom
    if (plotW <= 0 || plotH <= 0 || wellResults.length === 0) {
      if (wellResults.length === 0) {
        ctx.fillStyle = '#94a3b8'
        ctx.font = '11px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('No stored results — compute subsidence to populate', width / 2, height / 2)
      }
      return
    }

    const timeToX = (age: number) =>
      PADDING.left + ((maxAge - age) / (maxAge || 1)) * plotW

    const depthToY = (depthM: number) =>
      PADDING.top + (depthM / (maxDepthM || 1)) * plotH

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
    const maxDepthKm = maxDepthM / 1000
    const depthStep = niceStep(maxDepthKm, 4)
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (let dKm = 0; dKm <= maxDepthKm + depthStep * 0.01; dKm += depthStep) {
      const y = depthToY(dKm * 1000)
      ctx.beginPath()
      ctx.moveTo(PADDING.left - 4, y)
      ctx.lineTo(PADDING.left, y)
      ctx.stroke()
      ctx.fillText(Number.isInteger(depthStep) ? `${dKm}` : dKm.toFixed(1), PADDING.left - 6, y)
    }

    // X ticks (age Ma)
    const ageStep = niceStep(maxAge, 5)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    for (let age = 0; age <= maxAge + ageStep * 0.01; age += ageStep) {
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

    for (let i = 0; i < wellResults.length; i++) {
      const wr = wellResults[i]
      if (wr.curves.length === 0) continue
      const color = WELL_COLORS[i % WELL_COLORS.length]
      const isActive = wr.wellId === activeWellId

      // deepest formation = last in array
      const curve = wr.curves[wr.curves.length - 1]
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

    for (let i = 0; i < wellResults.length; i++) {
      const wr = wellResults[i]
      const color = WELL_COLORS[i % WELL_COLORS.length]
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
  }, [wellResults, activeWellId, maxAge, maxDepthM])

  const canvasRef = useCanvasRenderer(draw, [draw])

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (wellResults.length === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const cssX = e.clientX - rect.left
    const cssY = e.clientY - rect.top

    // only handle clicks in the legend area (right margin)
    const legendX = rect.width - PADDING.right + 8
    if (cssX < legendX) return

    for (let i = 0; i < wellResults.length; i++) {
      const itemY = PADDING.top + 10 + i * 18
      if (Math.abs(cssY - itemY) < 10) {
        void useWellDataStore.getState().loadWell(wellResults[i].wellId)
        return
      }
    }
  }, [wellResults])

  return (
    <div className="multi-well-panel">
      <canvas ref={canvasRef} className="subsidence-canvas" onClick={handleClick} style={{ cursor: 'pointer' }} />
    </div>
  )
}
