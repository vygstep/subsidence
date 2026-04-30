import { scaleLinear, scaleLog, type ScaleLinear, type ScaleLogarithmic } from 'd3-scale'
import { useEffect, useMemo, useState } from 'react'

import { useCanvasRenderer, useDepthScale } from '@/hooks'
import {
  computeGapThreshold,
  drawCurve,
  drawDepthGridlines,
  drawFillBetweenCurves,
  drawFillToBaseline,
  drawLinearGrid,
  drawLogarithmicGrid,
} from '@/renderers'
import { drawDiscreteBlocks } from '@/renderers/discreteBlockRenderer'
import { drawLithologyComposition, drawLithologyDiscrete, type CompositionBand } from '@/renderers/lithologyCompositionRenderer'
import type { LithologyFillStyle } from '@/renderers/lithologyRenderer'
import type { CurveConfig, CurveData, LithologyPatternEntry, TrackConfig } from '@/types'
import { useViewStore, useWellDataStore } from '@/stores'

interface DataTrackProps {
  config: TrackConfig
  curves: CurveData[]
  width: number
  height: number
}

interface VisibleCurve {
  curve: CurveData
  style: CurveConfig
}

function lowerBound(values: Float32Array, target: number): number {
  let left = 0
  let right = values.length

  while (left < right) {
    const middle = Math.floor((left + right) / 2)
    if (values[middle] < target) {
      left = middle + 1
    } else {
      right = middle
    }
  }

  return left
}

function upperBound(values: Float32Array, target: number): number {
  let left = 0
  let right = values.length

  while (left < right) {
    const middle = Math.floor((left + right) / 2)
    if (values[middle] <= target) {
      left = middle + 1
    } else {
      right = middle
    }
  }

  return left
}

function clipCurve(curve: CurveData, minDepth: number, maxDepth: number): CurveData | null {
  if (curve.depths.length === 0 || curve.values.length === 0) {
    return null
  }

  const startIndex = Math.max(0, lowerBound(curve.depths, minDepth) - 1)
  const endIndex = Math.min(curve.depths.length, upperBound(curve.depths, maxDepth) + 1)

  if (startIndex >= endIndex) {
    return null
  }

  return {
    ...curve,
    depths: curve.depths.subarray(startIndex, endIndex),
    values: curve.values.subarray(startIndex, endIndex),
  }
}

function bisectLeft(arr: Float32Array, target: number): number {
  let lo = 0
  let hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (arr[mid] < target) lo = mid + 1
    else hi = mid
  }
  return lo
}

function interpolateAtDepth(depths: Float32Array, values: Float32Array, target: number): number | null {
  const idx = bisectLeft(depths, target)
  if (idx === 0 || idx >= depths.length) return null
  const t = (target - depths[idx - 1]) / (depths[idx] - depths[idx - 1])
  const v = values[idx - 1] + t * (values[idx] - values[idx - 1])
  return Number.isFinite(v) ? v : null
}

