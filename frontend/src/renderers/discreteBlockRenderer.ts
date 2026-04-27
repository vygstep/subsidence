// Discrete (categorical) curve renderer.
// Renders integer-coded log values as solid-color depth blocks filling the full track width.

const FALLBACK_COLOR = '#cccccc'

const PALETTE = [
  '#f5c842', // 0 — yellow
  '#7ec8e3', // 1 — blue
  '#d4845a', // 2 — terracotta
  '#78c97f', // 3 — green
  '#c97fc9', // 4 — purple
  '#e88262', // 5 — orange
  '#6bcfbd', // 6 — teal
  '#d4b483', // 7 — sand
  '#a0c4ff', // 8 — light blue
  '#ff9999', // 9 — pink
]

function codeColor(code: number, codeMap: Record<string, string> | null): string {
  if (codeMap) {
    const entry = codeMap[String(code)]
    if (entry && /^#[0-9a-fA-F]{6}$/.test(entry)) return entry
  }
  return PALETTE[((code % PALETTE.length) + PALETTE.length) % PALETTE.length] ?? FALLBACK_COLOR
}

export function drawDiscreteBlocks(
  ctx: CanvasRenderingContext2D,
  depths: Float32Array,
  values: Float32Array,
  depthScale: (d: number) => number,
  canvasWidth: number,
  canvasHeight: number,
  codeMap: Record<string, string> | null,
  nullValue: number,
): void {
  if (depths.length === 0) return

  for (let i = 0; i < depths.length; i++) {
    const code = values[i]
    if (!Number.isFinite(code) || code === nullValue) continue

    const y0 = depthScale(depths[i])
    const y1 = i + 1 < depths.length ? depthScale(depths[i + 1]) : canvasHeight

    if (y0 >= canvasHeight || y1 <= 0) continue

    const top = Math.max(0, y0)
    const bottom = Math.min(canvasHeight, y1)
    if (bottom <= top) continue

    ctx.fillStyle = codeColor(Math.round(code), codeMap)
    ctx.fillRect(0, top, canvasWidth, bottom - top)
  }
}
