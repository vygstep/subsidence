import { useEffect, useMemo, useRef, useState } from 'react'

import {
  CreateWellDialog,
  FileOpenDialog,
  ImportDeviationDialog,
  ImportLasDialog,
  ImportTopsDialog,
  LinkStratChartDialog,
  LoadStratChartDialog,
  LogViewPanel,
  NewProjectDialog,
  StratChartTab,
  WellDataPanel,
  ZoomControl,
} from '@/components'
import { useProjectStore, useViewStore, useWellDataStore } from '@/stores'
import type { CurveData, FormationTop, TrackConfig } from '@/types'

interface WellListItem {
  well_id: string
  well_name: string
}

type DialogKind = 'project-open' | 'project-new' | 'create-well' | 'load-las' | 'load-tops' | 'load-deviation' | 'link-top' | 'load-strat-chart' | null
type SidebarTab = 'wells' | 'models' | 'templates' | 'strat-charts'
type ToolbarMode = 'project' | 'strat-chart' | 'wells' | 'tops'

interface WellViewState {
  tracks: TrackConfig[]
  visibleFormationIds: string[]
  deviationVisible: boolean
  hiddenTrackIds: string[]
}

const TRACK_COLORS = ['#22c55e', '#ef4444', '#2563eb', '#f59e0b', '#8b5cf6', '#0f766e', '#dc2626', '#475569']

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: string }
    if (payload.detail) {
      return payload.detail
    }
  } catch {
    // Ignore non-JSON error payloads.
  }
  return fallback
}

function computeCurveBounds(curve: CurveData): { min: number; max: number } {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY

  for (let index = 0; index < curve.values.length; index += 1) {
    const value = curve.values[index]
    if (!Number.isFinite(value) || value === curve.null_value) {
      continue
    }
    min = Math.min(min, value)
    max = Math.max(max, value)
  }

  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    const fallback = Number.isFinite(min) ? min : 0
    return { min: fallback, max: fallback + 1 }
  }

  return { min, max }
}

function createEmptyTrack(trackId = 'track-1', title = 'Track 1'): TrackConfig {
  return {
    id: trackId,
    title,
    width: 200,
    scaleType: 'linear',
    gridDivisions: 3,
    showGrid: true,
    curves: [],
  }
}

function createDefaultWellView(): WellViewState {
  return {
    tracks: [createEmptyTrack()],
    visibleFormationIds: [],
    deviationVisible: false,
    hiddenTrackIds: [],
  }
}

function nextTrackNumber(tracks: TrackConfig[]): number {
  const numbers = tracks.map((track) => {
    const match = /^track-(\d+)$/.exec(track.id)
    return match ? Number(match[1]) : 0
  })
  return Math.max(0, ...numbers) + 1
}

