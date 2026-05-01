import { useEffect, useMemo, useRef, useState } from 'react'

import { CreateWellDialog } from './CreateWellDialog'
import { FileOpenDialog } from './FileOpenDialog'
import { ImportDeviationDialog } from './ImportDeviationDialog'
import { ImportLasDialog } from './ImportLasDialog'
import { ImportTopsDialog } from './ImportTopsDialog'
import { LoadStratChartDialog } from './LoadStratChartDialog'
import { NewProjectDialog } from './NewProjectDialog'
import { useProjectStore, useViewStore, useWellDataStore, useWorkspaceStore } from '@/stores'
import { buildDiagnosticSnapshot } from '@/utils/diagnostics'

type DialogKind = 'project-open' | 'project-new' | 'create-well' | 'load-las' | 'load-tops' | 'load-deviation' | 'load-strat-chart' | null

interface UnsavedChangesDialogProps {
  projectName: string | null
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

function UnsavedChangesDialog({ projectName, onSave, onDiscard, onCancel }: UnsavedChangesDialogProps) {
  return (
    <div className="project-dialog">
      <header className="project-dialog__header">
        <div>
          <p className="project-dialog__eyebrow">Unsaved changes</p>
          <h2 className="project-dialog__title">Save "{projectName ?? 'project'}"?</h2>
        </div>
      </header>
      <div className="project-dialog__body">
        <div className="project-dialog__actions" style={{ gap: 8 }}>
          <button type="button" className="project-dialog__button" onClick={onCancel}>Cancel</button>
          <button type="button" className="project-dialog__button" onClick={onDiscard}>{"Don't Save"}</button>
          <button type="button" className="project-dialog__button project-dialog__button--primary" onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
  )
}

export function ProjectToolbar() {
  const [activeDialog, setActiveDialog] = useState<DialogKind>(() =>
    useProjectStore.getState().isOpen ? null : 'project-open',
  )
  const [projectMenuOpen, setProjectMenuOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<'new-project' | 'open-project' | 'close-project' | null>(null)
  const projectMenuRef = useRef<HTMLDivElement | null>(null)

  const well = useWellDataStore((state) => state.well)
  const curves = useWellDataStore((state) => state.curves)
  const stratCharts = useWellDataStore((state) => state.stratCharts)
  const wellInventories = useWellDataStore((state) => state.wellInventories)
  const isLoading = useWellDataStore((state) => state.isLoading)
  const cancelLoading = useWellDataStore((state) => state.cancelLoading)
  const error = useWellDataStore((state) => state.error)
  const loadWell = useWellDataStore((state) => state.loadWell)
  const loadStratCharts = useWellDataStore((state) => state.loadStratCharts)
  const deleteChart = useWellDataStore((state) => state.deleteChart)
  const refreshWell = useWellDataStore((state) => state.refreshWell)

  const isProjectOpen = useProjectStore((state) => state.isOpen)
  const prevIsProjectOpenRef = useRef(isProjectOpen)
  const projectName = useProjectStore((state) => state.projectName)
  const projectPath = useProjectStore((state) => state.projectPath)
  const isDirty = useProjectStore((state) => state.isDirty)
  const canUndo = useProjectStore((state) => state.canUndo)
  const canRedo = useProjectStore((state) => state.canRedo)
  const saveProject = useProjectStore((state) => state.saveProject)
  const createCheckpoint = useProjectStore((state) => state.createCheckpoint)
  const closeProject = useProjectStore((state) => state.closeProject)
  const undoProject = useProjectStore((state) => state.undo)
  const redoProject = useProjectStore((state) => state.redo)

  const activeSidebarTab = useWorkspaceStore((state) => state.activeSidebarTab)
  const lodEnabled = useViewStore((state) => state.lodEnabled)
  const setLodEnabled = useViewStore((state) => state.setLodEnabled)

  const wellOptions = useMemo(
    () => wellInventories.map((item) => ({ well_id: item.well_id, well_name: item.well_name })),
    [wellInventories],
  )

  const topbarTitle = !isProjectOpen
    ? 'No project open'
    : isLoading
      ? 'Loading well...'
      : error
        ? 'Error loading well'
        : (well?.well_name ?? 'No wells in project')

  useEffect(() => {
    const wasOpen = prevIsProjectOpenRef.current
    prevIsProjectOpenRef.current = isProjectOpen
    if (!isProjectOpen) {
      if (activeDialog === null) setActiveDialog('project-open')
      return
    }
    // Only auto-dismiss open/new dialogs on transition false → true (project just opened/created)
    if (!wasOpen && (activeDialog === 'project-open' || activeDialog === 'project-new')) {
      setActiveDialog(null)
    }
  }, [activeDialog, isProjectOpen])

  useEffect(() => {
    if (!isProjectOpen) {
      setProjectMenuOpen(false)
    }
  }, [isProjectOpen])

  useEffect(() => {
    if (!projectMenuOpen) return

    const onPointerDown = (event: MouseEvent) => {
      if (!projectMenuRef.current?.contains(event.target as Node)) {
        setProjectMenuOpen(false)
      }
    }

    window.addEventListener('mousedown', onPointerDown)
    return () => window.removeEventListener('mousedown', onPointerDown)
  }, [projectMenuOpen])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isProjectOpen || !event.ctrlKey) return

      if (event.key.toLowerCase() === 's') {
        event.preventDefault()
        void saveProject()
        return
      }

      if (event.key.toLowerCase() === 'z' && event.shiftKey) {
        event.preventDefault()
        void redoProject()
        return
      }

      if (event.key.toLowerCase() === 'z') {
        event.preventDefault()
        void undoProject()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canRedo, canUndo, isProjectOpen, redoProject, saveProject, undoProject])

