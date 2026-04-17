import { useEffect, useMemo, useRef } from 'react'

import { LogViewPanel, ZoomControl } from '@/components'
import { useProjectStore, useViewStore, useWellDataStore } from '@/stores'
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

interface WellListItem {
  well_id: string
  well_name: string
}

async function fetchWellList(): Promise<WellListItem[]> {
  const response = await fetch('/api/wells')
  if (!response.ok) {
    throw new Error(`Failed to list wells (${response.status})`)
  }
  return (await response.json()) as WellListItem[]
}

function App() {
  const loadWell = useWellDataStore((state) => state.loadWell)
  const resetWell = useWellDataStore((state) => state.reset)
  const well = useWellDataStore((state) => state.well)
  const curves = useWellDataStore((state) => state.curves)
  const colorOverrides = useWellDataStore((state) => state.colorOverrides)
  const isLoading = useWellDataStore((state) => state.isLoading)
  const error = useWellDataStore((state) => state.error)

  const isProjectOpen = useProjectStore((state) => state.isOpen)
  const projectName = useProjectStore((state) => state.projectName)
  const isDirty = useProjectStore((state) => state.isDirty)
  const canUndo = useProjectStore((state) => state.canUndo)
  const canRedo = useProjectStore((state) => state.canRedo)
  const pollStatus = useProjectStore((state) => state.pollStatus)
  const loadVisualConfig = useProjectStore((state) => state.loadVisualConfig)
  const saveVisualConfig = useProjectStore((state) => state.saveVisualConfig)
  const saveProject = useProjectStore((state) => state.saveProject)
  const undoProject = useProjectStore((state) => state.undo)
  const redoProject = useProjectStore((state) => state.redo)

  const depthPerPixel = useViewStore((state) => state.depthPerPixel)
  const trackWidths = useViewStore((state) => state.trackWidths)
  const resetVisualConfig = useViewStore((state) => state.resetVisualConfig)

  const configHydratedRef = useRef(false)

  useEffect(() => {
    void pollStatus()
    const timer = window.setInterval(() => {
      void pollStatus()
    }, 2000)
    return () => window.clearInterval(timer)
  }, [pollStatus])

  useEffect(() => {
    if (!isProjectOpen) {
      configHydratedRef.current = false
      resetWell()
      resetVisualConfig()
      return
    }

    let cancelled = false
    const hydrate = async () => {
      try {
        await loadVisualConfig()
      } catch {
        if (!cancelled) {
          resetVisualConfig()
        }
      } finally {
        if (!cancelled) {
          configHydratedRef.current = true
        }
      }
    }

    void hydrate()
    return () => {
      cancelled = true
    }
  }, [isProjectOpen, loadVisualConfig, resetVisualConfig, resetWell])

  useEffect(() => {
    if (!isProjectOpen || !configHydratedRef.current) {
      return
    }

    const timer = window.setTimeout(() => {
      void saveVisualConfig({
        depthPerPixel,
        trackWidths,
      })
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [depthPerPixel, isProjectOpen, saveVisualConfig, trackWidths])

  useEffect(() => {
    if (!isProjectOpen) {
      resetWell()
      return
    }

    let cancelled = false
    const loadFirstWell = async () => {
      try {
        const wells = await fetchWellList()
        if (cancelled) {
          return
        }
        if (wells.length === 0) {
          resetWell()
          return
        }
        if (well?.well_id === wells[0].well_id) {
          return
        }
        await loadWell(wells[0].well_id)
      } catch {
        resetWell()
      }
    }

    void loadFirstWell()
    return () => {
      cancelled = true
    }
  }, [isProjectOpen, loadWell, resetWell, well?.well_id])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isProjectOpen || !event.ctrlKey) {
        return
      }

      if (event.key.toLowerCase() === 's') {
        event.preventDefault()
        void saveProject()
        return
      }

      if (event.key.toLowerCase() === 'z' && event.shiftKey) {
        if (!canRedo) {
          return
        }
        event.preventDefault()
        void redoProject()
        return
      }

      if (event.key.toLowerCase() === 'z') {
        if (!canUndo) {
          return
        }
        event.preventDefault()
        void undoProject()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canRedo, canUndo, isProjectOpen, redoProject, saveProject, undoProject])

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

  const tracks = useMemo(() => (
    DEFAULT_TRACKS.map((track) => ({
      ...track,
      curves: track.curves.map((curve) => ({
        ...curve,
        color: colorOverrides[curve.mnemonic] ?? curve.color,
      })),
    }))
  ), [colorOverrides])

  const topbarTitle = !isProjectOpen
    ? 'No project open'
    : isLoading
      ? 'Loading well...'
      : error
        ? 'Error loading well'
        : (well?.well_name ?? 'No wells in project')

  return (
    <div className="app-layout">
      <header className="app-topbar">
        <span className="app-topbar__brand">SUBSIDENCE</span>
        <span className="app-topbar__project">{isDirty ? '* ' : ''}{projectName ?? '-'}</span>
        <span className="app-topbar__well">{topbarTitle}</span>
        <ZoomControl />
        {curves.length > 0 && (
          <span className="app-topbar__meta">
            {curves.length} curves | {curves[0].depths.length.toLocaleString()} samples
          </span>
        )}
      </header>
      <main className="app-main">
        {!isProjectOpen ? (
          <p className="app-error-banner">Open a project through the API before loading the viewer.</p>
        ) : error ? (
          <p className="app-error-banner">{error}</p>
        ) : curves.length === 0 ? (
          <p className="app-error-banner">No wells are available in the open project.</p>
        ) : (
          <LogViewPanel
            tracks={tracks}
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
