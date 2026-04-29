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
  const kbElev = useWellDataStore((state) => state.well?.kb_elev ?? 0)
  const depthBasis = useWellDataStore((state) => state.depthBasis)
  const { scale: depthScale } = useDepthScale(visibleDepthRange, height)

  const unitFactor = depthTrackConfig.unit === 'km' ? 1000 : depthTrackConfig.unit === 'ft' ? 0.3048 : 1
  const majorInterval = Math.max(depthTrackConfig.majorInterval * unitFactor, unitFactor)
  const minorInterval = Math.max(depthTrackConfig.minorInterval * unitFactor, unitFactor / 10)

  const labelTransform = useMemo(() => {
    // In full coordinate mode scroll and ticks are already in target space — no transform needed
    if (depthBasis === depthType) return undefined
    // Label-only fallback (DEPTH-001 behaviour)
    if (depthType === 'TVD') {
      if (tvdTable) return (md: number) => mdToTvd(md, tvdTable)
      return undefined  // vertical well: TVD = MD
    }
    if (depthType === 'TVDSS') {
      if (tvdTable) return (md: number) => mdToTvd(md, tvdTable) - kbElev
      return (md: number) => md - kbElev  // KB-only: TVDSS = MD - KB
    }
    return undefined
  }, [depthBasis, depthType, tvdTable, kbElev])

  const canvasRef = useCanvasRenderer(
    (ctx, canvasWidth, _canvasHeight) => {
      ctx.fillStyle = depthTrackConfig.backgroundColor
      ctx.fillRect(0, 0, canvasWidth, _canvasHeight)
      if (depthTrackConfig.showHorizontalGrid) {
        drawDepthGridlines(ctx, depthScale, canvasWidth, majorInterval, minorInterval, depthTrackConfig.gridColor)
      }
      drawDepthLabels(ctx, depthScale, canvasWidth, majorInterval, depthTrackConfig.unit, labelTransform, depthTrackConfig.labelColor)
    },
    [depthScale, depthTrackConfig, majorInterval, minorInterval, labelTransform],
  )

  return <canvas ref={canvasRef} className={`depth-track ${isSelected ? 'depth-track--selected' : ''}`} style={{ width, height }} />
}
