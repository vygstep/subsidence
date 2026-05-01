import { useWellDataStore } from '@/stores'
import type { CompactionModel, FormationTop, Well } from '@/types'
import type { SelectedObject, WellViewState } from '@/stores/workspaceStore'

export async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: string }
    if (payload.detail) return payload.detail
  } catch {
    // ignore non-JSON payloads
  }
  return fallback
}

type WellInspectorDraft = {
  well_name: string
  color_hex: string
  x: string
  y: string
  kb_elev: string
  gl_elev: string
  td_md: string
  crs: string
}

interface ActionDeps {
  well: Well | null
  wellInspectorDraft: WellInspectorDraft
  setWellInspectorDraft: (updater: (prev: WellInspectorDraft) => WellInspectorDraft) => void
  selectedObject: SelectedObject | null
  selectedFormation: FormationTop | null
  selectedCompactionModel: CompactionModel | null
  selectedFormationId: string | null
  setSelectedObject: (obj: SelectedObject | null) => void
  setSelectedFormationId: (id: string | null) => void
  dropWellViewState: (wellId: string) => void
  updateWellViewState: (wellId: string, updater: (state: WellViewState) => WellViewState) => void
  selectTrack: (id: string | null) => void
  refreshWell: (preferredWellId?: string) => Promise<void>
  loadWellInventories: () => Promise<boolean>
  updateFormation: (formationId: string, patch: Record<string, unknown>) => Promise<void>
  deleteChart: (chartId: number) => Promise<void>
  createCompactionModel: (name: string, cloneFromId?: number) => Promise<CompactionModel>
  deleteCompactionModel: (id: number) => Promise<void>
}

