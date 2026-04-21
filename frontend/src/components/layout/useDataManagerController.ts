import { useEffect, useMemo, useState } from 'react'

import { buildTrackOrder, createDefaultWellView, createEmptyTrack, useViewStore, useWellDataStore, useWorkspaceStore } from '@/stores'
import type { TrackConfig } from '@/types'

const TRACK_COLORS = ['#22c55e', '#ef4444', '#2563eb', '#f59e0b', '#8b5cf6', '#0f766e', '#dc2626', '#475569']

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: string }
    if (payload.detail) return payload.detail
  } catch {
    // ignore non-JSON payloads
  }
  return fallback
}

function computeCurveBounds(values: Float32Array, nullValue: number) {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i]
    if (!Number.isFinite(v) || v === nullValue) continue
    min = Math.min(min, v)
    max = Math.max(max, v)
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

export function useDataManagerController() {
  const [wellInspectorDraft, setWellInspectorDraft] = useState({
    well_name: '',
    x: '',
    y: '',
    kb_elev: '',
    gl_elev: '',
    td_md: '',
    crs: '',
  })

  const well = useWellDataStore((state) => state.well)
  const curves = useWellDataStore((state) => state.curves)
  const formations = useWellDataStore((state) => state.formations)
  const stratCharts = useWellDataStore((state) => state.stratCharts)
  const compactionModels = useWellDataStore((state) => state.compactionModels)
  const wellInventories = useWellDataStore((state) => state.wellInventories)
  const loadWell = useWellDataStore((state) => state.loadWell)
  const updateFormation = useWellDataStore((state) => state.updateFormation)
  const updateFormationDepth = useWellDataStore((state) => state.updateFormationDepth)
  const activateChart = useWellDataStore((state) => state.activateChart)
  const deleteChart = useWellDataStore((state) => state.deleteChart)
  const refreshWell = useWellDataStore((state) => state.refreshWell)
  const loadWellInventories = useWellDataStore((state) => state.loadWellInventories)
  const activateCompactionModel = useWellDataStore((state) => state.activateCompactionModel)
  const createCompactionModel = useWellDataStore((state) => state.createCompactionModel)
  const deleteCompactionModel = useWellDataStore((state) => state.deleteCompactionModel)

  const activeSidebarTab = useWorkspaceStore((state) => state.activeSidebarTab)
  const selectedFormationId = useWorkspaceStore((state) => state.selectedFormationId)
  const selectedObject = useWorkspaceStore((state) => state.selectedObject)
  const sidebarTopRatio = useWorkspaceStore((state) => state.sidebarTopRatio)
  const wellViewStates = useWorkspaceStore((state) => state.wellViewStates)
  const sidebarWidth = useWorkspaceStore((state) => state.sidebarWidth)
  const setActiveSidebarTab = useWorkspaceStore((state) => state.setActiveSidebarTab)
  const setActiveToolbarMode = useWorkspaceStore((state) => state.setActiveToolbarMode)
  const setSelectedFormationId = useWorkspaceStore((state) => state.setSelectedFormationId)
  const setSelectedObject = useWorkspaceStore((state) => state.setSelectedObject)
  const updateWellViewState = useWorkspaceStore((state) => state.updateWellViewState)
  const dropWellViewState = useWorkspaceStore((state) => state.dropWellViewState)

  const selectedTrackId = useViewStore((state) => state.selectedTrackId)
  const selectTrack = useViewStore((state) => state.selectTrack)

  useEffect(() => {
    if (!well) return
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

  const activeWellView = useMemo(() => {
    if (!well?.well_id) return createDefaultWellView()
    return wellViewStates[well.well_id] ?? createDefaultWellView()
  }, [well?.well_id, wellViewStates])

  const { minDepth, maxDepth } = useMemo(() => {
    if (curves.length === 0) return { minDepth: 0, maxDepth: 1000 }
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

  const selectedFormation = useMemo(
    () => formations.find((f) => f.id === selectedFormationId) ?? null,
    [formations, selectedFormationId],
  )

  const selectedCurveConfig = useMemo(() => {
    if (selectedObject?.type !== 'curve') return null
    return activeWellView.tracks.flatMap((t) => t.curves).find((c) => c.mnemonic === selectedObject.mnemonic) ?? null
  }, [activeWellView.tracks, selectedObject])

  const selectedChart = useMemo(() => {
    if (selectedObject?.type !== 'strat-chart') return null
    return stratCharts.find((c) => c.id === selectedObject.chartId) ?? null
  }, [selectedObject, stratCharts])

  const selectedCompactionModel = useMemo(() => {
    if (selectedObject?.type !== 'compaction-model') return null
    return compactionModels.find((m) => m.id === selectedObject.modelId) ?? null
  }, [selectedObject, compactionModels])

  function loadWellInBackground(wellId: string): void {
    if (wellId !== well?.well_id) {
      void loadWell(wellId)
    }
  }

  function handleSelectWell(wellId: string): void {
    setSelectedObject({ type: 'well', wellId })
    loadWellInBackground(wellId)
  }

  function handleFocusWellObject(wellId: string): void {
    setSelectedObject({ type: 'well', wellId })
  }

  function handleFocusLasGroupObject(wellId: string): void {
    setSelectedObject({ type: 'las-group', wellId })
  }

  function handleFocusCurveObject(wellId: string, mnemonic: string): void {
    setSelectedObject({ type: 'curve', wellId, mnemonic })
  }

  function handleFocusTopsGroupObject(wellId: string): void {
    setSelectedObject({ type: 'tops-group', wellId })
  }

  async function handleSelectLasGroup(wellId: string): Promise<void> {
    setSelectedObject({ type: 'las-group', wellId })
    loadWellInBackground(wellId)
  }

  async function handleSelectCurve(wellId: string, mnemonic: string): Promise<void> {
    if (selectedObject?.type === 'curve' && selectedObject.wellId === wellId && selectedObject.mnemonic === mnemonic) {
      setSelectedObject(null)
    } else {
      setSelectedObject({ type: 'curve', wellId, mnemonic })
    }
    loadWellInBackground(wellId)
  }

  async function handleSelectTopsGroup(wellId: string): Promise<void> {
    setSelectedObject({ type: 'tops-group', wellId })
    loadWellInBackground(wellId)
  }

  async function handleSetDeviationVisible(wellId: string, nextValue: boolean): Promise<void> {
    if (wellId !== well?.well_id) await loadWell(wellId)
    updateWellViewState(wellId, (state) => ({ ...state, deviationVisible: nextValue }))
  }

  async function handleToggleFormation(wellId: string, formationId: string, nextValue: boolean): Promise<void> {
    if (wellId !== well?.well_id) await loadWell(wellId)
    updateWellViewState(wellId, (state) => ({
      ...state,
      visibleFormationIds: nextValue
        ? Array.from(new Set([...state.visibleFormationIds, formationId]))
        : state.visibleFormationIds.filter((id) => id !== formationId),
    }))
  }

  async function handleToggleAllFormations(wellId: string, nextValue: boolean): Promise<void> {
    if (wellId !== well?.well_id) await loadWell(wellId)
    const currentFormations = useWellDataStore.getState().formations
    updateWellViewState(wellId, (state) => ({
      ...state,
      visibleFormationIds: nextValue ? currentFormations.map((f) => f.id) : [],
    }))
  }

  async function handleSelectFormation(wellId: string, formationId: string): Promise<void> {
    if (selectedObject?.type === 'top-pick' && selectedObject.wellId === wellId && selectedObject.formationId === formationId) {
      setSelectedObject(null)
      setSelectedFormationId(null)
    } else {
      setSelectedFormationId(formationId)
      setSelectedObject({ type: 'top-pick', wellId, formationId })
      setActiveToolbarMode('tops')
    }
    loadWellInBackground(wellId)
  }

  function handleFocusFormationObject(wellId: string, formationId: string): void {
    setSelectedFormationId(formationId)
    setSelectedObject({ type: 'top-pick', wellId, formationId })
  }

  async function handleToggleCurve(wellId: string, mnemonic: string, nextValue: boolean): Promise<void> {
    if (wellId !== well?.well_id) await loadWell(wellId)
    const activeWellId = useWellDataStore.getState().well?.well_id
    if (!activeWellId) return
    const curve = useWellDataStore.getState().curves.find((c) => c.mnemonic === mnemonic)
    if (!curve) return

    updateWellViewState(activeWellId, (state) => {
      if (!nextValue) {
        const nextTracks = state.tracks.map((track) => ({
          ...track,
          curves: track.curves.filter((c) => c.mnemonic !== mnemonic),
        }))
        const hasAnyCurve = nextTracks.some((track) => track.curves.length > 0)
        const finalTracks = hasAnyCurve ? nextTracks : [createEmptyTrack()]
        return {
          ...state,
          tracks: finalTracks,
          trackOrder: buildTrackOrder(finalTracks.map((track) => track.id), state.trackOrder),
        }
      }

      if (state.tracks.some((track) => track.curves.some((c) => c.mnemonic === mnemonic))) {
        return state
      }

      const existingCount = state.tracks.reduce((n, t) => n + t.curves.length, 0)
      const bounds = computeCurveBounds(curve.values, curve.null_value)
      const curveConfig: TrackConfig['curves'][number] = {
        mnemonic: curve.mnemonic,
        unit: curve.unit,
        color: TRACK_COLORS[existingCount % TRACK_COLORS.length],
        lineWidth: 1.5,
        lineStyle: 'solid',
        scaleMin: bounds.min,
        scaleMax: bounds.max,
        scaleReversed: false,
      }

      if (selectedTrackId && state.tracks.some((t) => t.id === selectedTrackId)) {
        return {
          ...state,
          tracks: state.tracks.map((track) =>
            track.id !== selectedTrackId ? track : { ...track, curves: [...track.curves, curveConfig] },
          ),
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
        trackOrder: buildTrackOrder(
          [...state.tracks.map((track) => track.id), `track-${trackNumber}`],
          state.trackOrder,
        ),
      }
    })
  }

  async function handleToggleAllCurves(wellId: string, nextValue: boolean): Promise<void> {
    if (wellId !== well?.well_id) await loadWell(wellId)
    if (!nextValue) {
      updateWellViewState(wellId, (state) => {
        const track = createEmptyTrack()
        return {
          ...state,
          tracks: [track],
          trackOrder: buildTrackOrder([track.id], state.trackOrder),
        }
      })
      return
    }
    useWellDataStore.getState().curves.forEach((curve) => {
      void handleToggleCurve(wellId, curve.mnemonic, true)
    })
  }

  function handleCurveSettingUpdate(mnemonic: string, patch: Partial<TrackConfig['curves'][number]>): void {
    if (!well?.well_id) return
    updateWellViewState(well.well_id, (state) => ({
      ...state,
      tracks: state.tracks.map((track) => ({
        ...track,
        curves: track.curves.map((curve) => (curve.mnemonic === mnemonic ? { ...curve, ...patch } : curve)),
      })),
    }))
  }

  async function handleSaveWellInspector(): Promise<void> {
    if (!well?.well_id) return
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
    await refreshWell(well.well_id)
  }

  async function handleRenameSelectedObject(): Promise<void> {
    if (!selectedObject) return

    if (selectedObject.type === 'well') {
      if (!well || well.well_id !== selectedObject.wellId) return
      const nextName = window.prompt('Rename well', well.well_name)?.trim()
      if (!nextName || nextName === well.well_name) return

      const response = await fetch(`/api/wells/${well.well_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ well_name: nextName }),
      })
      if (!response.ok) {
        window.alert(await readError(response, `Failed to rename well '${well.well_name}' (${response.status})`))
        return
      }
      await refreshWell(well.well_id)
      return
    }

    if (selectedObject.type === 'top-pick') {
      if (!selectedFormation || selectedFormation.id !== selectedObject.formationId) return
      const nextName = window.prompt('Rename top', selectedFormation.name)?.trim()
      if (!nextName || nextName === selectedFormation.name) return
      await updateFormation(selectedFormation.id, { name: nextName })
      return
    }

    if (selectedObject.type === 'compaction-model') {
      if (!selectedCompactionModel || selectedCompactionModel.id !== selectedObject.modelId) return
      const nextName = window.prompt('Rename model', selectedCompactionModel.name)?.trim()
      if (!nextName || nextName === selectedCompactionModel.name) return
      try {
        await useWellDataStore.getState().renameCompactionModel(selectedCompactionModel.id, nextName)
      } catch (error) {
        window.alert(String(error))
      }
      return
    }

    window.alert('Rename is not implemented for the selected object yet.')
  }

  async function handleRenameWell(wellId: string, currentName: string): Promise<void> {
    const nextName = window.prompt('Rename well', currentName)?.trim()
    if (!nextName || nextName === currentName) return

    const response = await fetch(`/api/wells/${wellId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ well_name: nextName }),
    })
    if (!response.ok) {
      window.alert(await readError(response, `Failed to rename well '${currentName}' (${response.status})`))
      return
    }
    await loadWellInventories()
    if (well?.well_id === wellId) {
      await refreshWell(wellId)
    }
  }

  async function handleDeleteWell(wellId: string, wellName: string): Promise<void> {
    if (!window.confirm(`Delete well "${wellName}"?`)) return

    const response = await fetch(`/api/projects/wells/${wellId}`, { method: 'DELETE' })
    if (!response.ok) {
      window.alert(await readError(response, `Failed to delete well '${wellName}' (${response.status})`))
      return
    }

    dropWellViewState(wellId)
    setSelectedFormationId(null)
    setSelectedObject(null)
    selectTrack(null)
    await refreshWell()
  }

  async function handleRenameFormation(wellId: string, formationId: string, currentName: string): Promise<void> {
    const nextName = window.prompt('Rename top', currentName)?.trim()
    if (!nextName || nextName === currentName) return

    const response = await fetch(`/api/wells/${wellId}/formations/${formationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nextName }),
    })
    if (!response.ok) {
      window.alert(await readError(response, `Failed to rename top '${currentName}' (${response.status})`))
      return
    }

    await loadWellInventories()
    if (well?.well_id === wellId) {
      await refreshWell(wellId)
    }
  }

  async function handleDeleteFormation(wellId: string, formationId: string, name: string): Promise<void> {
    if (!window.confirm(`Delete top "${name}"?`)) return

    const response = await fetch(`/api/wells/${wellId}/formations/${formationId}`, { method: 'DELETE' })
    if (!response.ok) {
      window.alert(await readError(response, `Failed to delete top '${name}' (${response.status})`))
      return
    }

    await loadWellInventories()
    if (well?.well_id === wellId) {
      await refreshWell(wellId)
    }
    if (selectedFormationId === formationId) {
      setSelectedFormationId(null)
      setSelectedObject(null)
    }
  }

  async function handleDuplicateFormation(
    wellId: string,
    formation: { name: string; depth_md: number; active_strat_color: string | null },
  ): Promise<void> {
    const response = await fetch(`/api/wells/${wellId}/formations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${formation.name} copy`,
        depth_md: formation.depth_md,
        color: formation.active_strat_color ?? '#9ca3af',
      }),
    })
    if (!response.ok) {
      window.alert(await readError(response, `Failed to duplicate top '${formation.name}' (${response.status})`))
      return
    }

    await loadWellInventories()
    if (well?.well_id === wellId) {
      await refreshWell(wellId)
    }
  }

  async function handleDeleteChartById(chartId: number, name: string, isBuiltin: boolean): Promise<void> {
    if (isBuiltin) {
      window.alert('Built-in ICS chart cannot be deleted.')
      return
    }
    if (!window.confirm(`Delete strat chart "${name}"?`)) return
    await deleteChart(chartId)
    setSelectedObject(null)
  }

  async function handleDuplicateCompactionModel(modelId: number, name: string): Promise<void> {
    const created = await createCompactionModel(`${name} copy`, modelId)
    setSelectedObject({ type: 'compaction-model', modelId: created.id })
  }

  async function handleDeleteCompactionModelById(
    modelId: number,
    name: string,
    isBuiltin: boolean,
    isActive: boolean,
  ): Promise<void> {
    if (isBuiltin) {
      window.alert('Built-in compaction model cannot be deleted.')
      return
    }
    if (isActive) {
      window.alert('Activate another compaction model first.')
      return
    }
    if (!window.confirm(`Delete compaction model "${name}"?`)) return
    await deleteCompactionModel(modelId)
    setSelectedObject(null)
  }

  function handleWellInspectorDraftChange(field: keyof typeof wellInspectorDraft, value: string): void {
    setWellInspectorDraft((current) => ({ ...current, [field]: value }))
  }

  function handleCreateCompactionModel(): void {
    const name = window.prompt('New compaction model name:')?.trim()
    if (!name) return
    void createCompactionModel(name)
  }

  return {
    activeSidebarTab,
    activeWellId: well?.well_id ?? null,
    activeWellView,
    compactionModels,
    curveCount: curves.length,
    deviationVisibilityByWellId,
    formations,
    handleCurveSettingUpdate,
    handleFocusCurveObject,
    handleFocusFormationObject,
    handleFocusLasGroupObject,
    handleFocusTopsGroupObject,
    handleFocusWellObject,
    handleSaveWellInspector,
    handleSelectCurve,
    handleSelectFormation,
    handleSelectLasGroup,
    handleSelectTopsGroup,
    handleSelectWell,
    handleSetDeviationVisible,
    handleToggleAllCurves,
    handleToggleAllFormations,
    handleToggleCurve,
    handleToggleFormation,
    handleWellInspectorDraftChange,
    maxDepth,
    minDepth,
    onActivateChart: (chartId: number) => void activateChart(chartId),
    onActivateCompactionModel: (id: number) => void activateCompactionModel(id),
    onCreateCompactionModel: handleCreateCompactionModel,
    onDeleteChart: (chartId: number) => void deleteChart(chartId),
    onDeleteCompactionModel: (id: number) => void deleteCompactionModel(id).catch((e: unknown) => window.alert(String(e))),
    onDeleteCompactionModelById: (id: number, name: string, isBuiltin: boolean, isActive: boolean) =>
      void handleDeleteCompactionModelById(id, name, isBuiltin, isActive),
    onDeleteFormation: (wellId: string, formationId: string, name: string) => void handleDeleteFormation(wellId, formationId, name),
    onDeleteStratChartById: (chartId: number, name: string, isBuiltin: boolean) => void handleDeleteChartById(chartId, name, isBuiltin),
    onDeleteWellById: (wellId: string, wellName: string) => void handleDeleteWell(wellId, wellName),
    onDuplicateCompactionModel: (id: number, name: string) => void handleDuplicateCompactionModel(id, name),
    onDuplicateFormation: (
      wellId: string,
      formation: { name: string; depth_md: number; active_strat_color: string | null },
    ) => void handleDuplicateFormation(wellId, formation),
    onRenameFormation: (wellId: string, formationId: string, currentName: string) =>
      void handleRenameFormation(wellId, formationId, currentName),
    onRenameSelectedObject: () => void handleRenameSelectedObject(),
    onRenameWellById: (wellId: string, currentName: string) => void handleRenameWell(wellId, currentName),
    onSelectChart: (chartId: number) => setSelectedObject({ type: 'strat-chart', chartId }),
    onSelectCompactionModel: (modelId: number) => setSelectedObject({ type: 'compaction-model', modelId }),
    onSelectModelsTab: () => setActiveSidebarTab('models'),
    onSelectStratChartsTab: () => setActiveSidebarTab('strat-charts'),
    onSelectWellsTab: () => setActiveSidebarTab('wells'),
    selectedChart,
    selectedChartId: selectedObject?.type === 'strat-chart' ? selectedObject.chartId : null,
    selectedCompactionModel,
    selectedCompactionModelId: selectedObject?.type === 'compaction-model' ? selectedObject.modelId : null,
    selectedCurveConfig,
    selectedFormation,
    selectedFormationId,
    selectedObject,
    setFormationMove: (formationId: string, depth: number) => {
      if (Number.isFinite(depth)) void updateFormationDepth(formationId, depth)
    },
    setFormationUpdate: (formationId: string, patch: { name?: string; age_ma?: number; kind?: string; color?: string }) => void updateFormation(formationId, patch),
    sidebarTopRatio,
    sidebarWidth,
    stratCharts,
    visibleCurveCount: visibleCurveMnemonics.length,
    visibleCurveMnemonicsByWellId,
    visibleFormationIds: activeWellView.visibleFormationIds,
    visibleFormationIdsByWellId,
    well,
    wellInspectorDraft,
    wellInventories,
  }
}
