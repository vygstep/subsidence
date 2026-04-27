import { useCallback, useEffect, useRef } from 'react'

import { useViewStore, useWellDataStore } from '@/stores'
import type { CurveData } from '@/types'

const WIDTH = 48

interface WellOverviewMinimapProps {
  height: number
  curves: CurveData[]
}

export function WellOverviewMinimap({ height, curves }: WellOverviewMinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const isDraggingRef = useRef(false)

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
    canvas.width = WIDTH * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    const lo = minDepth.current
    const hi = maxDepth.current
    const depthRange = hi - lo || 1

    function depthToY(depth: number) {
      return ((depth - lo) / depthRange) * height
    }

    ctx.fillStyle = 'rgba(248,250,252,0.94)'
    ctx.fillRect(0, 0, WIDTH, height)

    for (const curve of curves) {
      const { depths, values, null_value } = curve
      if (depths.length < 2) continue

      let vMin = Number.POSITIVE_INFINITY
      let vMax = Number.NEGATIVE_INFINITY
      for (let i = 0; i < values.length; i++) {
        const v = values[i]
        if (!Number.isFinite(v) || v === null_value) continue
        if (v < vMin) vMin = v
        if (v > vMax) vMax = v
      }
      const vRange = vMax - vMin || 1

      ctx.beginPath()
      ctx.strokeStyle = 'rgba(71,85,105,0.45)'
      ctx.lineWidth = 0.75

      let inPath = false
      for (let i = 0; i < depths.length; i++) {
        const v = values[i]
        if (!Number.isFinite(v) || v === null_value) { inPath = false; continue }
        const x = ((v - vMin) / vRange) * (WIDTH - 2) + 1
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
      ctx.lineWidth = 0.75
      ctx.moveTo(0, y)
      ctx.lineTo(WIDTH, y)
      ctx.stroke()
    }

    const viewTop = depthToY(scrollDepth)
    const viewBottom = depthToY(scrollDepth + depthPerPixel * viewportHeight)
    ctx.fillStyle = 'rgba(59,130,246,0.12)'
    ctx.fillRect(0, viewTop, WIDTH, viewBottom - viewTop)
    ctx.strokeStyle = 'rgba(59,130,246,0.6)'
    ctx.lineWidth = 1
    ctx.strokeRect(0.5, viewTop + 0.5, WIDTH - 1, viewBottom - viewTop - 1)
  }, [curves, formations, scrollDepth, depthPerPixel, viewportHeight, height])

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
        width: WIDTH,
        height,
        zIndex: 5,
        cursor: 'ns-resize',
        display: 'block',
        borderLeft: '1px solid #c4d0dc',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  )
}
