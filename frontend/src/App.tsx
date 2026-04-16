import { useEffect, useMemo } from 'react'

import { DataTrack, DepthTrack, LogViewPanel, TrackHeaderRow } from '@/components'
import { useCanvasRenderer, useDepthScale, useValueScale } from '@/hooks'
import { drawCurve, drawDepthGridlines, drawDepthLabels, drawLinearGrid } from '@/renderers'
import { useViewStore, useWellDataStore } from '@/stores'
import type { TrackConfig } from '@/types'

// ── Step 9/10 preview: single GR track ─────────────────────────────────────
const grTrackConfig: TrackConfig = {
  id: 'gr-track',
  title: 'Gamma Ray',
  width: 420,
  scaleType: 'linear',
  gridDivisions: 3,
  showGrid: true,
  curves: [
    {
      mnemonic: 'GR',
      unit: 'API',
      color: '#1f9d55',
      lineWidth: 2,
      lineStyle: 'solid',
      scaleMin: 0,
      scaleMax: 150,
      scaleReversed: false,
    },
  ],
}

// ── Step 10: default 4-track layout (Depth + GR + ILD + RHOB) ──────────────
const DEFAULT_TRACKS: TrackConfig[] = [
  {
    id: 'gr',
    title: 'Gamma Ray',
    width: 200,
    scaleType: 'linear',
    gridDivisions: 3,
    showGrid: true,
    curves: [{ mnemonic: 'GR', unit: 'API', color: '#22c55e', lineWidth: 1.5, lineStyle: 'solid', scaleMin: 0, scaleMax: 150, scaleReversed: false }],
  },
  {
    id: 'res',
    title: 'Resistivity',
    width: 200,
    scaleType: 'logarithmic',
    gridDivisions: 4,
    showGrid: false,
    curves: [{ mnemonic: 'ILD', unit: 'ohm.m', color: '#ef4444', lineWidth: 1.5, lineStyle: 'solid', scaleMin: 0.2, scaleMax: 2000, scaleReversed: false }],
  },
  {
    id: 'por',
    title: 'Porosity',
    width: 200,
    scaleType: 'linear',
    gridDivisions: 3,
    showGrid: true,
    curves: [{ mnemonic: 'RHOB', unit: 'g/cc', color: '#ef4444', lineWidth: 1.5, lineStyle: 'solid', scaleMin: 1.95, scaleMax: 2.95, scaleReversed: false }],
  },
]

function SineWavePreview() {
  const { scale: yScale } = useDepthScale({ min: 0, max: 1 }, 180)
  const { scale: xScale } = useValueScale(-1, 1, 520, 'linear')

  const depths = new Float32Array(Array.from({ length: 241 }, (_, index) => index / 240))
  const values = new Float32Array(Array.from({ length: 241 }, (_, index) => Math.sin((index / 240) * Math.PI * 4)))

  const canvasRef = useCanvasRenderer(
    (ctx, width, height) => {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)

      drawLinearGrid(ctx, xScale, 4, width, height, '#e2e8f0')
      drawDepthGridlines(ctx, yScale, width, 0.25, 0.125)
      drawCurve(ctx, depths, values, yScale, xScale, {
        color: '#2d6ca3',
        lineWidth: 2,
        lineStyle: 'solid',
      })
      drawDepthLabels(ctx, yScale, width, 0.25)
    },
    [depths, values, xScale, yScale],
  )

  return <canvas ref={canvasRef} className="wave-canvas" />
}

const PREVIEW_HEIGHT = 800

function DepthTrackPreview() {
  const setScroll = useViewStore((state) => state.setScroll)
  const setScale = useViewStore((state) => state.setScale)
  const setViewportHeight = useViewStore((state) => state.setViewportHeight)
  const visibleDepthRange = useViewStore((state) => state.visibleDepthRange)

  useEffect(() => {
    setScroll(1000)
    setScale(0.2)
    setViewportHeight(PREVIEW_HEIGHT)
  }, [setScale, setScroll, setViewportHeight])

  return (
    <section className="depth-proof">
      <div className="depth-proof__copy">
        <p className="wave-panel__eyebrow">Depth Track Proof</p>
        <h2 className="wave-panel__title">Depth Labels Preview</h2>
        <p className="wave-panel__text">
          Step 7 verification track. It reads `visibleDepthRange` from `viewStore` and draws depth labels and gridlines.
        </p>
        <p className="depth-proof__range">
          Visible range: {visibleDepthRange.min.toFixed(0)} m - {visibleDepthRange.max.toFixed(0)} m
        </p>
      </div>
      <div className="depth-proof__trackWrap">
        <DepthTrack height={PREVIEW_HEIGHT} />
      </div>
    </section>
  )
}