export function makeActionHandlers(deps: ActionDeps) {
  const {
    well,
    wellInspectorDraft,
    setWellInspectorDraft,
    selectedObject,
    selectedFormation,
    selectedCompactionModel,
    selectedFormationId,
    setSelectedObject,
    setSelectedFormationId,
    dropWellViewState,
    updateWellViewState,
    selectTrack,
    refreshWell,
    loadWellInventories,
    updateFormation,
    deleteChart,
    createCompactionModel,
    deleteCompactionModel,
  } = deps

  async function handleSaveWellInspector(): Promise<void> {
    if (!well?.well_id) return
    const payload = {
      well_name: wellInspectorDraft.well_name.trim(),
      color_hex: wellInspectorDraft.color_hex.trim(),
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
      const nextName = window.prompt('Rename legacy runtime model', selectedCompactionModel.name)?.trim()
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
    updateWellViewState(wellId, (state) => ({
      ...state,
      visibleFormationIds: state.visibleFormationIds.filter((id) => id !== formationId),
    }))
    if (well?.well_id === wellId) {
      await refreshWell(wellId)
    }
    if (selectedFormationId === formationId) {
      setSelectedFormationId(null)
      setSelectedObject(null)
    }
  }

  async function handleDeleteCurve(wellId: string, mnemonic: string): Promise<void> {
    if (!window.confirm(`Delete log curve "${mnemonic}"?`)) return
    const response = await fetch(`/api/wells/${wellId}/curves/${encodeURIComponent(mnemonic)}`, { method: 'DELETE' })
    if (!response.ok) {
      window.alert(await readError(response, `Failed to delete curve '${mnemonic}' (${response.status})`))
      return
    }
    updateWellViewState(wellId, (state) => ({
      ...state,
      tracks: state.tracks.map((track) => ({
        ...track,
        curves: track.curves.filter((c) => c.mnemonic !== mnemonic),
      })),
      hiddenCurveMnemonics: state.hiddenCurveMnemonics.filter((m) => m !== mnemonic),
    }))
    if (selectedObject?.type === 'curve' && (selectedObject as { wellId?: string }).wellId === wellId
        && (selectedObject as { mnemonic?: string }).mnemonic === mnemonic) {
      setSelectedObject(null)
    }
    await loadWellInventories()
    if (well?.well_id === wellId) await refreshWell(wellId)
  }

  async function handleDeleteAllCurves(wellId: string, wellName: string, curveCount: number): Promise<void> {
    if (!window.confirm(`Delete all ${curveCount} log curves for "${wellName}"?`)) return
    const response = await fetch(`/api/wells/${wellId}/curves`, { method: 'DELETE' })
    if (!response.ok) {
      window.alert(await readError(response, `Failed to delete curves (${response.status})`))
      return
    }
    updateWellViewState(wellId, (state) => ({
      ...state,
      tracks: state.tracks.map((track) => ({ ...track, curves: [] })),
      hiddenCurveMnemonics: [],
    }))
    if (selectedObject?.type === 'curve' && (selectedObject as { wellId?: string }).wellId === wellId) {
      setSelectedObject(null)
    }
    await loadWellInventories()
    if (well?.well_id === wellId) await refreshWell(wellId)
  }

  async function handleDeleteDeviation(wellId: string, wellName: string): Promise<void> {
    if (!window.confirm(`Delete deviation survey for "${wellName}"?`)) return
    const response = await fetch(`/api/wells/${wellId}/deviation`, { method: 'DELETE' })
    if (!response.ok) {
      window.alert(await readError(response, `Failed to delete deviation survey (${response.status})`))
      return
    }
    updateWellViewState(wellId, (state) => ({ ...state, deviationVisible: false }))
    await loadWellInventories()
    if (well?.well_id === wellId) await refreshWell(wellId)
  }

  async function handleDeleteAllFormations(
    wellId: string,
    formations: Array<{ id: string; name: string }>,
    wellName: string,
  ): Promise<void> {
    if (formations.length === 0) return
    if (!window.confirm(`Delete all ${formations.length} tops for "${wellName}"?`)) return

    for (const formation of formations) {
      // eslint-disable-next-line no-await-in-loop
      const response = await fetch(`/api/wells/${wellId}/formations/${formation.id}`, { method: 'DELETE' })
      if (!response.ok) {
        window.alert(await readError(response, `Failed to delete top '${formation.name}' (${response.status})`))
        return
      }
    }

    updateWellViewState(wellId, (state) => ({ ...state, visibleFormationIds: [] }))
    if (formations.some((formation) => formation.id === selectedFormationId)) {
      setSelectedFormationId(null)
      setSelectedObject(null)
    }
    await loadWellInventories()
    if (well?.well_id === wellId) {
      await refreshWell(wellId)
    }
  }

  async function handleDuplicateFormation(
    wellId: string,
    formation: { name: string; depth_md: number | null; active_strat_color: string | null },
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
      window.alert('Built-in legacy runtime model cannot be deleted.')
      return
    }
    if (isActive) {
      window.alert('Activate another legacy runtime model first.')
      return
    }
    if (!window.confirm(`Delete legacy runtime model "${name}"?`)) return
    await deleteCompactionModel(modelId)
    setSelectedObject(null)
  }

  function handleWellInspectorDraftChange(field: keyof WellInspectorDraft, value: string): void {
    setWellInspectorDraft((current) => ({ ...current, [field]: value }))
  }

  function handleCreateCompactionModel(): void {
    const name = window.prompt('New legacy runtime model name:')?.trim()
    if (!name) return
    void createCompactionModel(name)
  }

  return {
    handleSaveWellInspector,
    handleRenameSelectedObject,
    handleRenameWell,
    handleDeleteWell,
    handleRenameFormation,
    handleDeleteFormation,
    handleDeleteAllFormations,
    handleDuplicateFormation,
    handleDeleteChartById,
    handleDuplicateCompactionModel,
    handleDeleteCompactionModelById,
    handleWellInspectorDraftChange,
    handleCreateCompactionModel,
    handleDeleteCurve,
    handleDeleteAllCurves,
    handleDeleteDeviation,
  }
}
