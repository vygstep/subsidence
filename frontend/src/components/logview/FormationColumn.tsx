import { useEffect, useMemo, useState } from 'react'

import { useCanvasRenderer, useDepthScale } from '@/hooks'
import { useViewStore, useWellDataStore } from '@/stores'
import { drawLithologyBlock } from '@/renderers'
import type { FormationTop, FormationZone, LithologyPatternEntry, LithologyType } from '@/types'
import { mdToTvd } from '@/utils/depthTransform'

interface FormationColumnProps {
  formations: FormationTop[]
  visibleMarkerFormations?: FormationTop[]
  zones?: FormationZone[] | undefined
  height: number
  maxDepth: number
  width?: number
  isSelected?: boolean
}

function labelAnchor(position: 'left' | 'center' | 'right', width: number): { x: number; align: CanvasTextAlign; maxWidth: number } {
  if (position === 'left') {
    return { x: 5, align: 'left', maxWidth: width - 10 }
  }
  if (position === 'right') {
    return { x: width - 5, align: 'right', maxWidth: width - 10 }
  }
  return { x: width / 2, align: 'center', maxWidth: width - 8 }
}

function toRenderableLithology(lithology: LithologyType | undefined) {
  if (lithology === 'metamorphic') {
    return undefined
  }
  return lithology
}

export function FormationColumn({ formations, visibleMarkerFormations = formations, zones, height, maxDepth, width = 80, isSelected = false }: FormationColumnProps) {
  const visibleDepthRange = useViewStore((state) => state.visibleDepthRange)
  const formationsTrackConfig = useViewStore((state) => state.formationsTrackConfig)
  const tvdTable = useWellDataStore((state) => state.tvdTable)
  const kbElev = useWellDataStore((state) => state.well?.kb_elev ?? 0)
  const depthBasis = useWellDataStore((state) => state.depthBasis)
  const patternPalettes = useWellDataStore((state) => state.lithologyPatternPalettes)
  const fetchPatternPalette = useWellDataStore((state) => state.fetchLithologyPatternPalette)
  const [patterns, setPatterns] = useState<LithologyPatternEntry[]>([])
  const [patternRenderTick, setPatternRenderTick] = useState(0)

  const getFormationTopDepth = useMemo(() => (formation: FormationTop): number => {
    const md = formation.depth_md!
    // Use depthBasis (the committed coordinate of loaded curves), not depthType
    // (the requested mode), so formations and curves always switch together.
    if (depthBasis === 'TVD') {
      if (formation.depth_tvd !== null) return formation.depth_tvd
      if (tvdTable) return mdToTvd(md, tvdTable)
      return md
    }
    if (depthBasis === 'TVDSS') {
      if (formation.depth_tvdss !== null) return formation.depth_tvdss
      if (tvdTable) return mdToTvd(md, tvdTable) - kbElev
      return md - kbElev
    }
    return md
  }, [depthBasis, tvdTable, kbElev])

  const orderedFormations = useMemo(
    () => [...formations].sort((left, right) => (left.depth_md ?? Infinity) - (right.depth_md ?? Infinity)),
    [formations],
  )
  const formationByHorizonId = useMemo(
    () => new Map(formations.filter((formation) => formation.horizon_id !== null).map((formation) => [formation.horizon_id!, formation])),
    [formations],
  )
  const orderedZones = useMemo(
    () => [...(zones ?? [])].sort((left, right) => left.sort_order - right.sort_order),
    [zones],
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
      visibleMarkerFormations.forEach((formation) => {
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

      if (orderedZones.length > 0) {
        orderedZones.forEach((zone) => {
          const formation = formationByHorizonId.get(zone.upper_horizon.id)
          const lowerFormation = formationByHorizonId.get(zone.lower_horizon.id)
          if (!formation || !lowerFormation || formation.depth_md === null || lowerFormation.depth_md === null) return
          const nextDepth = getFormationTopDepth(lowerFormation)
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

          if (blockHeight < 28 || !formationsTrackConfig.showLabels) {
            return
          }

          ctx.save()
          const anchor = labelAnchor(formationsTrackConfig.zoneLabelPosition, canvasWidth)
          ctx.fillStyle = '#17212b'
          ctx.font = '600 11px Segoe UI'
          ctx.textAlign = anchor.align
          ctx.textBaseline = 'middle'
          ctx.fillText(`${zone.upper_horizon.name} - ${zone.lower_horizon.name}`, anchor.x, yTop + blockHeight / 2, anchor.maxWidth)
          ctx.restore()
        })
        return
      }

      if (zones !== undefined) {
        return
      }

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

        if (blockHeight < 28 || !formationsTrackConfig.showLabels) {
          return
        }

        ctx.save()
        const anchor = labelAnchor(formationsTrackConfig.zoneLabelPosition, canvasWidth)
        ctx.fillStyle = '#17212b'
        ctx.font = '600 11px Segoe UI'
        ctx.textAlign = anchor.align
        ctx.textBaseline = 'middle'
        const label = formationsTrackConfig.nameSource === 'linked-strat-unit'
          ? formation.active_strat_unit_name ?? formation.name
          : formation.name
        ctx.fillText(label, anchor.x, yTop + blockHeight / 2, anchor.maxWidth)
        ctx.restore()
      })
    },
    [
      depthScale,
      formationsTrackConfig.backgroundColor,
      formationsTrackConfig.nameSource,
      formationsTrackConfig.showLabels,
      formationsTrackConfig.zoneLabelPosition,
      maxDepth,
      formationByHorizonId,
      orderedFormations,
      orderedZones,
      patternByCode,
      patternRenderTick,
      getFormationTopDepth,
      visibleMarkerFormations,
      visibleDepthRange.max,
      visibleDepthRange.min,
    ],
  )

  return <canvas ref={canvasRef} className={`formation-column ${isSelected ? 'formation-column--selected' : ''}`} style={{ width, height }} />
}
