import { useMemo } from 'react'

import { useCanvasRenderer, useDepthScale, useValueScale } from '@/hooks'
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
  const primaryStyle = config.curves[0]
  const { scale: valueScale } = useValueScale(
    primaryStyle?.scaleMin ?? 0,
    primaryStyle?.scaleMax ?? 150,
    width,
    config.scaleType,
    primaryStyle?.scaleReversed ?? false,
  )

  const canvasRef = useCanvasRenderer(
    (ctx, canvasWidth, canvasHeight) => {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)

      if (config.showGrid) {
        drawLinearGrid(ctx, valueScale, config.gridDivisions, canvasWidth, canvasHeight, '#d5e1ec')
      }

      drawDepthGridlines(ctx, depthScale, canvasWidth, 100, 10)

      clippedCurves.forEach(({ curve, style }) => {
        drawCurve(ctx, curve.depths, curve.values, depthScale, valueScale, style, curve.null_value)
      })
    },
    [clippedCurves, config.gridDivisions, config.showGrid, depthScale, valueScale],
  )

  return <canvas ref={canvasRef} className="data-track" style={{ width, height }} />
}
