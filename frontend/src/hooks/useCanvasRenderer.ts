import { useEffect, useRef } from 'react'

export function useCanvasRenderer(
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
  deps: unknown[],
): React.RefObject<HTMLCanvasElement | null> {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    let frameId = 0
    let cancelled = false

    const render = () => {
      if (cancelled) {
        return
      }

      const context = canvas.getContext('2d')
      if (!context) {
        return
      }

      const ratio = window.devicePixelRatio || 1
      const width = canvas.clientWidth || canvas.width || 1
      const height = canvas.clientHeight || canvas.height || 1

      const nextWidth = Math.max(1, Math.round(width * ratio))
      const nextHeight = Math.max(1, Math.round(height * ratio))

      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth
        canvas.height = nextHeight
      }

      context.setTransform(1, 0, 0, 1, 0, 0)
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.scale(ratio, ratio)
      draw(context, width, height)
    }

    const queueRender = () => {
      cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(render)
    }

    const observer = new ResizeObserver(() => {
      queueRender()
    })

    observer.observe(canvas)
    queueRender()

    return () => {
      cancelled = true
      cancelAnimationFrame(frameId)
      observer.disconnect()
    }
  }, [draw, ...deps])

  return canvasRef
}