  async function executeAction(action: 'new-project' | 'open-project' | 'close-project'): Promise<void> {
    if (action === 'close-project') {
      await closeProject()
      setActiveDialog('project-open')
    } else {
      // open/new: show the dialog — it has Cancel built in via onClose
      setActiveDialog(action === 'new-project' ? 'project-new' : 'project-open')
    }
  }

  function requestAction(action: 'new-project' | 'open-project' | 'close-project'): void {
    setProjectMenuOpen(false)
    if (isProjectOpen && isDirty) {
      setPendingAction(action)
      return
    }
    void executeAction(action)
  }

  async function handleCopyDiagnostics(): Promise<void> {
    const snapshot = buildDiagnosticSnapshot({
      projectName,
      projectPath,
      activeWellId: well?.well_id ?? null,
      activeWellName: well?.well_name ?? null,
      selectedFormationId,
      activeSidebarTab,
      curveCount: curves.length,
      formationCount: formations.length,
    })
    const body = JSON.stringify(snapshot, null, 2)
    try {
      await navigator.clipboard.writeText(body)
      window.alert('Diagnostics copied to clipboard.')
    } catch {
      window.prompt('Copy diagnostics JSON', body)
    }
  }

  async function handleDeleteStratChart(): Promise<void> {
    const activeChart = stratCharts.find((c) => c.is_active) ?? null
    if (!activeChart) return
    if (activeChart.is_builtin) {
      window.alert('Built-in ICS chart cannot be deleted.')
      return
    }
    if (!window.confirm(`Delete stratigraphic chart "${activeChart.name}"? Formation links to this chart will be cleared.`)) return

    try {
      await deleteChart(activeChart.id)
      if (well?.well_id) await loadWell(well.well_id)
    } catch {
      window.alert('Failed to delete the active stratigraphic chart')
    }
  }

