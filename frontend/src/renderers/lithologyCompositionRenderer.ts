import { drawLithologyBlock, type LithologyFillStyle } from './lithologyRenderer'

export function drawLithologyDiscrete(
  ctx: CanvasRenderingContext2D,
  depths: Float32Array,
  values: Float32Array,
  nullValue: number,
  codeMap: Record<string, string> | null,
  fillStyles: Map<string, LithologyFillStyle>,
  depthScale: (d: number) => number,
  canvasWidth: number,
  canvasHeight: number,
  onPatternReady?: () => void,
): void {
  if (depths.length === 0) return

  for (let i = 0; i < depths.length; i++) {
    const v = values[i]
    if (!Number.isFinite(v) || v === nullValue) continue

    const lithCode = codeMap?.[String(Math.round(v))]
    if (!lithCode) continue
    const style = fillStyles.get(lithCode)
    if (!style) continue

    const y0 = depthScale(depths[i])
    const y1 = i + 1 < depths.length ? depthScale(depths[i + 1]) : canvasHeight

    if (y0 >= canvasHeight || y1 <= 0) continue
    const top = Math.max(0, y0)
    const bottom = Math.min(canvasHeight, y1)
    if (bottom <= top) continue

    drawLithologyBlock(ctx, style, 0, top, canvasWidth, bottom - top, onPatternReady)
  }
}

export interface CompositionBand {
  depths: Float32Array
  values: Float32Array
  nullValue: number
  style: LithologyFillStyle
}

function stepValueAt(depths: Float32Array, values: Float32Array, nullValue: number, target: number): number {
  if (depths.length === 0) return 0
  if (depths[0] > target) return 0
  let lo = 0
  let hi = depths.length - 1
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (depths[mid] <= target) lo = mid
    else hi = mid - 1
  }
  const v = values[lo]
  return Number.isFinite(v) && v !== nullValue ? Math.max(0, v) : 0
}

function mergeDepths(bands: CompositionBand[]): number[] {
  const set = new Set<number>()
  for (const band of bands) {
    for (let i = 0; i < band.depths.length; i++) set.add(band.depths[i])
  }
  return Array.from(set).sort((a, b) => a - b)
}

export function drawLithologyComposition(
  ctx: CanvasRenderingContext2D,
  bands: CompositionBand[],
  depthScale: (d: number) => number,
  canvasWidth: number,
  canvasHeight: number,
  onPatternReady?: () => void,
): void {
  if (bands.length === 0) return

  const depths = mergeDepths(bands)
  if (depths.length === 0) return

  for (let i = 0; i < depths.length; i++) {
    const d = depths[i]
    const nextD = depths[i + 1]

    const y0 = depthScale(d)
    const y1 = nextD !== undefined ? depthScale(nextD) : canvasHeight

    if (y0 >= canvasHeight || y1 <= 0) continue
    const top = Math.max(0, y0)
    const bottom = Math.min(canvasHeight, y1)
    if (bottom <= top) continue

    const vals = bands.map((b) => stepValueAt(b.depths, b.values, b.nullValue, d))
    const total = vals.reduce((s, v) => s + v, 0)
    if (total <= 0) continue

    let x = 0
    for (let j = 0; j < bands.length; j++) {
      const w = (vals[j] / total) * canvasWidth
      if (w > 0.5) {
        drawLithologyBlock(ctx, bands[j].style, x, top, w, bottom - top, onPatternReady)
      }
      x += w
    }
  }
}
