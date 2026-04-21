import { useMemo } from 'react'

import { useCanvasRenderer, useDepthScale } from '@/hooks'
import { drawDepthGridlines, drawDepthLabels } from '@/renderers'
import { useViewStore, useWellDataStore } from '@/stores'
import { mdToTvd } from '@/utils/depthTransform'

interface DepthTrackProps {
  height: number
  width?: number
  isSelected?: boolean
}

export function DepthTrack({ height, width = 60, isSelected = false }: DepthTrackProps) {
  const visibleDepthRange = useViewStore((state) => state.visibleDepthRange)
  const depthTrackConfig = useViewStore((state) => state.depthTrackConfig)
  const depthType = useViewStore((state) => state.depthType)
  const tvdTable = useWellDataStore((state) => state.tvdTable)
  const { scale: depthScale } = useDepthScale(visibleDepthRange, height)

  const unitFactor = depthTrackConfig.unit === 'km' ? 1000 : depthTrackConfig.unit === 'ft' ? 0.3048 : 1
  const majorInterval = Math.max(depthTrackConfig.majorInterval * unitFactor, unitFactor)
  const minorInterval = Math.max(depthTrackConfig.minorInterval * unitFactor, unitFactor / 10)

  const labelTransform = useMemo(
    () => (depthType === 'TVD' && tvdTable ? (md: number) => mdToTvd(md, tvdTable) : undefined),
    [depthType, tvdTable],
  )

  const canvasRef = useCanvasRenderer(
    (ctx, canvasWidth, canvasHeight) => {
      ctx.fillStyle = depthTrackConfig.backgroundColor
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)
      drawDepthGridlines(ctx, depthScale, canvasWidth, majorInterval, minorInterval)
      drawDepthLabels(ctx, depthScale, canvasWidth, majorInterval, depthTrackConfig.unit, labelTransform)
    },
    [depthScale, depthTrackConfig.backgroundColor, depthTrackConfig.unit, majorInterval, minorInterval, labelTransform],
  )

  return <canvas ref={canvasRef} className={`depth-track ${isSelected ? 'depth-track--selected' : ''}`} style={{ width, height }} />
}
