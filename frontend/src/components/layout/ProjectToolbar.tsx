import { useEffect, useMemo, useRef, useState } from 'react'

import { CreateWellDialog } from './CreateWellDialog'
import { FileOpenDialog } from './FileOpenDialog'
import { ImportDeviationDialog } from './ImportDeviationDialog'
import { ImportLasDialog } from './ImportLasDialog'
import { ImportTopsDialog } from './ImportTopsDialog'
import { LinkStratChartDialog } from './LinkStratChartDialog'
import { LoadStratChartDialog } from './LoadStratChartDialog'
import { NewProjectDialog } from './NewProjectDialog'
import { ZoomControl } from './ZoomControl'
import { useProjectStore, useViewStore, useWellDataStore, useWorkspaceStore } from '@/stores'
import type { FormationTop } from '@/types'
import { buildDiagnosticSnapshot } from '@/utils/diagnostics'

type DialogKind = 'project-open' | 'project-new' | 'create-well' | 'load-las' | 'load-tops' | 'load-deviation' | 'link-top' | 'load-strat-chart' | 'set-top-type' | null
type FormationTypeOption = 'strat' | 'unconformity'

const FORMATION_TYPE_OPTIONS: FormationTypeOption[] = ['strat', 'unconformity']

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: string }
    if (payload.detail) return payload.detail
  } catch {
    // ignore non-JSON payloads
  }
  return fallback
}

interface SetFormationTypeDialogProps {
  formationName: string
  initialType: FormationTypeOption
  onClose: () => void
  onConfirm: (nextType: FormationTypeOption) => void | Promise<void>
}

