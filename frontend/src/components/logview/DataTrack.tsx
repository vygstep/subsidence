import { scaleLinear, scaleLog, type ScaleLinear, type ScaleLogarithmic } from 'd3-scale'
import { useMemo } from 'react'

import { useCanvasRenderer, useDepthScale } from '@/hooks'
import { drawCurve, drawDepthGridlines, drawLinearGrid } from '@/renderers'
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

  const { scale: depthScale } = useDepthScale(visibleDepthRange, height)

  // One value scale per curve — each curve may have different scaleMin/scaleMax/reversed.
  const curveScales = useMemo(() => {
    return new Map<string, ScaleLinear<number, number> | ScaleLogarithmic<number, number>>(
      config.curves.map((c) => {
        const range: [number, number] = c.scaleReversed ? [width, 0] : [0, width]
        const domain: [number, number] = [c.scaleMin, c.scaleMax]
        const scale =
          config.scaleType === 'logarithmic'
            ? scaleLog().domain(domain).range(range)
            : scaleLinear().domain(domain).range(range)
        return [c.mnemonic, scale]
      }),
    )
  }, [config.curves, config.scaleType, width])

  const canvasRef = useCanvasRenderer(
    (ctx, canvasWidth, canvasHeight) => {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)

      if (config.showGrid && config.scaleType === 'linear') {
        const primaryMnemonic = config.curves[0]?.mnemonic
        const primaryScale = primaryMnemonic ? curveScales.get(primaryMnemonic) : undefined
        if (primaryScale) {
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

      drawDepthGridlines(ctx, depthScale, canvasWidth, 100, 10)

      clippedCurves.forEach(({ curve, style }) => {
        const valueScale = curveScales.get(style.mnemonic)
        if (!valueScale) return
        drawCurve(ctx, curve.depths, curve.values, depthScale, valueScale, style, curve.null_value)
      })
    },
    [clippedCurves, config.gridDivisions, config.showGrid, config.scaleType, config.curves, curveScales, depthScale],
  )

  return <canvas ref={canvasRef} className="data-track" style={{ width, height }} />
}
