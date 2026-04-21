import type { SubsidenceResult } from '@/types/subsidence'

export function drawBurialCurves(
  ctx: CanvasRenderingContext2D,
  curves: SubsidenceResult[],
  timeToX: (age_ma: number) => number,
  depthToY: (depth_m: number) => number,
): void {
  for (const curve of curves) {
    const path = [...curve.burial_path].sort((a, b) => b.age_ma - a.age_ma)
    if (path.length < 2) continue

    ctx.beginPath()
    ctx.strokeStyle = curve.color
    ctx.lineWidth = 1.5
    ctx.lineJoin = 'round'

    for (let i = 0; i < path.length; i++) {
      const x = timeToX(path[i].age_ma)
      const y = depthToY(path[i].depth_m)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
}

export function drawFormationFills(
  ctx: CanvasRenderingContext2D,
  curves: SubsidenceResult[],
  timeToX: (age_ma: number) => number,
  depthToY: (depth_m: number) => number,
): void {
  for (let i = 0; i < curves.length - 1; i++) {
    const upper = [...curves[i].burial_path].sort((a, b) => b.age_ma - a.age_ma)
    const lower = [...curves[i + 1].burial_path].sort((a, b) => a.age_ma - b.age_ma)
    if (upper.length < 2 || lower.length < 2) continue

    ctx.beginPath()
    for (const pt of upper) ctx.lineTo(timeToX(pt.age_ma), depthToY(pt.depth_m))
    for (const pt of lower) ctx.lineTo(timeToX(pt.age_ma), depthToY(pt.depth_m))
    ctx.closePath()
    ctx.fillStyle = curves[i].color + '4d'
    ctx.fill()
  }
}
