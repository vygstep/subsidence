import { useEffect } from 'react'

import { useCanvasRenderer, useDepthScale } from '@/hooks'
import { drawDepthGridlines, drawDepthLabels } from '@/renderers'
import { useViewStore } from '@/stores'

interface DepthTrackProps {
  height?: number
}

export function DepthTrack({ height = 1000 }: DepthTrackProps) {
  const visibleDepthRange = useViewStore((state) => state.visibleDepthRange)
  const setViewportHeight = useViewStore((state) => state.setViewportHeight)
  const { scale: depthScale } = useDepthScale(visibleDepthRange, height)

  useEffect(() => {
    setViewportHeight(height)
  }, [height, setViewportHeight])

  const canvasRef = useCanvasRenderer(
    (ctx, width, canvasHeight) => {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, canvasHeight)
      drawDepthGridlines(ctx, depthScale, width, 100, 10)
      drawDepthLabels(ctx, depthScale, width, 100)
    },
    [depthScale],
  )

  return <canvas ref={canvasRef} className="depth-track" style={{ height }} />
}
