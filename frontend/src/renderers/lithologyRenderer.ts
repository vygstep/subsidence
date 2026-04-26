export interface LithologyFillStyle {
  color: string
  patternCode?: string | null
  patternSvg?: string | null
}

interface CachedSvgPattern {
  image: HTMLImageElement
  pattern: CanvasPattern | null
  isLoading: boolean
}

const patternCaches = new WeakMap<CanvasRenderingContext2D, Map<string, CachedSvgPattern>>()

function getContextCache(ctx: CanvasRenderingContext2D): Map<string, CachedSvgPattern> {
  let cache = patternCaches.get(ctx)
  if (!cache) {
    cache = new Map()
    patternCaches.set(ctx, cache)
  }
  return cache
}

function makeSvgDataUrl(svgContent: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`
}

function getSvgCanvasPattern(
  ctx: CanvasRenderingContext2D,
  style: LithologyFillStyle,
  onPatternReady?: () => void,
): CanvasPattern | null {
  if (!style.patternSvg || !style.patternCode || typeof Image === 'undefined') {
    return null
  }

  const key = `${style.patternCode}:${style.patternSvg.length}:${style.patternSvg.slice(0, 64)}`
  const cache = getContextCache(ctx)
  const cached = cache.get(key)
  if (cached?.pattern) {
    return cached.pattern
  }
  if (cached?.isLoading) {
    return null
  }
  if (cached?.image.complete && cached.image.naturalWidth > 0) {
    cached.pattern = ctx.createPattern(cached.image, 'repeat')
    return cached.pattern
  }

  const image = new Image()
  const entry: CachedSvgPattern = { image, pattern: null, isLoading: true }
  cache.set(key, entry)
  image.onload = () => {
    entry.isLoading = false
    entry.pattern = null
    onPatternReady?.()
  }
  image.onerror = () => {
    entry.isLoading = false
    entry.pattern = null
  }
  image.src = makeSvgDataUrl(style.patternSvg)
  return null
}

function overlayPattern(
  ctx: CanvasRenderingContext2D,
  style: LithologyFillStyle,
  x: number,
  y: number,
  width: number,
  height: number,
  onPatternReady?: () => void,
): void {
  const pattern = getSvgCanvasPattern(ctx, style, onPatternReady)
  if (!pattern) {
    return
  }

  ctx.save()
  ctx.fillStyle = pattern
  ctx.fillRect(x, y, width, height)
  ctx.restore()
}

export function drawLithologyBlock(
  ctx: CanvasRenderingContext2D,
  style: LithologyFillStyle,
  x: number,
  y: number,
  width: number,
  height: number,
  onPatternReady?: () => void,
): void {
  ctx.save()
  ctx.fillStyle = style.color
  ctx.fillRect(x, y, width, height)
  overlayPattern(ctx, style, x, y, width, height, onPatternReady)
  ctx.strokeStyle = 'rgba(23, 33, 43, 0.2)'
  ctx.lineWidth = 1
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1)
  ctx.restore()
}