function SetFormationTypeDialog({
  formationName,
  initialType,
  onClose,
  onConfirm,
}: SetFormationTypeDialogProps) {
  const [nextType, setNextType] = useState<FormationTypeOption>(initialType)

  return (
    <div className="project-dialog">
      <header className="project-dialog__header">
        <div>
          <p className="project-dialog__eyebrow">Top type</p>
          <h2 className="project-dialog__title">{formationName}</h2>
        </div>
        <button type="button" className="project-dialog__link" onClick={onClose}>Close</button>
      </header>

      <div className="project-dialog__body">
        <label className="project-dialog__field">
          <span>Type</span>
          <select value={nextType} onChange={(event) => setNextType(event.target.value as FormationTypeOption)}>
            {FORMATION_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>

        <div className="project-dialog__actions" style={{ gap: 8 }}>
          <button type="button" className="project-dialog__button" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="project-dialog__button project-dialog__button--primary"
            onClick={() => void onConfirm(nextType)}
          >
            Set type
          </button>
        </div>
      </div>
    </div>
  )
}

export function ProjectToolbar() {
  const [activeDialog, setActiveDialog] = useState<DialogKind>('project-open')
  const [formationLinkTarget, setFormationLinkTarget] = useState<FormationTop | null>(null)
  const [projectMenuOpen, setProjectMenuOpen] = useState(false)
  const projectMenuRef = useRef<HTMLDivElement | null>(null)

  const well = useWellDataStore((state) => state.well)
  const formations = useWellDataStore((state) => state.formations)
  const curves = useWellDataStore((state) => state.curves)
  const stratCharts = useWellDataStore((state) => state.stratCharts)
  const wellInventories = useWellDataStore((state) => state.wellInventories)
  const isLoading = useWellDataStore((state) => state.isLoading)
  const error = useWellDataStore((state) => state.error)
  const addFormation = useWellDataStore((state) => state.addFormation)
  const removeFormation = useWellDataStore((state) => state.removeFormation)
  const linkFormationToChart = useWellDataStore((state) => state.linkFormationToChart)
  const loadWell = useWellDataStore((state) => state.loadWell)
  const loadStratCharts = useWellDataStore((state) => state.loadStratCharts)
  const deleteChart = useWellDataStore((state) => state.deleteChart)
  const refreshWell = useWellDataStore((state) => state.refreshWell)

  const isProjectOpen = useProjectStore((state) => state.isOpen)
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
  const selectedFormationId = useWorkspaceStore((state) => state.selectedFormationId)
  const setSelectedFormationId = useWorkspaceStore((state) => state.setSelectedFormationId)
  const updateWellViewState = useWorkspaceStore((state) => state.updateWellViewState)
  const dropWellViewState = useWorkspaceStore((state) => state.dropWellViewState)

  const selectTrack = useViewStore((state) => state.selectTrack)
  const lodEnabled = useViewStore((state) => state.lodEnabled)
  const setLodEnabled = useViewStore((state) => state.setLodEnabled)

  const wellOptions = useMemo(
    () => wellInventories.map((item) => ({ well_id: item.well_id, well_name: item.well_name })),
    [wellInventories],
  )

  const selectedFormation = useMemo(
    () => formations.find((f) => f.id === selectedFormationId) ?? null,
    [formations, selectedFormationId],
  )

  const topbarTitle = !isProjectOpen
    ? 'No project open'
    : isLoading
      ? 'Loading well...'
      : error
        ? 'Error loading well'
        : (well?.well_name ?? 'No wells in project')

  useEffect(() => {
    if (!isProjectOpen) {
      if (activeDialog === null) setActiveDialog('project-open')
      return
    }
    if (activeDialog === 'project-open' || activeDialog === 'project-new') {
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

  async function handleProjectClose(): Promise<void> {
    setProjectMenuOpen(false)
    await closeProject()
    setActiveDialog('project-open')
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

  async function handleDeleteWell(): Promise<void> {
    if (!well) return
    if (!window.confirm(`Delete well "${well.well_name}"?`)) return

    try {
      const response = await fetch(`/api/projects/wells/${well.well_id}`, { method: 'DELETE' })
      if (!response.ok) {
        throw new Error(await readError(response, `Failed to delete well '${well.well_name}' (${response.status})`))
      }
      dropWellViewState(well.well_id)
      setSelectedFormationId(null)
      selectTrack(null)
      await refreshWell()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to delete well.')
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

  async function handleAddFormation(): Promise<void> {
    if (!well?.well_id) return
    const vs = useViewStore.getState()
    const referenceDepth = vs.cursorDepth ?? vs.visibleDepthRange.min
    await addFormation({
      name: `Top ${formations.length + 1}`,
      depth_md: Number(referenceDepth.toFixed(1)),
      color: '#9ca3af',
    })
    const latest = useWellDataStore.getState().formations.at(-1)
    if (latest) {
      setSelectedFormationId(latest.id)
      updateWellViewState(well.well_id, (state) => ({
        ...state,
        visibleFormationIds: Array.from(new Set([...state.visibleFormationIds, latest.id])),
      }))
    }
  }

  async function handleDeleteAllFormations(): Promise<void> {
    if (!well?.well_id || formations.length === 0) return
    for (const formation of formations) {
      // eslint-disable-next-line no-await-in-loop
      await removeFormation(formation.id)
    }
    updateWellViewState(well.well_id, (state) => ({ ...state, visibleFormationIds: [] }))
    setSelectedFormationId(null)
  }

  function handleRemoveFormation(formationId: string): void {
    if (!well?.well_id) return
    updateWellViewState(well.well_id, (state) => ({
      ...state,
      visibleFormationIds: state.visibleFormationIds.filter((id) => id !== formationId),
    }))
    if (selectedFormationId === formationId) setSelectedFormationId(null)
    void removeFormation(formationId)
  }

  async function handleSetFormationAge(): Promise<void> {
    if (!selectedFormation) return
    const value = window.prompt('Set top age (Ma)', selectedFormation.age_ma?.toString() ?? '')
    if (value === null) return
    const trimmed = value.trim()
    const age = trimmed ? Number(trimmed) : undefined
    if (trimmed && !Number.isFinite(age)) return
    await useWellDataStore.getState().updateFormation(selectedFormation.id, { age_ma: age })
  }

  async function handleSetFormationType(): Promise<void> {
    if (!selectedFormation) return
    setActiveDialog('set-top-type')
  }

  async function handleMoveSelectedFormation(): Promise<void> {
    if (!selectedFormation) return
    const value = window.prompt('Move top to depth (MD)', selectedFormation.depth_md.toString())
    if (value === null) return
    const nextDepth = Number(value.trim())
    if (!Number.isFinite(nextDepth)) return
    void useWellDataStore.getState().updateFormationDepth(selectedFormation.id, nextDepth)
  }

  function handleOpenFormationLink(formationId: string): void {
    const formation = formations.find((f) => f.id === formationId) ?? null
    setFormationLinkTarget(formation)
    setActiveDialog('link-top')
  }

  async function handleLinkFormation(stratUnitId: number | null): Promise<void> {
    if (!formationLinkTarget) return
    const activeChart = stratCharts.find((c) => c.is_active) ?? null
    if (activeChart) {
      await linkFormationToChart(formationLinkTarget.id, activeChart.id, stratUnitId)
    }
    setFormationLinkTarget(null)
    setActiveDialog(null)
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
      case 'link-top': {
        const activeChart = stratCharts.find((c) => c.is_active) ?? null
        const currentUnitId = formationLinkTarget
          ? formationLinkTarget.strat_links.find((l) => l.chart_id === activeChart?.id)?.strat_unit_id
          : undefined
        return formationLinkTarget ? (
          <LinkStratChartDialog
            formationName={formationLinkTarget.name}
            activeChartId={activeChart?.id ?? null}
            currentUnitId={currentUnitId}
            onClose={() => { setFormationLinkTarget(null); setActiveDialog(null) }}
            onSelect={handleLinkFormation}
          />
        ) : null
      }
      case 'set-top-type':
        return selectedFormation ? (
          <SetFormationTypeDialog
            formationName={selectedFormation.name}
            initialType={
              FORMATION_TYPE_OPTIONS.includes(selectedFormation.kind as FormationTypeOption)
                ? selectedFormation.kind as FormationTypeOption
                : 'strat'
            }
            onClose={() => setActiveDialog(null)}
            onConfirm={async (nextType) => {
              await useWellDataStore.getState().updateFormation(selectedFormation.id, { kind: nextType })
              setActiveDialog(null)
            }}
          />
        ) : null
      default:
        return null
    }
  }

  const projectMenuActions = (
    <>
      <button type="button" className="app-menu__item" onClick={() => { setProjectMenuOpen(false); setActiveDialog('project-new') }}>New project</button>
      <button type="button" className="app-menu__item" onClick={() => { setProjectMenuOpen(false); setActiveDialog('project-open') }}>Open project</button>
      <button type="button" className="app-menu__item" onClick={() => void handleProjectClose()}>Close project</button>
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
      <button type="button" className="app-action-button" onClick={() => void handleDeleteWell()} disabled={!well}>Delete well</button>
    </>
  )

  const topsModeActions = (
    <>
      <button type="button" className="app-action-button" onClick={() => setActiveDialog('load-tops')}>Load tops</button>
      <button type="button" className="app-action-button" onClick={() => void handleAddFormation()} disabled={!well}>Add top</button>
      <button type="button" className="app-action-button" onClick={() => selectedFormation && handleOpenFormationLink(selectedFormation.id)} disabled={!selectedFormation}>Link top</button>
      <button type="button" className="app-action-button" onClick={() => void handleSetFormationAge()} disabled={!selectedFormation}>Set age</button>
      <button type="button" className="app-action-button" onClick={() => void handleSetFormationType()} disabled={!selectedFormation}>Set type</button>
      <button type="button" className="app-action-button" onClick={() => selectedFormation && handleRemoveFormation(selectedFormation.id)} disabled={!selectedFormation}>Delete top</button>
      <button type="button" className="app-action-button" onClick={() => void handleDeleteAllFormations()} disabled={formations.length === 0}>Delete all tops</button>
      <button type="button" className="app-action-button" onClick={() => void handleMoveSelectedFormation()} disabled={!selectedFormation}>Move top</button>
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
              {activeSidebarTab === 'wells' ? (
                <>
                  {wellsModeActions}
                  <span className="app-topbar__divider" />
                  {topsModeActions}
                </>
              ) : null}
            </div>
            <ZoomControl />
          </div>
        )}
      </header>

      {dialogContent && (
        <div className="project-dialog-overlay">
          {dialogContent}
        </div>
      )}
    </>
  )
}
