import { scaleLinear, scaleLog, type ScaleLinear, type ScaleLogarithmic } from 'd3-scale'
import { useMemo } from 'react'

import { useCanvasRenderer, useDepthScale } from '@/hooks'
import {
  drawCurve,
  drawDepthGridlines,
  drawFillBetweenCurves,
  drawFillToBaseline,
  drawLinearGrid,
  drawLogarithmicGrid,
} from '@/renderers'
import type { CurveConfig, CurveData, TrackConfig } from '@/types'
import { useViewStore } from '@/stores'

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

export function DataTrack({ config, curves, width, height }: DataTrackProps) {
  const visibleDepthRange = useViewStore((state) => state.visibleDepthRange)

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

  const canvasRef = useCanvasRenderer(
    (ctx, canvasWidth, canvasHeight) => {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)

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

      drawDepthGridlines(ctx, depthScale, canvasWidth, 100, 10)

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
        const valueScale = curveScales.get(style.mnemonic)
        if (!valueScale) {
          return
        }

        drawCurve(ctx, curve.depths, curve.values, depthScale, valueScale, style, curve.null_value)
      })
    },
    [
      clippedCurveMap,
      clippedCurves,
      config.curves,
      config.gridDivisions,
      config.scaleType,
      config.showGrid,
      curveScales,
      depthScale,
    ],
  )

  return <canvas ref={canvasRef} className="data-track" style={{ width, height }} />
}
