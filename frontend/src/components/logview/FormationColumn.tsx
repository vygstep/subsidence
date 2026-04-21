import { useMemo } from 'react'

import { useCanvasRenderer, useDepthScale } from '@/hooks'
import { useViewStore, useWellDataStore } from '@/stores'
import { drawLithologyBlock } from '@/renderers'
import type { FormationTop, LithologyType } from '@/types'
import { mdToTvd } from '@/utils/depthTransform'

interface FormationColumnProps {
  formations: FormationTop[]
  height: number
  maxDepth: number
  width?: number
  isSelected?: boolean
}

function toRenderableLithology(lithology: LithologyType | undefined) {
  if (lithology === 'metamorphic') {
    return undefined
  }
  return lithology
}

export function FormationColumn({ formations, height, maxDepth, width = 80, isSelected = false }: FormationColumnProps) {
  const visibleDepthRange = useViewStore((state) => state.visibleDepthRange)
  const formationsTrackConfig = useViewStore((state) => state.formationsTrackConfig)
  const depthType = useViewStore((state) => state.depthType)
  const tvdTable = useWellDataStore((state) => state.tvdTable)

  const toDisplayDepth = useMemo(
    () => (depthType === 'TVD' && tvdTable ? (md: number) => mdToTvd(md, tvdTable) : (md: number) => md),
    [depthType, tvdTable],
  )

  const orderedFormations = useMemo(
    () => [...formations].sort((left, right) => left.depth_md - right.depth_md),
    [formations],
  )

  const { scale: depthScale } = useDepthScale(visibleDepthRange, height)

  const canvasRef = useCanvasRenderer(
    (ctx, canvasWidth, canvasHeight) => {
      ctx.fillStyle = formationsTrackConfig.backgroundColor
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)

      if (orderedFormations.length === 0) {
        return
      }

      orderedFormations.forEach((formation, index) => {
        const nextDepth = toDisplayDepth(orderedFormations[index + 1]?.depth_md ?? maxDepth)
        const blockTop = Math.max(toDisplayDepth(formation.depth_md), visibleDepthRange.min)
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
          formation.active_strat_color ?? formation.color,
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
        const label = formationsTrackConfig.nameSource === 'linked-strat-unit'
          ? formation.active_strat_unit_name ?? formation.name
          : formation.name
        ctx.fillText(label, canvasWidth / 2, yTop + blockHeight / 2, canvasWidth - 8)
        ctx.restore()
      })
    },
    [
      depthScale,
      formationsTrackConfig.backgroundColor,
      formationsTrackConfig.nameSource,
      maxDepth,
      orderedFormations,
      toDisplayDepth,
      visibleDepthRange.max,
      visibleDepthRange.min,
    ],
  )

  return <canvas ref={canvasRef} className={`formation-column ${isSelected ? 'formation-column--selected' : ''}`} style={{ width, height }} />
}
