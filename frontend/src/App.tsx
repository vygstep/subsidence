import { useEffect } from 'react'

import { useCanvasRenderer, useDepthScale, useValueScale } from '@/hooks'
import { useWellDataStore } from '@/stores'

function SineWavePreview() {
  const { scale: yScale } = useDepthScale({ min: 0, max: 1 }, 180)
  const { scale: xScale } = useValueScale(-1, 1, 520, 'linear')

  const canvasRef = useCanvasRenderer(
    (ctx, width, height) => {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)

      ctx.strokeStyle = '#d6e0eb'
      ctx.lineWidth = 1
      ctx.strokeRect(0.5, 0.5, width - 1, height - 1)

      ctx.beginPath()
      for (let index = 0; index <= 240; index += 1) {
        const t = index / 240
        const x = xScale(Math.sin(t * Math.PI * 4))
        const y = yScale(t)
        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }
      ctx.strokeStyle = '#2d6ca3'
      ctx.lineWidth = 2
      ctx.stroke()
    },
    [xScale, yScale],
  )

  return <canvas ref={canvasRef} className="wave-canvas" />
}

function App() {
  const loadWell = useWellDataStore((state) => state.loadWell)
  const well = useWellDataStore((state) => state.well)
  const curves = useWellDataStore((state) => state.curves)
  const isLoading = useWellDataStore((state) => state.isLoading)
  const error = useWellDataStore((state) => state.error)

  useEffect(() => {
    void loadWell('sample')
  }, [loadWell])

  useEffect(() => {
    if (curves.length === 0) {
      return
    }

    console.log('Loaded curves', curves)
  }, [curves])

  return (
    <main className="app-shell">
      <section className="app-card">
        <p className="app-eyebrow">SUBSIDENCE</p>
        <h1 className="app-title">Phase 1 Frontend Scaffold</h1>
        <p className="app-copy">
          The Compass-aligned React frontend is active. Canvas tracks and FastAPI data wiring start next.
        </p>
        <dl className="app-status-grid">
          <div>
            <dt>Status</dt>
            <dd>{isLoading ? 'Loading sample well...' : error ? 'Load failed' : 'Sample well loaded'}</dd>
          </div>
          <div>
            <dt>Well</dt>
            <dd>{well?.well_name ?? '—'}</dd>
          </div>
          <div>
            <dt>Curves</dt>
            <dd>{curves.length}</dd>
          </div>
          <div>
            <dt>Depth Samples</dt>
            <dd>{curves[0]?.depths.length ?? 0}</dd>
          </div>
        </dl>
        <section className="wave-panel">
          <div className="wave-panel__copy">
            <p className="wave-panel__eyebrow">Canvas Proof</p>
            <h2 className="wave-panel__title">Sine Wave Preview</h2>
            <p className="wave-panel__text">
              Step 5 verification canvas. It exercises the shared canvas renderer and scale hooks before log tracks land.
            </p>
          </div>
          <SineWavePreview />
        </section>
        {error ? <p className="app-error">{error}</p> : null}
      </section>
    </main>
  )
}

export default App