  async function handleWellMutation(wellId: string): Promise<void> {
    await refreshWell(wellId)
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
        return <ImportLasDialog wells={wellOptions} activeWellId={well?.well_id} onClose={() => setActiveDialog(null)} onSuccess={handleWellMutation} />
      case 'load-tops':
        return <ImportTopsDialog wells={wellOptions} activeWellId={well?.well_id} onClose={() => setActiveDialog(null)} onSuccess={handleWellMutation} />
      case 'load-deviation':
        return <ImportDeviationDialog wells={wellOptions} activeWellId={well?.well_id} onClose={() => setActiveDialog(null)} onSuccess={handleWellMutation} />
      case 'load-strat-chart':
        return (
          <LoadStratChartDialog
            onClose={() => setActiveDialog(null)}
            onSuccess={async (_count) => {
              setActiveDialog(null)
              await loadStratCharts()
              if (well?.well_id) await loadWell(well.well_id)
            }}
          />
        )
      default:
        return null
    }
  }

  const projectMenuActions = (
    <>
      <button type="button" className="app-menu__item" onClick={() => requestAction('new-project')}>New project</button>
      <button type="button" className="app-menu__item" onClick={() => requestAction('open-project')}>Open project</button>
      <button type="button" className="app-menu__item" onClick={() => requestAction('close-project')}>Close project</button>
      <button type="button" className="app-menu__item" onClick={() => { setProjectMenuOpen(false); void saveProject() }}>Save project</button>
      <button type="button" className="app-menu__item" onClick={() => { setProjectMenuOpen(false); void createCheckpoint() }}>Create checkpoint</button>
      <button type="button" className="app-menu__item" onClick={() => { setProjectMenuOpen(false); void handleCopyDiagnostics() }}>Copy diagnostics</button>
      <hr className="app-menu__separator" />
      <button type="button" className="app-menu__item app-menu__item--check" onClick={() => setLodEnabled(!lodEnabled)}>
        <span className="app-menu__checkmark">{lodEnabled ? '✓' : ''}</span>
        LOD
      </button>
    </>
  )

  const stratChartModeActions = (
    <>
      <button type="button" className="app-action-button" onClick={() => setActiveDialog('load-strat-chart')}>Load StratChart</button>
      <button
        type="button"
        className="app-action-button"
        onClick={() => void handleDeleteStratChart()}
        disabled={!stratCharts.some((c) => c.is_active && !c.is_builtin)}
      >
        Delete StratChart
      </button>
    </>
  )

  const wellsModeActions = (
    <>
      <button type="button" className="app-action-button" onClick={() => setActiveDialog('create-well')}>Create well</button>
      <button type="button" className="app-action-button" onClick={() => setActiveDialog('load-las')}>Load logs</button>
      <button type="button" className="app-action-button" onClick={() => setActiveDialog('load-tops')}>Load tops</button>
      <button type="button" className="app-action-button" onClick={() => setActiveDialog('load-deviation')}>Load deviation</button>
    </>
  )

  const dialogContent = renderDialog()

  return (
    <>
      <header className="app-topbar">
        <div className="app-topbar__row">
          <span className="app-topbar__brand">SUBSIDENCE</span>
          <span className="app-topbar__project">{isDirty ? '* ' : ''}{projectName ?? '-'}</span>
          <span className="app-topbar__well">{topbarTitle}</span>

          {isProjectOpen && (
            <div className="app-topbar__actions">
              <div className="app-menu" ref={projectMenuRef}>
                <button
                  type="button"
                  className={`app-action-button ${projectMenuOpen ? 'app-action-button--mode-active' : ''}`}
                  onClick={() => setProjectMenuOpen((open) => !open)}
                >
                  Project
                </button>
                {projectMenuOpen ? (
                  <div className="app-menu__dropdown">
                    {projectMenuActions}
                  </div>
                ) : null}
              </div>
              <button type="button" className="app-action-button" onClick={() => void undoProject()} disabled={!canUndo}>Undo</button>
              <button type="button" className="app-action-button" onClick={() => void redoProject()} disabled={!canRedo}>Redo</button>
            </div>
          )}

          {isLoading && (
            <button type="button" className="app-action-button" onClick={cancelLoading}>Cancel loading</button>
          )}
          {curves.length > 0 && (
            <span className="app-topbar__meta">
              {curves.length} curves | {curves[0].depths.length.toLocaleString()} samples
            </span>
          )}
        </div>

        {isProjectOpen && (
          <div className="app-topbar__row app-topbar__row--secondary">
            <div className="app-topbar__actions">
              {activeSidebarTab === 'strat-charts' ? stratChartModeActions : null}
              {activeSidebarTab === 'wells' ? wellsModeActions : null}
            </div>
          </div>
        )}
      </header>

      {dialogContent && (
        <div className="project-dialog-overlay">
          {dialogContent}
        </div>
      )}
      {pendingAction !== null && (
        <div className="project-dialog-overlay">
          <UnsavedChangesDialog
            projectName={projectName}
            onCancel={() => setPendingAction(null)}
            onDiscard={() => {
              const action = pendingAction
              setPendingAction(null)
              void executeAction(action)
            }}
            onSave={() => {
              const action = pendingAction
              setPendingAction(null)
              void saveProject().then(() => executeAction(action))
            }}
          />
        </div>
      )}
    </>
  )
}
