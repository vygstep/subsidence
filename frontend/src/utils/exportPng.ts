export function exportPng(filename = 'subsidence.png'): void {
  const canvas = document.querySelector<HTMLCanvasElement>('.subsidence-canvas')
  if (!canvas) return
  const url = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
}
