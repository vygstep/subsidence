import { useCallback, useEffect, useRef } from 'react'

import { useViewStore, useWellDataStore } from '@/stores'

interface WellOverviewMinimapProps {
  width?: number
  height: number
}

export function WellOverviewMinimap({ width = 80, height }: WellOverviewMinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const isDraggingRef = useRef(false)

  const curves = useWellDataStore((s) => s.curves)
  const formations = useWellDataStore((s) => s.formations)
  const scrollDepth = useViewStore((s) => s.scrollDepth)
  const depthPerPixel = useViewStore((s) => s.depthPerPixel)
  const viewportHeight = useViewStore((s) => s.viewportHeight)
  const setScroll = useViewStore((s) => s.setScroll)

  const minDepth = useRef(0)
  const maxDepth = useRef(1)

  useEffect(() => {
    if (curves.length === 0) return
    let lo = Number.POSITIVE_INFINITY
    let hi = Number.NEGATIVE_INFINITY
    for (const c of curves) {
      if (c.depths.length > 0) {
        lo = Math.min(lo, c.depths[0])
        hi = Math.max(hi, c.depths[c.depths.length - 1])
      }
    }
    if (Number.isFinite(lo)) minDepth.current = lo
    if (Number.isFinite(hi)) maxDepth.current = hi
  }, [curves])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    const lo = minDepth.current
    const hi = maxDepth.current
    const depthRange = hi - lo || 1

    function depthToY(depth: number) {
      return ((depth - lo) / depthRange) * height
    }

    ctx.fillStyle = '#1e293b'
    ctx.fillRect(0, 0, width, height)

    for (const curve of curves) {
      const { depths, values, null_value } = curve
      if (depths.length < 2) continue

      ctx.beginPath()
      ctx.strokeStyle = 'rgba(148,163,184,0.6)'
      ctx.lineWidth = 1

      let vMin = Number.POSITIVE_INFINITY
      let vMax = Number.NEGATIVE_INFINITY
      for (let i = 0; i < values.length; i++) {
        const v = values[i]
        if (!Number.isFinite(v) || v === null_value) continue
        if (v < vMin) vMin = v
        if (v > vMax) vMax = v
      }
      const vRange = vMax - vMin || 1

      let inPath = false
      for (let i = 0; i < depths.length; i++) {
        const v = values[i]
        if (!Number.isFinite(v) || v === null_value) { inPath = false; continue }
        const x = ((v - vMin) / vRange) * (width - 2) + 1
        const y = depthToY(depths[i])
        if (!inPath) { ctx.moveTo(x, y); inPath = true }
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    for (const f of formations) {
      if (f.depth_md === null) continue
      const y = depthToY(f.depth_md)
      ctx.beginPath()
      ctx.strokeStyle = f.active_strat_color ?? f.color
      ctx.lineWidth = 1
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    const viewTop = depthToY(scrollDepth)
    const viewBottom = depthToY(scrollDepth + depthPerPixel * viewportHeight)
    ctx.fillStyle = 'rgba(59,130,246,0.20)'
    ctx.fillRect(0, viewTop, width, viewBottom - viewTop)
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 1
    ctx.strokeRect(0.5, viewTop + 0.5, width - 1, viewBottom - viewTop - 1)
  }, [curves, formations, scrollDepth, depthPerPixel, viewportHeight, width, height])

  const scrollToOffsetY = useCallback((offsetY: number) => {
    const lo = minDepth.current
    const hi = maxDepth.current
    const depthRange = hi - lo || 1
    const depth = lo + (offsetY / height) * depthRange
    const visibleSpan = depthPerPixel * viewportHeight
    setScroll(depth - visibleSpan / 2)
  }, [height, depthPerPixel, viewportHeight, setScroll])

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    isDraggingRef.current = true
    const rect = e.currentTarget.getBoundingClientRect()
    scrollToOffsetY(e.clientY - rect.top)
  }, [scrollToOffsetY])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    scrollToOffsetY(e.clientY - rect.top)
  }, [scrollToOffsetY])

  const handlePointerUp = useCallback(() => {
    isDraggingRef.current = false
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        width,
        height,
        zIndex: 5,
        cursor: 'ns-resize',
        display: 'block',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  )
}