export function DataTrack({ config, curves, width, height }: DataTrackProps) {
  const visibleDepthRange = useViewStore((state) => state.visibleDepthRange)
  const selectedElementId = useViewStore((state) => state.selectedElementId)
  const selectedElementType = useViewStore((state) => state.selectedElementType)
  const selectElement = useViewStore((state) => state.selectElement)
  const clearSelection = useViewStore((state) => state.clearSelection)

  const lithologyDictionaryEntries = useWellDataStore((state) => state.lithologyDictionaryEntries)
  const patternPalettes = useWellDataStore((state) => state.lithologyPatternPalettes)
  const fetchPatternPalette = useWellDataStore((state) => state.fetchLithologyPatternPalette)
  const [patterns, setPatterns] = useState<LithologyPatternEntry[]>([])
  const [patternRenderTick, setPatternRenderTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    void Promise.all(patternPalettes.map((p) => fetchPatternPalette(p.id))).then((details) => {
      if (!cancelled) setPatterns(details.flatMap((d) => d?.patterns ?? []))
    })
    return () => { cancelled = true }
  }, [fetchPatternPalette, patternPalettes])

  const isLithologyTrack = config.track_type === 'lithology'

  const lithologyFillStyles = useMemo<Map<string, LithologyFillStyle>>(() => {
    const patternByCode = new Map(patterns.map((p) => [p.code, p]))
    return new Map(
      lithologyDictionaryEntries.map((e) => [
        e.lithology_code,
        {
          color: e.color_hex,
          patternCode: e.pattern_id ?? null,
          patternSvg: e.pattern_id ? (patternByCode.get(e.pattern_id)?.svg_content ?? null) : null,
        } satisfies LithologyFillStyle,
      ]),
    )
  }, [lithologyDictionaryEntries, patterns])

  const visibleCurves = useMemo<VisibleCurve[]>(() => {
    const requestedMnemonics = new Map(config.curves.map((curve) => [curve.mnemonic, curve]))

    return curves.flatMap((curve) => {
      const style = requestedMnemonics.get(curve.mnemonic)
      return style ? [{ curve, style }] : []
    })
  }, [config.curves, curves])

  const depthWindow = useMemo(() => {
    const span = Math.max(visibleDepthRange.max - visibleDepthRange.min, 1)
    const buffer = span * 0.1

    return {
      min: visibleDepthRange.min - buffer,
      max: visibleDepthRange.max + buffer,
    }
  }, [visibleDepthRange])

  const clippedCurves = useMemo(
    () => visibleCurves.flatMap(({ curve, style }) => {
      const clipped = clipCurve(curve, depthWindow.min, depthWindow.max)
      return clipped ? [{ curve: clipped, style }] : []
    }),
    [depthWindow.max, depthWindow.min, visibleCurves],
  )

  const clippedCurveMap = useMemo(
    () => new Map(clippedCurves.map((entry) => [entry.style.mnemonic, entry])),
    [clippedCurves],
  )

  const curveGapThresholds = useMemo(
    () => new Map(visibleCurves.map(({ curve, style }) => [style.mnemonic, computeGapThreshold(curve.depths, 5)])),
    [visibleCurves],
  )

  const { scale: depthScale } = useDepthScale(visibleDepthRange, height)

  const curveScales = useMemo(() => {
    return new Map<string, ScaleLinear<number, number> | ScaleLogarithmic<number, number>>(
      config.curves.map((curveConfig) => {
        const range: [number, number] = curveConfig.scaleReversed ? [width, 0] : [0, width]
        const domain: [number, number] = [curveConfig.scaleMin, curveConfig.scaleMax]
        const scale =
          config.scaleType === 'logarithmic'
            ? scaleLog().domain(domain).range(range)
            : scaleLinear().domain(domain).range(range)
        return [curveConfig.mnemonic, scale]
      }),
    )
  }, [config.curves, config.scaleType, width])

  const compositionBands = useMemo<CompositionBand[]>(() => {
    if (!isLithologyTrack) return []
    return clippedCurves
      .filter(({ style }) => !!style.lithology_code)
      .map(({ curve, style }) => ({
        depths: curve.depths,
        values: curve.values,
        nullValue: curve.null_value,
        style: lithologyFillStyles.get(style.lithology_code!) ?? { color: '#cccccc' },
      }))
  }, [isLithologyTrack, clippedCurves, lithologyFillStyles])

  const canvasRef = useCanvasRenderer(
    (ctx, canvasWidth, canvasHeight) => {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)

      if (isLithologyTrack) {
        drawDepthGridlines(ctx, depthScale, canvasWidth, 100, 10)
        if (compositionBands.length > 0) {
          drawLithologyComposition(
            ctx, compositionBands, depthScale, canvasWidth, canvasHeight,
            () => setPatternRenderTick((t) => t + 1),
          )
        }
        return
      }

      if (config.showGrid) {
        const primaryMnemonic = config.curves[0]?.mnemonic
        const primaryScale = primaryMnemonic ? curveScales.get(primaryMnemonic) : undefined

        if (primaryScale) {
          if (config.scaleType === 'logarithmic') {
            drawLogarithmicGrid(
              ctx,
              primaryScale as ScaleLogarithmic<number, number>,
              config.gridDivisions,
              canvasWidth,
              canvasHeight,
              '#d5e1ec',
            )
          } else {
            drawLinearGrid(
              ctx,
              primaryScale as ScaleLinear<number, number>,
              config.gridDivisions,
              canvasWidth,
              canvasHeight,
              '#d5e1ec',
            )
          }
        }
      }

      if (config.showHorizontalGrid ?? true) {
        drawDepthGridlines(ctx, depthScale, canvasWidth, 100, 10, config.gridColor)
      }

      clippedCurves.forEach(({ curve, style }) => {
        if (!style.fill) {
          return
        }

        const valueScale = curveScales.get(style.mnemonic)
        if (!valueScale) {
          return
        }

        if (style.fill.type === 'to-baseline' && style.fill.baseline !== undefined) {
          drawFillToBaseline(
            ctx,
            curve.depths,
            curve.values,
            style.fill.baseline,
            depthScale,
            valueScale,
            style.fill.colorPositive,
            style.fill.colorNegative,
            style.fill.opacity,
            curve.null_value,
          )
        }

        if (style.fill.type === 'crossover' && style.fill.pairedCurve) {
          const paired = clippedCurveMap.get(style.fill.pairedCurve)
          const pairedScale = paired ? curveScales.get(paired.style.mnemonic) : undefined
          if (paired && pairedScale) {
            drawFillBetweenCurves(
              ctx,
              curve.depths,
              curve.values,
              paired.curve.values,
              depthScale,
              valueScale,
              pairedScale,
              style.fill.colorPositive,
              style.fill.colorNegative,
              style.fill.opacity,
              curve.null_value,
            )
          }
        }
      })

      clippedCurves.forEach(({ curve, style }) => {
        if (style.curve_type === 'lithology_discrete') {
          drawLithologyDiscrete(
            ctx,
            curve.depths,
            curve.values,
            curve.null_value,
            curve.discrete_code_map,
            lithologyFillStyles,
            depthScale,
            canvasWidth,
            canvasHeight,
            () => setPatternRenderTick((t) => t + 1),
          )
          return
        }

        if (style.curve_type === 'discrete') {
          drawDiscreteBlocks(
            ctx,
            curve.depths,
            curve.values,
            depthScale,
            canvasWidth,
            canvasHeight,
            curve.discrete_code_map,
            curve.null_value,
          )
          return
        }

        const valueScale = curveScales.get(style.mnemonic)
        if (!valueScale) {
          return
        }

        const isSelected = selectedElementType === 'curve' && selectedElementId === style.mnemonic
        drawCurve(ctx, curve.depths, curve.values, depthScale, valueScale, style, curve.null_value, isSelected, 5, curveGapThresholds.get(style.mnemonic))
      })
    },
    [
      clippedCurveMap,
      clippedCurves,
      compositionBands,
      config.curves,
      config.gridDivisions,
      config.gridColor,
      config.scaleType,
      config.showGrid,
      config.showHorizontalGrid,
      config.track_type,
      curveGapThresholds,
      curveScales,
      depthScale,
      isLithologyTrack,
      patternRenderTick,
      selectedElementId,
      selectedElementType,
    ],
  )

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (isLithologyTrack) {
      clearSelection()
      return
    }

    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top
    const { scrollDepth, depthPerPixel } = useViewStore.getState()
    const depth = scrollDepth + clickY * depthPerPixel

    let closest: { mnemonic: string; dist: number } | null = null
    for (const { curve, style } of clippedCurves) {
      const valueScale = curveScales.get(style.mnemonic)
      if (!valueScale) continue
      const value = interpolateAtDepth(curve.depths, curve.values, depth)
      if (value === null) continue
      const pixelX = valueScale(value)
      const dist = Math.abs(clickX - pixelX)
      if (dist <= 5 && (!closest || dist < closest.dist)) {
        closest = { mnemonic: style.mnemonic, dist }
      }
    }

    if (closest) {
      selectElement(closest.mnemonic, 'curve')
    } else {
      clearSelection()
    }
  }

  return <canvas ref={canvasRef} className="data-track" style={{ width, height }} onClick={handleClick} />
}
