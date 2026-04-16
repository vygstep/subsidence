import { useCanvasRenderer, useDepthScale } from '@/hooks'
import { drawDepthGridlines, drawDepthLabels } from '@/renderers'
import { useViewStore } from '@/stores'

interface DepthTrackProps {
  // Height must be supplied by the parent (LogViewPanel owns viewport height).
  height: number
}

export function DepthTrack({ height }: DepthTrackProps) {
  const visibleDepthRange = useViewStore((state) => state.visibleDepthRange)
  const { scale: depthScale } = useDepthScale(visibleDepthRange, height)

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
