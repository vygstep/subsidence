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
  SettingsInspector,
  StratChartTab,
  WellDataPanel,
  ZoomControl,
} from '@/components'
import {
  createDefaultWellView,
  createEmptyTrack,
  useProjectStore,
  useViewStore,
  useWellDataStore,
  useWorkspaceStore,
} from '@/stores'
import type { CurveData, FormationTop, TrackConfig } from '@/types'

const TRACK_COLORS = ['#22c55e', '#ef4444', '#2563eb', '#f59e0b', '#8b5cf6', '#0f766e', '#dc2626', '#475569']
type DialogKind = 'project-open' | 'project-new' | 'create-well' | 'load-las' | 'load-tops' | 'load-deviation' | 'link-top' | 'load-strat-chart' | null

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

function App() {
  const [activeDialog, setActiveDialog] = useState<DialogKind>('project-open')
  const [formationLinkTarget, setFormationLinkTarget] = useState<FormationTop | null>(null)
  const [wellInspectorDraft, setWellInspectorDraft] = useState({
    well_name: '',
    x: '',
    y: '',
    kb_elev: '',
    gl_elev: '',
    td_md: '',
    crs: '',
  })

  const loadWell = useWellDataStore((state) => state.loadWell)
  const loadWellInventories = useWellDataStore((state) => state.loadWellInventories)
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
  const wellInventories = useWellDataStore((state) => state.wellInventories)
  const well = useWellDataStore((state) => state.well)
  const curves = useWellDataStore((state) => state.curves)
  const formations = useWellDataStore((state) => state.formations)
  const colorOverrides = useWellDataStore((state) => state.colorOverrides)
  const isLoading = useWellDataStore((state) => state.isLoading)
  const error = useWellDataStore((state) => state.error)

  const isProjectOpen = useProjectStore((state) => state.isOpen)
  const projectName = useProjectStore((state) => state.projectName)
  const projectPath = useProjectStore((state) => state.projectPath)
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
  const activeSidebarTab = useWorkspaceStore((state) => state.activeSidebarTab)
  const activeToolbarMode = useWorkspaceStore((state) => state.activeToolbarMode)
  const selectedFormationId = useWorkspaceStore((state) => state.selectedFormationId)
  const selectedObject = useWorkspaceStore((state) => state.selectedObject)
  const sidebarWidth = useWorkspaceStore((state) => state.sidebarWidth)
  const sidebarTopRatio = useWorkspaceStore((state) => state.sidebarTopRatio)
  const wellViewStates = useWorkspaceStore((state) => state.wellViewStates)
  const setActiveSidebarTab = useWorkspaceStore((state) => state.setActiveSidebarTab)
  const setActiveToolbarMode = useWorkspaceStore((state) => state.setActiveToolbarMode)
  const setSelectedFormationId = useWorkspaceStore((state) => state.setSelectedFormationId)
  const setSelectedObject = useWorkspaceStore((state) => state.setSelectedObject)
  const setSidebarWidth = useWorkspaceStore((state) => state.setSidebarWidth)
  const setSidebarTopRatio = useWorkspaceStore((state) => state.setSidebarTopRatio)
  const resetWorkspace = useWorkspaceStore((state) => state.resetWorkspace)
  const updateWellViewState = useWorkspaceStore((state) => state.updateWellViewState)
  const ensureWellViewState = useWorkspaceStore((state) => state.ensureWellViewState)
  const dropWellViewState = useWorkspaceStore((state) => state.dropWellViewState)

  const configHydratedRef = useRef(false)
  const workspaceRef = useRef<HTMLDivElement | null>(null)
  const sidebarRef = useRef<HTMLElement | null>(null)
  const dragModeRef = useRef<'sidebar-width' | 'sidebar-split' | null>(null)
  const lastProjectPathRef = useRef<string | null>(null)

  const wellOptions = useMemo(
    () => wellInventories.map((item) => ({ well_id: item.well_id, well_name: item.well_name })),
    [wellInventories],
  )

  async function refreshWellInventories(preferredWellId?: string): Promise<void> {
    await loadWellInventories()
    const wells = useWellDataStore.getState().wellInventories

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
    const handlePointerMove = (event: MouseEvent) => {
      if (!dragModeRef.current) {
        return
      }

      if (dragModeRef.current === 'sidebar-width') {
        const workspaceRect = workspaceRef.current?.getBoundingClientRect()
        if (!workspaceRect) {
          return
        }

        const nextWidth = Math.min(
          520,
          Math.max(240, event.clientX - workspaceRect.left),
        )
        setSidebarWidth(nextWidth)
        return
      }

      const sidebarRect = sidebarRef.current?.getBoundingClientRect()
      if (!sidebarRect) {
        return
      }

      const relativeY = event.clientY - sidebarRect.top
      const nextRatio = Math.min(
        0.85,
        Math.max(0.2, relativeY / sidebarRect.height),
      )
      setSidebarTopRatio(nextRatio)
    }

    const handlePointerUp = () => {
      dragModeRef.current = null
      document.body.classList.remove('is-resizing')
    }

    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', handlePointerUp)
    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', handlePointerUp)
    }
  }, [])

  useEffect(() => {
    if (!isProjectOpen) {
      configHydratedRef.current = false
      resetWell()
      resetVisualConfig()
      selectTrack(null)
      resetWorkspace()
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
      lastProjectPathRef.current = null
      resetWell()
      return
    }

    let cancelled = false
    const loadCurrentProject = async () => {
      try {
        const projectChanged = lastProjectPathRef.current !== projectPath
        await loadWellInventories()
        const wells = useWellDataStore.getState().wellInventories
        if (cancelled) {
          return
        }
        lastProjectPathRef.current = projectPath
        if (wells.length === 0) {
          resetWell()
          return
        }

        const currentWellId = well?.well_id
        const hasCurrent = !projectChanged && currentWellId ? wells.some((item) => item.well_id == currentWellId) : false
        const nextWellId = hasCurrent && currentWellId ? currentWellId : wells[0].well_id
        if (projectChanged) {
          selectTrack(null)
          setSelectedFormationId(null)
        }
        if (nextWellId && (projectChanged || nextWellId !== currentWellId || !well)) {
          await loadWell(nextWellId)
        }
      } catch {
        if (!cancelled) {
          resetWell()
        }
      }
    }

    void loadCurrentProject()
    return () => {
      cancelled = true
    }
  }, [isProjectOpen, projectPath, loadWell, loadWellInventories, resetWell, selectTrack, well])

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

  const visibleCurveMnemonicsByWellId = useMemo(
    () => Object.fromEntries(
      Object.entries(wellViewStates).map(([wellId, state]) => [
        wellId,
        Array.from(new Set(state.tracks.flatMap((track) => track.curves.map((curve) => curve.mnemonic)))),
      ]),
    ),
    [wellViewStates],
  )

  const visibleFormationIds = activeWellView.visibleFormationIds

  const visibleFormationIdsByWellId = useMemo(
    () => Object.fromEntries(
      Object.entries(wellViewStates).map(([wellId, state]) => [wellId, state.visibleFormationIds]),
    ),
    [wellViewStates],
  )

  const deviationVisibilityByWellId = useMemo(
    () => Object.fromEntries(
      Object.entries(wellViewStates).map(([wellId, state]) => [wellId, state.deviationVisible]),
    ),
    [wellViewStates],
  )

  const visibleFormations = useMemo(() => (
    formations.filter((formation) => visibleFormationIds.includes(formation.id))
  ), [formations, visibleFormationIds])

  useEffect(() => {
    if (selectedFormationId && !formations.some((formation) => formation.id === selectedFormationId)) {
      setSelectedFormationId(null)
    }
  }, [formations, selectedFormationId])

  useEffect(() => {
    if (!well) {
      setSelectedObject(null)
      return
    }

    setWellInspectorDraft({
      well_name: well.well_name,
      x: String(well.x ?? 0),
      y: String(well.y ?? 0),
      kb_elev: String(well.kb_elev ?? 0),
      gl_elev: String(well.gl_elev ?? 0),
      td_md: String(well.td_md ?? 0),
      crs: well.crs ?? '',
    })
  }, [well])

  useEffect(() => {
    if (!well?.well_id) {
      selectTrack(null)
      setSelectedFormationId(null)
      setSelectedObject(null)
      return
    }

    ensureWellViewState(well.well_id)
    selectTrack(null)
    setSelectedFormationId(null)
    setSelectedObject({ type: 'well', wellId: well.well_id })
  }, [ensureWellViewState, selectTrack, well?.well_id, setSelectedFormationId, setSelectedObject])

  useEffect(() => {
    if (wellInventories.length === 0) {
      return
    }
    wellInventories.forEach((inventory) => ensureWellViewState(inventory.well_id))
  }, [ensureWellViewState, wellInventories])

  const topbarTitle = !isProjectOpen
    ? 'No project open'
    : isLoading
      ? 'Loading well...'
      : error
        ? 'Error loading well'
        : (well?.well_name ?? 'No wells in project')

  async function handleProjectClose(): Promise<void> {
    await closeProject()
    setActiveDialog('project-open')
  }

  async function handleWellMutation(wellId: string): Promise<void> {
    await refreshWellInventories(wellId)
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

      dropWellViewState(well.well_id)
      setSelectedFormationId(null)
      selectTrack(null)
      await refreshWellInventories()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Failed to delete well.')
    }
  }

  function handleSelectWell(wellId: string): void {
    selectTrack(null)
    setSelectedObject({ type: 'well', wellId })
    void loadWell(wellId)
  }

  async function handleSelectLasGroup(wellId: string): Promise<void> {
    if (wellId !== well?.well_id) {
      await loadWell(wellId)
    }
    setSelectedObject({ type: 'las-group', wellId })
  }

  async function handleSelectCurve(wellId: string, mnemonic: string): Promise<void> {
    if (wellId !== well?.well_id) {
      await loadWell(wellId)
    }
    setSelectedObject({ type: 'curve', wellId, mnemonic })
  }

  async function handleSelectTopsGroup(wellId: string): Promise<void> {
    if (wellId !== well?.well_id) {
      await loadWell(wellId)
    }
    setSelectedObject({ type: 'tops-group', wellId })
  }

  async function handleSetDeviationVisible(wellId: string, nextValue: boolean): Promise<void> {
    if (wellId !== well?.well_id) {
      await loadWell(wellId)
    }
    updateWellViewState(wellId, (state) => ({
      ...state,
      deviationVisible: nextValue,
    }))
  }

  async function handleToggleFormation(wellId: string, formationId: string, nextValue: boolean): Promise<void> {
    if (wellId !== well?.well_id) {
      await loadWell(wellId)
    }
    updateWellViewState(wellId, (state) => ({
      ...state,
      visibleFormationIds: nextValue
        ? Array.from(new Set([...state.visibleFormationIds, formationId]))
        : state.visibleFormationIds.filter((id) => id !== formationId),
    }))
  }

  async function handleSelectFormation(wellId: string, formationId: string): Promise<void> {
    if (wellId !== well?.well_id) {
      await loadWell(wellId)
    }
    setSelectedFormationId(formationId)
    setSelectedObject({ type: 'top-pick', wellId, formationId })
    setActiveToolbarMode('tops')
  }

  async function handleToggleAllCurves(wellId: string, nextValue: boolean): Promise<void> {
    if (wellId !== well?.well_id) {
      await loadWell(wellId)
    }
    if (!nextValue) {
      updateWellViewState(wellId, (state) => ({
        ...state,
        tracks: [createEmptyTrack()],
      }))
      selectTrack(null)
      return
    }

    useWellDataStore.getState().curves.forEach((curve) => {
      void handleToggleCurve(wellId, curve.mnemonic, true)
    })
  }

  async function handleToggleAllFormations(wellId: string, nextValue: boolean): Promise<void> {
    if (wellId !== well?.well_id) {
      await loadWell(wellId)
    }
    const currentFormations = useWellDataStore.getState().formations
    updateWellViewState(wellId, (state) => ({
      ...state,
      visibleFormationIds: nextValue ? currentFormations.map((formation) => formation.id) : [],
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
    const activeChart = stratCharts.find((chart) => chart.is_active) ?? null
    if (!activeChart) {
      return
    }

    if (!window.confirm(`Delete stratigraphic chart "${activeChart.name}"? Formation links to this chart will be cleared.`)) {
      return
    }

    try {
      await deleteChart(activeChart.id)
      if (well?.well_id) {
        await loadWell(well.well_id)
      }
    } catch {
      alert('Failed to delete the active stratigraphic chart')
    }
  }

  async function handleToggleCurve(wellId: string, mnemonic: string, nextValue: boolean): Promise<void> {
    if (wellId !== well?.well_id) {
      await loadWell(wellId)
    }

    const activeWellId = useWellDataStore.getState().well?.well_id
    if (!activeWellId) {
      return
    }
    const currentCurves = useWellDataStore.getState().curves
    const curve = currentCurves.find((item) => item.mnemonic === mnemonic)
    if (!curve) {
      return
    }

    updateWellViewState(activeWellId, (state) => {
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

  const selectedCurveConfig = useMemo(() => {
    if (selectedObject?.type !== 'curve') {
      return null
    }
    return activeWellView.tracks.flatMap((track) => track.curves).find((curve) => curve.mnemonic === selectedObject.mnemonic) ?? null
  }, [activeWellView.tracks, selectedObject])

  const selectedChart = useMemo(() => {
    if (selectedObject?.type !== 'strat-chart') {
      return null
    }
    return stratCharts.find((chart) => chart.id === selectedObject.chartId) ?? null
  }, [selectedObject, stratCharts])

  async function handleSaveWellInspector(): Promise<void> {
    if (!well?.well_id) {
      return
    }

    const payload = {
      well_name: wellInspectorDraft.well_name.trim(),
      x: Number(wellInspectorDraft.x),
      y: Number(wellInspectorDraft.y),
      kb_elev: Number(wellInspectorDraft.kb_elev),
      gl_elev: Number(wellInspectorDraft.gl_elev),
      td_md: Number(wellInspectorDraft.td_md),
      crs: wellInspectorDraft.crs.trim(),
    }

    const response = await fetch(`/api/wells/${well.well_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      window.alert(await readError(response, `Failed to update well '${well.well_name}' (${response.status})`))
      return
    }

    await refreshWellInventories(well.well_id)
  }

  function handleWellInspectorDraftChange(
    field: keyof typeof wellInspectorDraft,
    value: string,
  ): void {
    setWellInspectorDraft((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function handleCurveSettingUpdate(mnemonic: string, patch: Partial<TrackConfig['curves'][number]>): void {
    if (!well?.well_id) {
      return
    }

    updateWellViewState(well.well_id, (state) => ({
      ...state,
      tracks: state.tracks.map((track) => ({
        ...track,
        curves: track.curves.map((curve) => (
          curve.mnemonic === mnemonic ? { ...curve, ...patch } : curve
        )),
      })),
    }))
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
      <button type="button" className="app-action-button app-action-button--primary" onClick={() => void saveProject()}>Save project</button>
      <button type="button" className="app-action-button" onClick={() => void createCheckpoint()}>Create checkpoint</button>
    </>
  )

  const stratChartModeActions = (
    <>
      <button type="button" className="app-action-button" onClick={() => setActiveDialog('load-strat-chart')}>Load StratChart</button>
      <button
        type="button"
        className="app-action-button"
        onClick={() => void handleDeleteStratChart()}
        disabled={!stratCharts.some((chart) => chart.is_active)}
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

  const settingsContent = (
    <SettingsInspector
      selectedObject={selectedObject}
      well={well}
      wellInspectorDraft={wellInspectorDraft}
      onWellInspectorDraftChange={handleWellInspectorDraftChange}
      onSaveWellInspector={handleSaveWellInspector}
      selectedCurveConfig={selectedCurveConfig}
      onCurveSettingUpdate={handleCurveSettingUpdate}
      formations={formations}
      visibleFormationIds={visibleFormationIds}
      selectedFormation={selectedFormation}
      onFormationUpdate={(formationId, patch) => void updateFormation(formationId, patch)}
      onFormationMove={handleMoveFormation}
      selectedChart={selectedChart}
      curveCount={curves.length}
      visibleCurveCount={visibleCurveMnemonics.length}
      minDepth={minDepth}
      maxDepth={maxDepth}
    />
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
          <div ref={workspaceRef} className="app-workspace">
            <aside
              ref={sidebarRef}
              className="app-sidebar"
              style={{ width: `${sidebarWidth}px` }}
            >
              <section
                className="sidebar-panel app-sidebar__zone"
                style={{ flex: `${sidebarTopRatio} 1 0%` }}
              >
                <header className="sidebar-tabs">
                  <button
                    type="button"
                    className={`sidebar-tab ${activeSidebarTab === 'strat-charts' ? 'sidebar-tab--active' : ''}`}
                    onClick={() => setActiveSidebarTab('strat-charts')}
                  >
                    StratCharts
                  </button>
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

                {activeSidebarTab === 'strat-charts' ? (
                  <StratChartTab
                    charts={stratCharts}
                    onActivate={(chartId) => void activateChart(chartId)}
                    onDelete={(chartId) => void deleteChart(chartId)}
                    selectedChartId={selectedObject?.type === 'strat-chart' ? selectedObject.chartId : null}
                    onSelect={(chartId) => setSelectedObject({ type: 'strat-chart', chartId })}
                  />
                ) : activeSidebarTab === 'wells' ? (
                  <WellDataPanel
                    wells={wellInventories}
                    activeWellId={well?.well_id ?? null}
                    visibleCurveMnemonicsByWellId={visibleCurveMnemonicsByWellId}
                    visibleFormationIdsByWellId={visibleFormationIdsByWellId}
                    deviationVisibilityByWellId={deviationVisibilityByWellId}
                    selectedFormationId={selectedFormationId}
                    onSelectWell={handleSelectWell}
                    onToggleCurve={handleToggleCurve}
                    onToggleFormation={handleToggleFormation}
                    onToggleAllFormations={handleToggleAllFormations}
                    onToggleAllCurves={handleToggleAllCurves}
                    onToggleDeviation={handleSetDeviationVisible}
                    onSelectFormation={handleSelectFormation}
                    selectedObject={selectedObject}
                    onSelectLasGroup={handleSelectLasGroup}
                    onSelectCurve={handleSelectCurve}
                    onSelectTopsGroup={handleSelectTopsGroup}
                  />
                ) : (
                  <div className="sidebar-panel__body">
                    <p className="sidebar-panel__empty">Reserved for upcoming modelling workflows.</p>
                  </div>
                )}
              </section>

              <div
                className="app-sidebar__splitter"
                onMouseDown={() => {
                  dragModeRef.current = 'sidebar-split'
                  document.body.classList.add('is-resizing')
                }}
              />

              <section
                className="sidebar-panel app-sidebar__zone"
                style={{ flex: `${1 - sidebarTopRatio} 1 0%` }}
              >
                <header className="sidebar-panel__header">
                  <h2 className="sidebar-panel__title">Settings</h2>
                </header>
                <div className="sidebar-panel__body">{settingsContent}</div>
              </section>
            </aside>

            <div
              className="app-workspace__splitter"
              onMouseDown={() => {
                dragModeRef.current = 'sidebar-width'
                document.body.classList.add('is-resizing')
              }}
            />

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
