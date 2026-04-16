import { useEffect, useMemo } from 'react'

import { LogViewPanel, ZoomControl } from '@/components'
import { useWellDataStore } from '@/stores'
import type { TrackConfig } from '@/types'

const DEFAULT_TRACKS: TrackConfig[] = [
  {
    id: 'gr',
    title: 'Gamma Ray',
    width: 200,
    scaleType: 'linear',
    gridDivisions: 3,
    showGrid: true,
    curves: [
      {
        mnemonic: 'GR',
        unit: 'API',
        color: '#22c55e',
        lineWidth: 1.5,
        lineStyle: 'solid',
        scaleMin: 0,
        scaleMax: 150,
        scaleReversed: false,
        fill: {
          type: 'to-baseline',
          baseline: 75,
          colorPositive: '#fef3c7',
          colorNegative: '#d1fae5',
          opacity: 0.5,
        },
      },
      { mnemonic: 'CALI', unit: 'in', color: '#111827', lineWidth: 2, lineStyle: 'dashed', scaleMin: 6, scaleMax: 16, scaleReversed: false },
    ],
  },
  {
    id: 'res',
    title: 'Resistivity',
    width: 200,
    scaleType: 'logarithmic',
    gridDivisions: 4,
    showGrid: true,
    curves: [
      { mnemonic: 'ILD', unit: 'ohm.m', color: '#ef4444', lineWidth: 1.5, lineStyle: 'solid', scaleMin: 0.2, scaleMax: 2000, scaleReversed: false },
    ],
  },
  {
    id: 'por',
    title: 'Porosity',
    width: 200,
    scaleType: 'linear',
    gridDivisions: 3,
    showGrid: true,
    curves: [
      {
        mnemonic: 'RHOB',
        unit: 'g/cc',
        color: '#ef4444',
        lineWidth: 1.5,
        lineStyle: 'solid',
        scaleMin: 1.95,
        scaleMax: 2.95,
        scaleReversed: false,
        fill: {
          type: 'crossover',
          pairedCurve: 'NPHI',
          colorPositive: '#fef9c3',
          colorNegative: '#e5e7eb',
          opacity: 0.45,
        },
      },
      { mnemonic: 'NPHI', unit: 'v/v', color: '#2563eb', lineWidth: 1.2, lineStyle: 'dashed', scaleMin: 0.45, scaleMax: -0.15, scaleReversed: true },
    ],
  },
]

function App() {
  const loadWell = useWellDataStore((state) => state.loadWell)
  const well = useWellDataStore((state) => state.well)
  const curves = useWellDataStore((state) => state.curves)
  const isLoading = useWellDataStore((state) => state.isLoading)
  const error = useWellDataStore((state) => state.error)

  useEffect(() => {
    void loadWell('sample')
  }, [loadWell])

  const { minDepth, maxDepth } = useMemo(() => {
    if (curves.length === 0) {
      return { minDepth: 0, maxDepth: 1000 }
    }

    let min = Infinity
    let max = -Infinity
    for (const curve of curves) {
      if (curve.depths.length > 0) {
        min = Math.min(min, curve.depths[0])
        max = Math.max(max, curve.depths[curve.depths.length - 1])
      }
    }

    return { minDepth: min, maxDepth: max }
  }, [curves])

  return (
    <div className="app-layout">
      <header className="app-topbar">
        <span className="app-topbar__brand">SUBSIDENCE</span>
        <span className="app-topbar__well">
          {isLoading ? 'Loading...' : error ? 'Error loading well' : (well?.well_name ?? '-')}
        </span>
        <ZoomControl />
        {curves.length > 0 && (
          <span className="app-topbar__meta">
            {curves.length} curves | {curves[0].depths.length.toLocaleString()} samples
          </span>
        )}
      </header>
      <main className="app-main">
        {error ? (
          <p className="app-error-banner">{error}</p>
        ) : (
          <LogViewPanel
            tracks={DEFAULT_TRACKS}
            curves={curves}
            minDepth={minDepth}
            maxDepth={maxDepth}
          />
        )}
      </main>
    </div>
  )
}

export default App
