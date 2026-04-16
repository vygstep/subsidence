import type { LithologyType } from '@/types'

export type LithologyPattern = Exclude<LithologyType, 'metamorphic'>

function createPattern(
  ctx: CanvasRenderingContext2D,
  draw: (patternCtx: CanvasRenderingContext2D, size: number) => void,
): CanvasPattern | null {
  if (typeof document === 'undefined') {
    return null
  }

  const size = 12
  const patternCanvas = document.createElement('canvas')
  patternCanvas.width = size
  patternCanvas.height = size
  const patternCtx = patternCanvas.getContext('2d')
  if (!patternCtx) {
    return null
  }

  draw(patternCtx, size)
  return ctx.createPattern(patternCanvas, 'repeat')
}

function overlayPattern(
  ctx: CanvasRenderingContext2D,
  lithology: LithologyPattern | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  let pattern: CanvasPattern | null = null

  switch (lithology) {
    case 'sandstone':
      pattern = createPattern(ctx, (patternCtx, size) => {
        patternCtx.fillStyle = 'rgba(112, 77, 24, 0.28)'
        patternCtx.beginPath()
        patternCtx.arc(size * 0.3, size * 0.3, 1.1, 0, Math.PI * 2)
        patternCtx.arc(size * 0.72, size * 0.58, 1.1, 0, Math.PI * 2)
        patternCtx.fill()
      })
      break
    case 'shale':
      pattern = createPattern(ctx, (patternCtx, size) => {
        patternCtx.strokeStyle = 'rgba(56, 68, 77, 0.22)'
        patternCtx.lineWidth = 1
        for (let row = 2; row < size; row += 4) {
          patternCtx.beginPath()
          patternCtx.moveTo(0, row)
          patternCtx.lineTo(size, row)
          patternCtx.stroke()
        }
      })
      break
    case 'limestone':
      pattern = createPattern(ctx, (patternCtx, size) => {
        patternCtx.strokeStyle = 'rgba(52, 91, 78, 0.24)'
        patternCtx.lineWidth = 1
        patternCtx.strokeRect(1, 1, size - 2, size / 2 - 1)
        patternCtx.strokeRect(1, size / 2, size / 2 - 1, size / 2 - 1)
        patternCtx.strokeRect(size / 2, size / 2, size / 2 - 1, size / 2 - 1)
      })
      break
    case 'dolomite':
      pattern = createPattern(ctx, (patternCtx, size) => {
        patternCtx.strokeStyle = 'rgba(101, 54, 145, 0.22)'
        patternCtx.lineWidth = 1
        patternCtx.beginPath()
        patternCtx.moveTo(size / 2, 1)
        patternCtx.lineTo(size - 1, size / 2)
        patternCtx.lineTo(size / 2, size - 1)
        patternCtx.lineTo(1, size / 2)
        patternCtx.closePath()
        patternCtx.stroke()
      })
      break
    case 'evaporite':
    case 'igneous':
    case 'coal':
    case 'conglomerate':
    default:
      pattern = null
      break
  }

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
  lithology: LithologyPattern | undefined,
  color: string,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  ctx.save()
  ctx.fillStyle = color
  ctx.fillRect(x, y, width, height)
  overlayPattern(ctx, lithology, x, y, width, height)
  ctx.strokeStyle = 'rgba(23, 33, 43, 0.2)'
  ctx.lineWidth = 1
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1)
  ctx.restore()
}
