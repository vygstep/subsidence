import { scaleLinear, scaleLog, type ScaleLinear, type ScaleLogarithmic } from 'd3-scale'
import { useMemo } from 'react'

interface ValueScaleResult {
  valueToPixel: (value: number) => number
  pixelToValue: (pixel: number) => number
  scale: ScaleLinear<number, number> | ScaleLogarithmic<number, number>
}

export function useValueScale(
  scaleMin: number,
  scaleMax: number,
  trackWidth: number,
  scaleType: 'linear' | 'logarithmic',
  reversed = false,
): ValueScaleResult {
  const scale = useMemo(() => {
    const range: [number, number] = reversed ? [trackWidth, 0] : [0, trackWidth]
    const domain: [number, number] = [scaleMin, scaleMax]

    return scaleType === 'logarithmic'
      ? scaleLog().domain(domain).range(range)
      : scaleLinear().domain(domain).range(range)
  }, [reversed, scaleMax, scaleMin, scaleType, trackWidth])

  return {
    valueToPixel: (value) => scale(value),
    pixelToValue: (pixel) => scale.invert(pixel),
    scale,
  }
}
