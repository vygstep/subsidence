import { useCanvasRenderer, useDepthScale } from '@/hooks'
import { drawDepthGridlines, drawDepthLabels } from '@/renderers'
import { useViewStore } from '@/stores'

interface DepthTrackProps {
  height: number
  width?: number
}

export function DepthTrack({ height, width = 60 }: DepthTrackProps) {
  const visibleDepthRange = useViewStore((state) => state.visibleDepthRange)
  const { scale: depthScale } = useDepthScale(visibleDepthRange, height)

  const canvasRef = useCanvasRenderer(
    (ctx, canvasWidth, canvasHeight) => {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)
      drawDepthGridlines(ctx, depthScale, canvasWidth, 100, 10)
      drawDepthLabels(ctx, depthScale, canvasWidth, 100)
    },
    [depthScale],
  )

  return <canvas ref={canvasRef} className="depth-track" style={{ width, height }} />
}