function createCurveConfig(curve: CurveData, index: number): TrackConfig['curves'][number] {
  const bounds = computeCurveBounds(curve)
  return {
    mnemonic: curve.mnemonic,
    unit: curve.unit,
    color: TRACK_COLORS[index % TRACK_COLORS.length],
    lineWidth: 1.5,
    lineStyle: 'solid',
    scaleMin: bounds.min,
    scaleMax: bounds.max,
    scaleReversed: false,
  }
}

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
  const [activeToolbarMode, setActiveToolbarMode] = useState<ToolbarMode>('project')
  const [wellOptions, setWellOptions] = useState<WellListItem[]>([])
  const [wellViewStates, setWellViewStates] = useState<Record<string, WellViewState>>({})
  const [formationLinkTarget, setFormationLinkTarget] = useState<FormationTop | null>(null)
  const [selectedFormationId, setSelectedFormationId] = useState<string | null>(null)

  const loadWell = useWellDataStore((state) => state.loadWell)
  const resetWell = useWellDataStore((state) => state.reset)
  const addFormation = useWellDataStore((state) => state.addFormation)
  const updateFormation = useWellDataStore((state) => state.updateFormation)
  const updateFormationDepth = useWellDataStore((state) => state.updateFormationDepth)
  const removeFormation = useWellDataStore((state) => state.removeFormation)
  const linkFormationToChart = useWellDataStore((state) => state.linkFormationToChart)
  const loadStratCharts = useWellDataStore((state) => state.loadStratCharts)
  const activateChart = useWellDataStore((state) => state.activateChart)
  const deleteChart = useWellDataStore((state) => state.deleteChart)
  const stratCharts = useWellDataStore((state) => state.stratCharts)
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
  const createCheckpoint = useProjectStore((state) => state.createCheckpoint)
  const closeProject = useProjectStore((state) => state.closeProject)
  const undoProject = useProjectStore((state) => state.undo)
  const redoProject = useProjectStore((state) => state.redo)

  const depthPerPixel = useViewStore((state) => state.depthPerPixel)
  const selectedTrackId = useViewStore((state) => state.selectedTrackId)
  const selectTrack = useViewStore((state) => state.selectTrack)
  const trackWidths = useViewStore((state) => state.trackWidths)
  const resetVisualConfig = useViewStore((state) => state.resetVisualConfig)

  const configHydratedRef = useRef(false)

  function updateWellViewState(wellId: string, updater: (state: WellViewState) => WellViewState): void {
    setWellViewStates((current) => ({
      ...current,
      [wellId]: updater(current[wellId] ?? createDefaultWellView()),
    }))
  }

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
      setActiveToolbarMode('project')
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
      selectTrack(null)
      setSelectedFormationId(null)
      setWellViewStates({})
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
    if (!isProjectOpen) return
    void loadStratCharts()
  }, [isProjectOpen, loadStratCharts])

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

  const activeWellView = useMemo(() => {
    if (!well?.well_id) {
      return createDefaultWellView()
    }
    return wellViewStates[well.well_id] ?? createDefaultWellView()
  }, [well?.well_id, wellViewStates])

  const tracks = useMemo(() => (
    activeWellView.tracks
      .filter((track) => !activeWellView.hiddenTrackIds.includes(track.id))
      .map((track) => ({
      ...track,
      curves: track.curves.map((curve) => ({
        ...curve,
        color: colorOverrides[curve.mnemonic] ?? curve.color,
      })),
    }))
  ), [activeWellView.hiddenTrackIds, activeWellView.tracks, colorOverrides])

  const visibleCurveMnemonics = useMemo(() => (
    Array.from(new Set(activeWellView.tracks.flatMap((track) => track.curves.map((curve) => curve.mnemonic))))
  ), [activeWellView.tracks])

  const visibleFormationIds = activeWellView.visibleFormationIds

  const visibleFormations = useMemo(() => (
    formations.filter((formation) => visibleFormationIds.includes(formation.id))
  ), [formations, visibleFormationIds])

  useEffect(() => {
    if (selectedFormationId && !formations.some((formation) => formation.id === selectedFormationId)) {
      setSelectedFormationId(null)
    }
  }, [formations, selectedFormationId])

  useEffect(() => {
    if (!well?.well_id) {
      selectTrack(null)
      setSelectedFormationId(null)
      return
    }

    setWellViewStates((current) => (
      current[well.well_id]
        ? current
        : { ...current, [well.well_id]: createDefaultWellView() }
    ))
    selectTrack(null)
    setSelectedFormationId(null)
  }, [well?.well_id, selectTrack])

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

  async function handleDeleteWell(): Promise<void> {
    if (!well) {
      return
    }

    const confirmed = window.confirm(`Delete well "${well.well_name}"?`)
    if (!confirmed) {
      return
    }

    try {
      const response = await fetch(`/api/projects/wells/${well.well_id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error(await readError(response, `Failed to delete well '${well.well_name}' (${response.status})`))
      }

      setWellViewStates((current) => {
        const next = { ...current }
        delete next[well.well_id]
        return next
      })
      setSelectedFormationId(null)
      selectTrack(null)
      await refreshWellList()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Failed to delete well.')
    }
  }

  function handleSelectWell(wellId: string): void {
    selectTrack(null)
    void loadWell(wellId)
  }

  function handleSetDeviationVisible(nextValue: boolean): void {
    if (!well?.well_id) {
      return
    }
    updateWellViewState(well.well_id, (state) => ({
      ...state,
      deviationVisible: nextValue,
    }))
  }

  function handleToggleFormation(formationId: string, nextValue: boolean): void {
    if (!well?.well_id) {
      return
    }

    updateWellViewState(well.well_id, (state) => ({
      ...state,
      visibleFormationIds: nextValue
        ? Array.from(new Set([...state.visibleFormationIds, formationId]))
        : state.visibleFormationIds.filter((id) => id !== formationId),
    }))
  }

  function handleSelectFormation(formationId: string): void {
    setSelectedFormationId(formationId)
    setActiveToolbarMode('tops')
  }

  function handleToggleAllFormations(nextValue: boolean): void {
    if (!well?.well_id) {
      return
    }

    updateWellViewState(well.well_id, (state) => ({
      ...state,
      visibleFormationIds: nextValue ? formations.map((formation) => formation.id) : [],
    }))
  }

  async function handleAddFormation(): Promise<void> {
    if (!well?.well_id) {
      return
    }

    const referenceDepth = useViewStore.getState().cursorDepth ?? useViewStore.getState().visibleDepthRange.min
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

  function handleMoveFormation(formationId: string, depth: number): void {
    if (!Number.isFinite(depth)) {
      return
    }
    void updateFormationDepth(formationId, depth)
  }

  function handleRemoveFormation(formationId: string): void {
    if (!well?.well_id) {
      return
    }

    updateWellViewState(well.well_id, (state) => ({
      ...state,
      visibleFormationIds: state.visibleFormationIds.filter((id) => id !== formationId),
    }))
    if (selectedFormationId === formationId) {
      setSelectedFormationId(null)
    }
    void removeFormation(formationId)
  }

  function handleOpenFormationLink(formationId: string): void {
    const formation = formations.find((item) => item.id === formationId) ?? null
    setFormationLinkTarget(formation)
    setActiveDialog('link-top')
  }

  async function handleLinkFormation(stratUnitId: number | null): Promise<void> {
    if (!formationLinkTarget) return
    const activeChart = stratCharts.find((c) => c.is_active) ?? null
    if (stratUnitId !== null && activeChart) {
      await linkFormationToChart(formationLinkTarget.id, activeChart.id, stratUnitId)
    }
    setFormationLinkTarget(null)
    setActiveDialog(null)
  }

  const selectedFormation = useMemo(
    () => formations.find((item) => item.id === selectedFormationId) ?? null,
    [formations, selectedFormationId],
  )

  async function handleSetFormationAge(): Promise<void> {
    if (!selectedFormation) {
      return
    }
    const value = window.prompt('Set top age (Ma)', selectedFormation.age_ma?.toString() ?? '')
    if (value === null) {
      return
    }
    const trimmed = value.trim()
    const age = trimmed ? Number(trimmed) : undefined
    if (trimmed && !Number.isFinite(age)) {
      return
    }
    await updateFormation(selectedFormation.id, { age_ma: age })
  }

  async function handleSetFormationType(): Promise<void> {
    if (!selectedFormation) {
      return
    }
    const value = window.prompt('Set top type (`strat` or `unconformity`)', selectedFormation.kind)
    if (value === null) {
      return
    }
    const nextKind = value.trim().toLowerCase()
    if (!nextKind || (nextKind !== 'strat' && nextKind !== 'unconformity')) {
      return
    }
    await updateFormation(selectedFormation.id, { kind: nextKind })
  }

  async function handleMoveSelectedFormation(): Promise<void> {
    if (!selectedFormation) {
      return
    }
    const value = window.prompt('Move top to depth (MD)', selectedFormation.depth_md.toString())
    if (value === null) {
      return
    }
    const nextDepth = Number(value.trim())
    if (!Number.isFinite(nextDepth)) {
      return
    }
    handleMoveFormation(selectedFormation.id, nextDepth)
  }

  async function handleDeleteAllFormations(): Promise<void> {
    if (!well?.well_id || formations.length === 0) {
      return
    }

    for (const formation of formations) {
      // Sequential deletes keep current backend/store flow simple and deterministic.
      // eslint-disable-next-line no-await-in-loop
      await removeFormation(formation.id)
    }

    updateWellViewState(well.well_id, (state) => ({
      ...state,
      visibleFormationIds: [],
    }))
    setSelectedFormationId(null)
  }

  async function handleDeleteStratChart(): Promise<void> {
    if (!window.confirm('Delete all stratigraphic charts? Formation links will be cleared.')) return
    const response = await fetch('/api/strat-chart', { method: 'DELETE' })
    if (!response.ok) {
      alert('Failed to delete stratigraphic charts')
      return
    }
    await loadStratCharts()
    if (well?.well_id) {
      await loadWell(well.well_id)
    }
  }

  function handleToggleCurve(mnemonic: string, nextValue: boolean): void {
    if (!well?.well_id) {
      return
    }

    const curve = curves.find((item) => item.mnemonic === mnemonic)
    if (!curve) {
      return
    }

    updateWellViewState(well.well_id, (state) => {
      if (!nextValue) {
        const nextTracks = state.tracks.map((track) => ({
          ...track,
          curves: track.curves.filter((item) => item.mnemonic !== mnemonic),
        }))

        const hasAnyCurve = nextTracks.some((track) => track.curves.length > 0)
        return {
          ...state,
          tracks: hasAnyCurve ? nextTracks : [createEmptyTrack()],
        }
      }

      if (state.tracks.some((track) => track.curves.some((item) => item.mnemonic === mnemonic))) {
        return state
      }

      const existingCurveCount = state.tracks.reduce((count, track) => count + track.curves.length, 0)
      const curveConfig = createCurveConfig(curve, existingCurveCount)

      if (selectedTrackId && state.tracks.some((track) => track.id === selectedTrackId)) {
        return {
          ...state,
          tracks: state.tracks.map((track) => {
            if (track.id !== selectedTrackId) {
              return track
            }
            return {
              ...track,
              curves: [...track.curves, curveConfig],
            }
          }),
        }
      }

      const trackNumber = nextTrackNumber(state.tracks)
      return {
        ...state,
        tracks: [
          ...state.tracks,
          {
            id: `track-${trackNumber}`,
            title: `Track ${trackNumber}`,
            width: 200,
            scaleType: 'linear',
            gridDivisions: 3,
            showGrid: true,
            curves: [curveConfig],
          },
        ],
      }
    })
  }

  const activeTemplateSummary = useMemo(() => {
    if (!well?.well_id) {
      return null
    }

    return {
      trackCount: activeWellView.tracks.length,
      tracks: activeWellView.tracks,
      hiddenTrackIds: activeWellView.hiddenTrackIds,
      visibleCurveCount: visibleCurveMnemonics.length,
      visibleTopCount: visibleFormationIds.length,
      deviationVisible: activeWellView.deviationVisible,
    }
  }, [activeWellView, visibleCurveMnemonics.length, visibleFormationIds.length, well?.well_id])

  function handleToggleTrackHidden(trackId: string): void {
    if (!well?.well_id) {
      return
    }

    updateWellViewState(well.well_id, (state) => {
      const nextHiddenTrackIds = state.hiddenTrackIds.includes(trackId)
        ? state.hiddenTrackIds.filter((id) => id !== trackId)
        : [...state.hiddenTrackIds, trackId]
      return {
        ...state,
        hiddenTrackIds: nextHiddenTrackIds,
      }
    })

    if (selectedTrackId === trackId) {
      selectTrack(null)
    }
  }

  function handleMoveTrack(trackId: string, direction: -1 | 1): void {
    if (!well?.well_id) {
      return
    }

    updateWellViewState(well.well_id, (state) => {
      const currentIndex = state.tracks.findIndex((track) => track.id === trackId)
      if (currentIndex < 0) {
        return state
      }
      const nextIndex = currentIndex + direction
      if (nextIndex < 0 || nextIndex >= state.tracks.length) {
        return state
      }

      const nextTracks = [...state.tracks]
      const [track] = nextTracks.splice(currentIndex, 1)
      nextTracks.splice(nextIndex, 0, track)
      return {
        ...state,
        tracks: nextTracks,
      }
    })
  }

  function handleRemoveTrack(trackId: string): void {
    if (!well?.well_id) {
      return
    }

    updateWellViewState(well.well_id, (state) => {
      if (state.tracks.length <= 1) {
        return state
      }

      const nextTracks = state.tracks.filter((track) => track.id !== trackId)
      return {
        ...state,
        tracks: nextTracks.length > 0 ? nextTracks : [createEmptyTrack()],
        hiddenTrackIds: state.hiddenTrackIds.filter((id) => id !== trackId),
      }
    })

    if (selectedTrackId === trackId) {
      selectTrack(null)
    }
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
      case 'load-strat-chart':
        return (
          <LoadStratChartDialog
            onClose={() => setActiveDialog(null)}
            onSuccess={async (_count) => {
              setActiveDialog(null)
              await loadStratCharts()
              if (well?.well_id) {
                await loadWell(well.well_id)
              }
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
            onClose={() => {
              setFormationLinkTarget(null)
              setActiveDialog(null)
            }}
            onSelect={handleLinkFormation}
          />
        ) : null
      }
      default:
        return null
    }
  }

  const dialogContent = renderDialog()

  const projectModeActions = (
    <>
      <button type="button" className="app-action-button" onClick={() => setActiveDialog('project-new')}>New project</button>
      <button type="button" className="app-action-button" onClick={() => setActiveDialog('project-open')}>Open project</button>
      <button type="button" className="app-action-button" onClick={() => void handleProjectClose()}>Close project</button>
      <button type="button" className="app-action-button app-action-button--primary" onClick={() => void saveProject()} disabled={!isDirty}>Save project</button>
      <button type="button" className="app-action-button" onClick={() => void createCheckpoint()}>Create checkpoint</button>
    </>
  )

  const stratChartModeActions = (
    <>
      <button type="button" className="app-action-button" onClick={() => setActiveDialog('load-strat-chart')}>Load StratChart</button>
      <button type="button" className="app-action-button" onClick={() => void handleDeleteStratChart()}>Delete StratChart</button>
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

  return (
    <div className="app-layout">
      <header className="app-topbar">
        <div className="app-topbar__row">
          <span className="app-topbar__brand">SUBSIDENCE</span>
          <span className="app-topbar__project">{isDirty ? '* ' : ''}{projectName ?? '-'}</span>
          <span className="app-topbar__well">{topbarTitle}</span>

          {isProjectOpen && (
            <div className="app-topbar__actions">
              <button type="button" className={`app-action-button ${activeToolbarMode === 'project' ? 'app-action-button--mode-active' : ''}`} onClick={() => setActiveToolbarMode('project')}>Project</button>
              <button type="button" className={`app-action-button ${activeToolbarMode === 'strat-chart' ? 'app-action-button--mode-active' : ''}`} onClick={() => setActiveToolbarMode('strat-chart')}>StratChart</button>
              <button type="button" className={`app-action-button ${activeToolbarMode === 'wells' ? 'app-action-button--mode-active' : ''}`} onClick={() => setActiveToolbarMode('wells')}>Wells</button>
              <button type="button" className={`app-action-button ${activeToolbarMode === 'tops' ? 'app-action-button--mode-active' : ''}`} onClick={() => setActiveToolbarMode('tops')}>Tops</button>

              <span className="app-topbar__divider" />

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
              {activeToolbarMode === 'project' ? projectModeActions : null}
              {activeToolbarMode === 'strat-chart' ? stratChartModeActions : null}
              {activeToolbarMode === 'wells' ? wellsModeActions : null}
              {activeToolbarMode === 'tops' ? topsModeActions : null}
            </div>
            <ZoomControl />
          </div>
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
                    className={`sidebar-tab ${activeSidebarTab === 'strat-charts' ? 'sidebar-tab--active' : ''}`}
                    onClick={() => setActiveSidebarTab('strat-charts')}
                  >
                    StratCharts
                  </button>
                  <button
                    type="button"
                    className={`sidebar-tab ${activeSidebarTab === 'models' ? 'sidebar-tab--active' : ''}`}
                    onClick={() => setActiveSidebarTab('models')}
                  >
                    Models
                  </button>
                  <button
                    type="button"
                    className={`sidebar-tab ${activeSidebarTab === 'templates' ? 'sidebar-tab--active' : ''}`}
                    onClick={() => setActiveSidebarTab('templates')}
                  >
                    Templates
                  </button>
                </header>

                {activeSidebarTab === 'strat-charts' ? (
                  <StratChartTab
                    charts={stratCharts}
                    onActivate={(chartId) => void activateChart(chartId)}
                    onDelete={(chartId) => void deleteChart(chartId)}
                  />
                ) : activeSidebarTab === 'wells' ? (
                  <WellDataPanel
                    wells={wellOptions}
                    activeWellId={well?.well_id ?? null}
                    well={well}
                    curves={curves}
                    formations={formations}
                    visibleCurveMnemonics={visibleCurveMnemonics}
                    visibleFormationIds={visibleFormationIds}
                    isDeviationVisible={activeWellView.deviationVisible}
                    selectedFormationId={selectedFormationId}
                    onSelectWell={handleSelectWell}
                    onToggleCurve={handleToggleCurve}
                    onToggleFormation={handleToggleFormation}
                    onToggleAllFormations={handleToggleAllFormations}
                    onToggleDeviation={handleSetDeviationVisible}
                    onSelectFormation={handleSelectFormation}
                  />
                ) : activeSidebarTab === 'templates' ? (
                  <div className="sidebar-panel__body">
                    {well && activeTemplateSummary ? (
                      <div className="template-panel">
                        <div className="template-panel__group">
                          <div className="template-panel__label">Well</div>
                          <div className="template-panel__value">{well.well_name}</div>
                        </div>
                        <div className="template-panel__group">
                          <div className="template-panel__label">Tracks</div>
                          <div className="template-panel__value">{activeTemplateSummary.trackCount}</div>
                        </div>
                        <div className="template-panel__group">
                          <div className="template-panel__label">Visible curves</div>
                          <div className="template-panel__value">{activeTemplateSummary.visibleCurveCount}</div>
                        </div>
                        <div className="template-panel__group">
                          <div className="template-panel__label">Visible tops</div>
                          <div className="template-panel__value">{activeTemplateSummary.visibleTopCount}</div>
                        </div>
                        <div className="template-panel__group">
                          <div className="template-panel__label">Deviation</div>
                          <div className="template-panel__value">{activeTemplateSummary.deviationVisible ? 'Visible' : 'Hidden'}</div>
                        </div>
                        <div className="template-panel__tracks">
                          {activeTemplateSummary.tracks.map((track, index) => (
                            <div key={track.id} className="template-track-card">
                              <div className="template-track-card__header">
                                <div className="template-track-card__title">{track.title}</div>
                                <div className="template-track-card__actions">
                                  <button
                                    type="button"
                                    className="template-track-card__button"
                                    onClick={() => handleMoveTrack(track.id, -1)}
                                    disabled={index === 0}
                                  >
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    className="template-track-card__button"
                                    onClick={() => handleMoveTrack(track.id, 1)}
                                    disabled={index === activeTemplateSummary.tracks.length - 1}
                                  >
                                    ↓
                                  </button>
                                  <button
                                    type="button"
                                    className="template-track-card__button"
                                    onClick={() => handleToggleTrackHidden(track.id)}
                                  >
                                    {activeTemplateSummary.hiddenTrackIds.includes(track.id) ? 'Show' : 'Hide'}
                                  </button>
                                  <button
                                    type="button"
                                    className="template-track-card__button"
                                    onClick={() => handleRemoveTrack(track.id)}
                                    disabled={activeTemplateSummary.tracks.length <= 1}
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                              {track.curves.length > 0 ? (
                                <div className="template-track-card__curves">
                                  {track.curves.map((curve) => (
                                    <span key={curve.mnemonic} className="template-track-card__curve">{curve.mnemonic}</span>
                                  ))}
                                </div>
                              ) : (
                                <div className="template-track-card__empty">Empty track</div>
                              )}
                              {activeTemplateSummary.hiddenTrackIds.includes(track.id) && (
                                <div className="template-track-card__status">Hidden in viewer</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="sidebar-panel__empty">Load a well to inspect per-well track settings.</p>
                    )}
                  </div>
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
              ) : !well ? (
                <p className="app-error-banner">No wells are available in the open project.</p>
              ) : (
                <>
                  {curves.length === 0 && (
                    <p className="app-error-banner">Well loaded. No curves imported yet.</p>
                  )}
                  <LogViewPanel
                    tracks={tracks}
                    curves={curves}
                    formations={visibleFormations}
                    minDepth={minDepth}
                    maxDepth={maxDepth}
                  />
                </>
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
