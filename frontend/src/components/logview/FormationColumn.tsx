import { useMemo } from 'react'

import { useCanvasRenderer, useDepthScale } from '@/hooks'
import { useViewStore } from '@/stores'
import { drawLithologyBlock } from '@/renderers'
import type { FormationTop, LithologyType } from '@/types'

interface FormationColumnProps {
  formations: FormationTop[]
  height: number
  maxDepth: number
  width?: number
}

function toRenderableLithology(lithology: LithologyType | undefined) {
  if (lithology === 'metamorphic') {
    return undefined
  }
  return lithology
}

export function FormationColumn({ formations, height, maxDepth, width = 80 }: FormationColumnProps) {
  const visibleDepthRange = useViewStore((state) => state.visibleDepthRange)

  const orderedFormations = useMemo(
    () => [...formations].sort((left, right) => left.depth_md - right.depth_md),
    [formations],
  )

  const { scale: depthScale } = useDepthScale(visibleDepthRange, height)

  const canvasRef = useCanvasRenderer(
    (ctx, canvasWidth, canvasHeight) => {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)

      if (orderedFormations.length === 0) {
        return
      }

      orderedFormations.forEach((formation, index) => {
        const nextDepth = orderedFormations[index + 1]?.depth_md ?? maxDepth
        const blockTop = Math.max(formation.depth_md, visibleDepthRange.min)
        const blockBottom = Math.min(nextDepth, visibleDepthRange.max)

        if (blockBottom <= blockTop) {
          return
        }

        const yTop = depthScale(blockTop)
        const yBottom = depthScale(blockBottom)
        const blockHeight = yBottom - yTop

        drawLithologyBlock(
          ctx,
          toRenderableLithology(formation.lithology),
          formation.color,
          0,
          yTop,
          canvasWidth,
          blockHeight,
        )

        if (blockHeight < 28) {
          return
        }

        ctx.save()
        ctx.fillStyle = '#17212b'
        ctx.font = '600 11px Segoe UI'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(formation.name, canvasWidth / 2, yTop + blockHeight / 2, canvasWidth - 8)
        ctx.restore()
      })
    },
    [depthScale, maxDepth, orderedFormations, visibleDepthRange.max, visibleDepthRange.min],
  )

  return <canvas ref={canvasRef} className="formation-column" style={{ width, height }} />
}