function DataTrackPreview() {
  const setScroll = useViewStore((state) => state.setScroll)
  const setScale = useViewStore((state) => state.setScale)
  const setViewportHeight = useViewStore((state) => state.setViewportHeight)
  const visibleDepthRange = useViewStore((state) => state.visibleDepthRange)
  const curves = useWellDataStore((state) => state.curves)

  useEffect(() => {
    setScroll(1000)
    setScale(0.2)
    setViewportHeight(PREVIEW_HEIGHT)
  }, [setScale, setScroll, setViewportHeight])

  return (
    <section className="data-proof">
      <div className="data-proof__copy">
        <p className="wave-panel__eyebrow">Data Track Proof</p>
        <h2 className="wave-panel__title">GR Data Track Preview</h2>
        <p className="wave-panel__text">
          Step 8 verification track. It clips `GR` by visible depth, draws linear gridlines first, then renders the curve in green on a 0-150 API scale.
        </p>
        <p className="depth-proof__range">
          Visible range: {visibleDepthRange.min.toFixed(0)} m - {visibleDepthRange.max.toFixed(0)} m
        </p>
      </div>
      <div className="data-proof__trackWrap">
        <DataTrack config={grTrackConfig} curves={curves} width={grTrackConfig.width} height={PREVIEW_HEIGHT} />
      </div>
    </section>
  )
}

const previewTracks = [grTrackConfig]

function HeaderRowPreview() {
  return (
    <section className="wave-panel">
      <div className="wave-panel__copy">
        <p className="wave-panel__eyebrow">Track Header Proof</p>
        <h2 className="wave-panel__title">Step 9 — Track Headers</h2>
        <p className="wave-panel__text">
          Full-width header row: colour swatch + mnemonic + unit, min/max at opposite edges.
          Sticky top-0 so it stays visible while the track area scrolls.
        </p>
      </div>
      <div className="depth-proof__trackWrap">
        <TrackHeaderRow tracks={previewTracks} />
      </div>
    </section>
  )
}

function LogViewPanelPreview() {
  const curves = useWellDataStore((state) => state.curves)

  const { minDepth, maxDepth } = useMemo(() => {
    if (curves.length === 0) return { minDepth: 0, maxDepth: 1000 }
    let min = Infinity
    let max = -Infinity
    for (const c of curves) {
      if (c.depths.length > 0) {
        min = Math.min(min, c.depths[0])
        max = Math.max(max, c.depths[c.depths.length - 1])
      }
    }
    return { minDepth: min, maxDepth: max }
  }, [curves])

  return (
    <section className="wave-panel">
      <div className="wave-panel__copy">
        <p className="wave-panel__eyebrow">Log View Panel Proof</p>
        <h2 className="wave-panel__title">Step 10 — Synchronized Scroll</h2>
        <p className="wave-panel__text">
          Four tracks (Depth · GR · ILD · RHOB) scroll in sync via mouse wheel.
          Headers stay fixed. Scroll is clamped to data bounds.
        </p>
      </div>
      <div className="logview-proof__wrap">
        <LogViewPanel
          tracks={DEFAULT_TRACKS}
          curves={curves}
          minDepth={minDepth}
          maxDepth={maxDepth}
        />
      </div>
    </section>
  )
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
              Step 6 verification uses pure renderer functions. The preview now draws through `gridRenderer`, `curveRenderer`, and `depthLabelsRenderer`.
            </p>
          </div>
          <SineWavePreview />
        </section>
        <DepthTrackPreview />
        <DataTrackPreview />
        <HeaderRowPreview />
        <LogViewPanelPreview />
        {error ? <p className="app-error">{error}</p> : null}
      </section>
    </main>
  )
}

export default App
