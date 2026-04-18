import { useEffect, useMemo, useRef, useState } from 'react'

import {
  CreateWellDialog,
  FileOpenDialog,
  ImportDeviationDialog,
  ImportLasDialog,
  ImportTopsDialog,
  LogViewPanel,
  NewProjectDialog,
  WellDataPanel,
  ZoomControl,
} from '@/components'
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

type DialogKind = 'project-open' | 'project-new' | 'create-well' | 'load-las' | 'load-tops' | 'load-deviation' | null
type SidebarTab = 'wells' | 'models'

async function fetchWellList(): Promise<WellListItem[]> {
  const response = await fetch('/api/wells')
  if (!response.ok) {
    throw new Error(`Failed to list wells (${response.status})`)
  }
  return (await response.json()) as WellListItem[]
}

function App() {
  const [activeDialog, setActiveDialog] = useState<DialogKind>('project-open')
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('wells')
  const [wellOptions, setWellOptions] = useState<WellListItem[]>([])

  const loadWell = useWellDataStore((state) => state.loadWell)
  const resetWell = useWellDataStore((state) => state.reset)
  const well = useWellDataStore((state) => state.well)
  const curves = useWellDataStore((state) => state.curves)
  const formations = useWellDataStore((state) => state.formations)
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
  const closeProject = useProjectStore((state) => state.closeProject)
  const undoProject = useProjectStore((state) => state.undo)
  const redoProject = useProjectStore((state) => state.redo)

  const depthPerPixel = useViewStore((state) => state.depthPerPixel)
  const trackWidths = useViewStore((state) => state.trackWidths)
  const resetVisualConfig = useViewStore((state) => state.resetVisualConfig)

  const configHydratedRef = useRef(false)

  async function refreshWellList(preferredWellId?: string): Promise<void> {
    const wells = await fetchWellList()
    setWellOptions(wells)

    if (wells.length === 0) {
      resetWell()
      return
    }

    const currentWellId = well?.well_id
    const hasCurrent = currentWellId ? wells.some((item) => item.well_id == currentWellId) : false
    const nextWellId = preferredWellId ?? (hasCurrent ? currentWellId : wells[0].well_id)
    if (!nextWellId) {
      resetWell()
      return
    }

    if (preferredWellId || nextWellId !== currentWellId) {
      await loadWell(nextWellId)
    }
  }

  useEffect(() => {
    void pollStatus()
    const timer = window.setInterval(() => {
      void pollStatus()
    }, 2000)
    return () => window.clearInterval(timer)
  }, [pollStatus])

  useEffect(() => {
    if (!isProjectOpen) {
      setWellOptions([])
      if (activeDialog === null) {
        setActiveDialog('project-open')
      }
      return
    }

    if (activeDialog === 'project-open' || activeDialog === 'project-new') {
      setActiveDialog(null)
    }
  }, [activeDialog, isProjectOpen])

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
        curveColors: colorOverrides,
      })
    }, 500)

    return () => window.clearTimeout(timer)
  }, [colorOverrides, depthPerPixel, isProjectOpen, saveVisualConfig, trackWidths])

  useEffect(() => {
    if (!isProjectOpen) {
      resetWell()
      return
    }

    let cancelled = false
    const loadCurrentProject = async () => {
      try {
        const wells = await fetchWellList()
        if (cancelled) {
          return
        }
        setWellOptions(wells)
        if (wells.length === 0) {
          resetWell()
          return
        }

        const currentWellId = well?.well_id
        const hasCurrent = currentWellId ? wells.some((item) => item.well_id == currentWellId) : false
        const nextWellId = hasCurrent && currentWellId ? currentWellId : wells[0].well_id
        if (nextWellId && nextWellId !== currentWellId) {
          await loadWell(nextWellId)
        }
      } catch {
        if (!cancelled) {
          setWellOptions([])
          resetWell()
        }
      }
    }

    void loadCurrentProject()
    return () => {
      cancelled = true
    }
  }, [isProjectOpen, loadWell, resetWell])

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

  async function handleProjectClose(): Promise<void> {
    await closeProject()
    setWellOptions([])
    setActiveDialog('project-open')
  }

  async function handleWellMutation(wellId: string): Promise<void> {
    await refreshWellList(wellId)
  }

  function renderDialog() {
    switch (activeDialog) {
      case 'project-open':
        return <FileOpenDialog onSwitchToNew={() => setActiveDialog('project-new')} onClose={isProjectOpen ? () => setActiveDialog(null) : undefined} />
      case 'project-new':
        return <NewProjectDialog onSwitchToOpen={() => setActiveDialog('project-open')} onClose={isProjectOpen ? () => setActiveDialog(null) : undefined} />
      case 'create-well':
        return <CreateWellDialog onClose={() => setActiveDialog(null)} onSuccess={handleWellMutation} />
      case 'load-las':
        return <ImportLasDialog wells={wellOptions} onClose={() => setActiveDialog(null)} onSuccess={handleWellMutation} />
      case 'load-tops':
        return <ImportTopsDialog wells={wellOptions} onClose={() => setActiveDialog(null)} onSuccess={handleWellMutation} />
      case 'load-deviation':
        return <ImportDeviationDialog wells={wellOptions} onClose={() => setActiveDialog(null)} onSuccess={handleWellMutation} />
      default:
        return null
    }
  }

  const dialogContent = renderDialog()

  return (
    <div className="app-layout">
      <header className="app-topbar">
        <span className="app-topbar__brand">SUBSIDENCE</span>
        <span className="app-topbar__project">{isDirty ? '* ' : ''}{projectName ?? '-'}</span>
        <span className="app-topbar__well">{topbarTitle}</span>

        {isProjectOpen && (
          <div className="app-topbar__actions">
            <button type="button" className="app-action-button" onClick={() => setActiveDialog('project-new')}>New project</button>
            <button type="button" className="app-action-button" onClick={() => setActiveDialog('project-open')}>Open project</button>
            <button type="button" className="app-action-button" onClick={() => void handleProjectClose()}>Close project</button>
            <button type="button" className="app-action-button app-action-button--primary" onClick={() => void saveProject()} disabled={!isDirty}>Save project</button>

            <span className="app-topbar__divider" />

            <button type="button" className="app-action-button" onClick={() => setActiveDialog('create-well')}>Create well</button>
            <button type="button" className="app-action-button" onClick={() => setActiveDialog('load-las')}>Load LAS</button>
            <button type="button" className="app-action-button" onClick={() => setActiveDialog('load-tops')}>Load tops</button>
            <button type="button" className="app-action-button" onClick={() => setActiveDialog('load-deviation')}>Load deviation</button>

            <span className="app-topbar__divider" />

            <button type="button" className="app-action-button" onClick={() => void undoProject()} disabled={!canUndo}>Undo</button>
            <button type="button" className="app-action-button" onClick={() => void redoProject()} disabled={!canRedo}>Redo</button>

            <span className="app-topbar__divider" />

            <select
              className="app-well-selector"
              value={well?.well_id ?? ''}
              onChange={(event) => void loadWell(event.target.value)}
              disabled={wellOptions.length === 0}
            >
              {wellOptions.length === 0 ? (
                <option value="">No wells</option>
              ) : (
                wellOptions.map((item) => (
                  <option key={item.well_id} value={item.well_id}>{item.well_name}</option>
                ))
              )}
            </select>

            <ZoomControl />
          </div>
        )}

        {curves.length > 0 && (
          <span className="app-topbar__meta">
            {curves.length} curves | {curves[0].depths.length.toLocaleString()} samples
          </span>
        )}
      </header>
      <main className={isProjectOpen ? 'app-main' : 'app-main app-main--gated'}>
        {isProjectOpen ? (
          <div className="app-workspace">
            <aside className="app-sidebar">
              <section className="sidebar-panel">
                <header className="sidebar-tabs">
                  <button
                    type="button"
                    className={`sidebar-tab ${activeSidebarTab === 'wells' ? 'sidebar-tab--active' : ''}`}
                    onClick={() => setActiveSidebarTab('wells')}
                  >
                    Wells
                  </button>
                  <button
                    type="button"
                    className={`sidebar-tab ${activeSidebarTab === 'models' ? 'sidebar-tab--active' : ''}`}
                    onClick={() => setActiveSidebarTab('models')}
                  >
                    Models
                  </button>
                </header>

                {activeSidebarTab === 'wells' ? (
                  <WellDataPanel well={well} curves={curves} formations={formations} />
                ) : (
                  <div className="sidebar-panel__body">
                    <p className="sidebar-panel__empty">Reserved for upcoming modelling workflows.</p>
                  </div>
                )}
              </section>
            </aside>

            <section className="app-main-pane">
              {error ? (
                <p className="app-error-banner">{error}</p>
              ) : well && curves.length === 0 ? (
                <p className="app-error-banner">Well loaded. No curves imported yet.</p>
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
            </section>
          </div>
        ) : null}

        {dialogContent && (
          <div className="project-dialog-overlay">
            {dialogContent}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
