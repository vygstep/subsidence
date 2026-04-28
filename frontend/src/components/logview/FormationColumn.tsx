import { useEffect, useMemo, useState } from 'react'

import { useCanvasRenderer, useDepthScale } from '@/hooks'
import { useViewStore, useWellDataStore } from '@/stores'
import { drawLithologyBlock } from '@/renderers'
import type { FormationTop, LithologyPatternEntry, LithologyType } from '@/types'
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
  const kbElev = useWellDataStore((state) => state.well?.kb_elev ?? 0)
  const depthBasis = useWellDataStore((state) => state.depthBasis)
  const patternPalettes = useWellDataStore((state) => state.lithologyPatternPalettes)
  const fetchPatternPalette = useWellDataStore((state) => state.fetchLithologyPatternPalette)
  const [patterns, setPatterns] = useState<LithologyPatternEntry[]>([])
  const [patternRenderTick, setPatternRenderTick] = useState(0)

  const getFormationTopDepth = useMemo(() => (formation: FormationTop): number => {
    const md = formation.depth_md!
    if (depthType === 'TVD') {
      // Full coordinate mode: prefer stored DB value
      if (depthBasis === 'TVD' && formation.depth_tvd !== null) return formation.depth_tvd
      if (tvdTable) return mdToTvd(md, tvdTable)
      return md
    }
    if (depthType === 'TVDSS') {
      if (depthBasis === 'TVDSS' && formation.depth_tvdss !== null) return formation.depth_tvdss
      if (tvdTable) return mdToTvd(md, tvdTable) - kbElev
      return md - kbElev
    }
    return md
  }, [depthBasis, depthType, tvdTable, kbElev])

  const orderedFormations = useMemo(
    () => [...formations].sort((left, right) => (left.depth_md ?? Infinity) - (right.depth_md ?? Infinity)),
    [formations],
  )

  useEffect(() => {
    let cancelled = false
    void Promise.all(patternPalettes.map((palette) => fetchPatternPalette(palette.id))).then((details) => {
      if (!cancelled) {
        setPatterns(details.flatMap((palette) => palette?.patterns ?? []))
      }
    })
    return () => {
      cancelled = true
    }
  }, [fetchPatternPalette, patternPalettes])

  const patternByCode = useMemo(() => new Map(patterns.map((pattern) => [pattern.code, pattern])), [patterns])

  const { scale: depthScale } = useDepthScale(visibleDepthRange, height)

  const canvasRef = useCanvasRenderer(
    (ctx, canvasWidth, canvasHeight) => {
      ctx.fillStyle = formationsTrackConfig.backgroundColor
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)

      if (orderedFormations.length === 0) {
        return
      }

      // Render "not picked" badges at top for unpicked formations
      let notPickedOffset = 2
      orderedFormations.forEach((formation) => {
        if (formation.depth_md !== null) return
        const color = formation.active_strat_color ?? formation.color
        const badgeH = 16
        ctx.save()
        ctx.fillStyle = color
        ctx.globalAlpha = 0.7
        ctx.fillRect(2, notPickedOffset, canvasWidth - 4, badgeH)
        ctx.globalAlpha = 1
        ctx.fillStyle = '#ffffff'
        ctx.font = '500 10px Segoe UI'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        const label = formation.name
        ctx.fillText(label, 5, notPickedOffset + badgeH / 2, canvasWidth - 12)
        ctx.restore()
        notPickedOffset += badgeH + 1
      })

      orderedFormations.forEach((formation, index) => {
        if (formation.depth_md === null) return
        const nextFormation = orderedFormations[index + 1]
        const nextDepth = (nextFormation && nextFormation.depth_md !== null)
          ? getFormationTopDepth(nextFormation)
          : maxDepth
        const blockTop = Math.max(getFormationTopDepth(formation), visibleDepthRange.min)
        const blockBottom = Math.min(nextDepth, visibleDepthRange.max)

        if (blockBottom <= blockTop) {
          return
        }

        const yTop = depthScale(blockTop)
        const yBottom = depthScale(blockBottom)
        const blockHeight = yBottom - yTop

        const lithologyCode = toRenderableLithology(formation.lithology)
        const pattern = lithologyCode ? patternByCode.get(lithologyCode) : null
        drawLithologyBlock(
          ctx,
          {
            color: formation.active_strat_color ?? formation.color,
            patternCode: pattern?.code ?? null,
            patternSvg: pattern?.svg_content ?? null,
          },
          0,
          yTop,
          canvasWidth,
          blockHeight,
          () => setPatternRenderTick((value) => value + 1),
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
      patternByCode,
      patternRenderTick,
      getFormationTopDepth,
      visibleDepthRange.max,
      visibleDepthRange.min,
    ],
  )

  return <canvas ref={canvasRef} className={`formation-column ${isSelected ? 'formation-column--selected' : ''}`} style={{ width, height }} />
}
