import { create } from 'zustand'

import { rememberProjectBundlePath } from '@/components/layout/pathMemory'
import { recordOperation } from '@/utils/diagnostics'

import { useViewStore, type DepthTrackConfig, type FormationsTrackConfig, type SeaLevelOverlayStyle, type SubsidenceModelType, type SubsidenceModelConfig } from './viewStore'
import { useWellDataStore } from './wellDataStore'
import { useWorkspaceStore } from './workspaceStore'

export interface RecentProject {
  name: string
  path: string
  lastOpened: string
}

export interface CheckpointStatistics {
  project_name?: string | null
  well_count: number
  well_names: string[]
  log_curve_count: number
  top_pick_count: number
  top_set_count: number
  strat_chart_count: number
  sea_level_curve_count: number
  deviation_survey_count: number
  well_ids?: string[]
}

export interface Checkpoint {
  id: number
  name: string
  description: string
  statistics: CheckpointStatistics | null
  timestamp: string
  file_path: string
  byte_size: number
  sha256: string
  app_version: string
  schema_version: number
}

export interface ProjectStore {
  isOpen: boolean
  projectName: string | null
  projectPath: string | null
  isDirty: boolean
  backendDirty: boolean
  pendingVisualConfigDirty: boolean
  canUndo: boolean
  canRedo: boolean
  visualConfig: Record<string, unknown>
  visualConfigSaveToken: number
  recentProjects: RecentProject[]
  pollStatus: () => Promise<void>
  loadRecentProjects: () => Promise<void>
  openProject: (path: string) => Promise<void>
  createProject: (name: string, path: string, overwrite?: boolean) => Promise<void>
  closeProject: () => Promise<void>
  loadVisualConfig: () => Promise<void>
  saveVisualConfig: (patch: Record<string, unknown>) => Promise<void>
  loadScopedVisualConfig: (scope: 'project' | 'well', scopeId?: string) => Promise<Record<string, unknown>>
  saveScopedVisualConfig: (scope: 'project' | 'well', patch: Record<string, unknown>, scopeId?: string) => Promise<Record<string, unknown>>
  saveProject: () => Promise<void>
  createCheckpoint: (name?: string, description?: string) => Promise<Checkpoint>
  listCheckpoints: () => Promise<Checkpoint[]>
  restoreCheckpoint: (checkpointId: number) => Promise<Checkpoint>
  undo: () => Promise<void>
  redo: () => Promise<void>
  markVisualConfigDirty: () => void
  clearVisualConfigDirty: () => void
}

interface VisualConfigResponse {
  scope: string
  scope_id: string
  config: Record<string, unknown>
}

interface VisualConfigPayload {
  depthPerPixel?: number
  trackWidths?: Record<string, number>
  curveColors?: Record<string, string>
  subsidenceWidth?: number
  depthTrackConfig?: Partial<DepthTrackConfig>
  formationsTrackConfig?: Partial<FormationsTrackConfig>
  subsidenceSingleDepthMin?: number | null
  subsidenceSingleDepthMax?: number | null
  subsidenceMultiDepthMin?: number | null
  subsidenceMultiDepthMax?: number | null
  subsidenceSingleAgeMin?: number | null
  subsidenceSingleAgeMax?: number | null
  subsidenceMultiAgeMin?: number | null
  subsidenceMultiAgeMax?: number | null
  activeSubsidenceModelType?: string
  subsidenceModelConfigs?: Record<string, { zoneSetId?: number | null; seaLevelCurveId?: number | null }>
  subsidenceSingleShowSeaLevel?: boolean
  subsidenceSingleSeaLevelOverlayCurveIds?: number[]
  seaLevelOverlayStyles?: Record<string, Partial<SeaLevelOverlayStyle>>
  subsidenceReconstructStratUnitId?: number | null
  subsidenceTruncateBelowStratUnitId?: number | null
  stratTimescaleUpperRank?: string | null
  stratTimescaleLowerRank?: string | null
}

interface ProjectStatusResponse {
  is_open: boolean
  is_dirty: boolean
  can_undo: boolean
  can_redo: boolean
  project_name: string | null
  project_path: string | null
}

interface RecentProjectResponse {
  name: string
  path: string
  last_opened: string
}

interface CreateProjectResponse {
  project_path: string
}

interface OpenProjectResponse {
  project_name: string
  project_path: string
}

type CheckpointResponse = Checkpoint

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

async function fetchStatus(): Promise<ProjectStatusResponse> {
  const response = await fetch('/api/projects/status')
  if (!response.ok) {
    throw new Error(`Failed to read project status (${response.status})`)
  }
  return (await response.json()) as ProjectStatusResponse
}

async function fetchRecentProjects(): Promise<RecentProjectResponse[]> {
  const response = await fetch('/api/projects/recent')
  if (!response.ok) {
    throw new Error(await readError(response, `Failed to read recent projects (${response.status})`))
  }
  return (await response.json()) as RecentProjectResponse[]
}

async function createProjectRequest(name: string, path: string, overwrite = false): Promise<CreateProjectResponse> {
  const response = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, path, overwrite }),
  })
  if (!response.ok) {
    throw new Error(await readError(response, `Failed to create project (${response.status})`))
  }
  return (await response.json()) as CreateProjectResponse
}

async function openProjectRequest(path: string): Promise<OpenProjectResponse> {
  const response = await fetch('/api/projects/open', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  if (!response.ok) {
    throw new Error(await readError(response, `Failed to open project (${response.status})`))
  }
  return (await response.json()) as OpenProjectResponse
}

async function postAction(path: string): Promise<void> {
  const response = await fetch(path, { method: 'POST' })
  if (!response.ok) {
    throw new Error(await readError(response, `Request failed for ${path} (${response.status})`))
  }
}

async function postJsonAction<T = unknown>(path: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    throw new Error(await readError(response, `Request failed for ${path} (${response.status})`))
  }
  return (await response.json()) as T
}

async function fetchCheckpoints(): Promise<Checkpoint[]> {
  const response = await fetch('/api/projects/checkpoints')
  if (!response.ok) {
    throw new Error(await readError(response, `Failed to read checkpoints (${response.status})`))
  }
  return (await response.json()) as CheckpointResponse[]
}

async function fetchVisualConfig(scope: 'project' | 'well' = 'project', scopeId?: string): Promise<VisualConfigResponse> {
  const query = new URLSearchParams({ scope })
  if (scopeId) {
    query.set('scope_id', scopeId)
  }
  const response = await fetch(`/api/projects/visual-config?${query.toString()}`)
  if (!response.ok) {
    throw new Error(`Failed to read visual config (${response.status})`)
  }
  return (await response.json()) as VisualConfigResponse
}

async function patchVisualConfig(scope: 'project' | 'well', patch: Record<string, unknown>, scopeId?: string): Promise<VisualConfigResponse> {
  const response = await fetch('/api/projects/visual-config', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope, scope_id: scopeId, config: patch }),
  })
  if (!response.ok) {
    throw new Error(`Failed to save visual config (${response.status})`)
  }
  return (await response.json()) as VisualConfigResponse
}

function applyVisualConfigPayload(config: Record<string, unknown>): void {
  const payload = config as VisualConfigPayload
  useViewStore.getState().applyVisualConfig({
    depthPerPixel: payload.depthPerPixel,
    trackWidths: payload.trackWidths,
    subsidenceWidth: payload.subsidenceWidth,
    depthTrackConfig: payload.depthTrackConfig,
    formationsTrackConfig: payload.formationsTrackConfig,
    subsidenceSingleDepthMin: payload.subsidenceSingleDepthMin,
    subsidenceSingleDepthMax: payload.subsidenceSingleDepthMax,
    subsidenceMultiDepthMin: payload.subsidenceMultiDepthMin,
    subsidenceMultiDepthMax: payload.subsidenceMultiDepthMax,
    subsidenceSingleAgeMin: payload.subsidenceSingleAgeMin,
    subsidenceSingleAgeMax: payload.subsidenceSingleAgeMax,
    subsidenceMultiAgeMin: payload.subsidenceMultiAgeMin,
    subsidenceMultiAgeMax: payload.subsidenceMultiAgeMax,
    activeSubsidenceModelType: payload.activeSubsidenceModelType as SubsidenceModelType | undefined,
    subsidenceModelConfigs: payload.subsidenceModelConfigs as Partial<Record<SubsidenceModelType, SubsidenceModelConfig>> | undefined,
    subsidenceSingleShowSeaLevel: payload.subsidenceSingleShowSeaLevel,
    subsidenceSingleSeaLevelOverlayCurveIds: payload.subsidenceSingleSeaLevelOverlayCurveIds,
    seaLevelOverlayStyles: payload.seaLevelOverlayStyles,
    subsidenceReconstructStratUnitId: payload.subsidenceReconstructStratUnitId,
    subsidenceTruncateBelowStratUnitId: payload.subsidenceTruncateBelowStratUnitId,
    stratTimescaleUpperRank: payload.stratTimescaleUpperRank,
    stratTimescaleLowerRank: payload.stratTimescaleLowerRank,
  })
  useWellDataStore.getState().setColorOverrides(payload.curveColors ?? {})
}

function mapRecentProjects(payload: RecentProjectResponse[]): RecentProject[] {
  return payload.map((entry) => ({
    name: entry.name,
    path: entry.path,
    lastOpened: entry.last_opened,
  }))
}

function projectTrackWidths(): Record<string, number> {
  const { trackWidths } = useViewStore.getState()
  return Object.fromEntries(
    Object.entries(trackWidths).filter(([trackId]) => trackId === 'depth' || trackId === 'formations'),
  )
}

export function collectProjectVisualConfig(): VisualConfigPayload {
  const vs = useViewStore.getState()
  return {
    depthPerPixel: vs.depthPerPixel,
    trackWidths: projectTrackWidths(),
    curveColors: useWellDataStore.getState().colorOverrides,
    subsidenceWidth: vs.subsidenceWidth,
    depthTrackConfig: vs.depthTrackConfig,
    formationsTrackConfig: vs.formationsTrackConfig,
    subsidenceSingleDepthMin: vs.subsidenceSingleDepthMin,
    subsidenceSingleDepthMax: vs.subsidenceSingleDepthMax,
    subsidenceMultiDepthMin: vs.subsidenceMultiDepthMin,
    subsidenceMultiDepthMax: vs.subsidenceMultiDepthMax,
    subsidenceSingleAgeMin: vs.subsidenceSingleAgeMin,
    subsidenceSingleAgeMax: vs.subsidenceSingleAgeMax,
    subsidenceMultiAgeMin: vs.subsidenceMultiAgeMin,
    subsidenceMultiAgeMax: vs.subsidenceMultiAgeMax,
    activeSubsidenceModelType: vs.activeSubsidenceModelType,
    subsidenceModelConfigs: vs.subsidenceModelConfigs,
    subsidenceSingleShowSeaLevel: vs.subsidenceSingleShowSeaLevel,
    subsidenceSingleSeaLevelOverlayCurveIds: vs.subsidenceSingleSeaLevelOverlayCurveIds,
    seaLevelOverlayStyles: vs.seaLevelOverlayStyles,
    subsidenceReconstructStratUnitId: vs.subsidenceReconstructStratUnitId,
    subsidenceTruncateBelowStratUnitId: vs.subsidenceTruncateBelowStratUnitId,
    stratTimescaleUpperRank: vs.stratTimescaleUpperRank,
    stratTimescaleLowerRank: vs.stratTimescaleLowerRank,
  }
}

export function collectWellVisualConfigs(): Record<string, Record<string, unknown>> {
  const { wellViewStates } = useWorkspaceStore.getState()
  return Object.fromEntries(
    Object.entries(wellViewStates).map(([wellId, state]) => [wellId, state as unknown as Record<string, unknown>]),
  )
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  isOpen: false,
  projectName: null,
  projectPath: null,
  isDirty: false,
  backendDirty: false,
  pendingVisualConfigDirty: false,
  canUndo: false,
  canRedo: false,
  visualConfig: {},
  visualConfigSaveToken: 0,
  recentProjects: [],
  async pollStatus() {
    try {
      const payload = await fetchStatus()
      set({
        isOpen: payload.is_open,
        projectName: payload.project_name,
        projectPath: payload.project_path,
        backendDirty: payload.is_dirty,
        isDirty: payload.is_dirty || get().pendingVisualConfigDirty,
        canUndo: payload.can_undo,
        canRedo: payload.can_redo,
      })
    } catch {
      set({
        isOpen: false,
        projectName: null,
        projectPath: null,
        isDirty: false,
        backendDirty: false,
        pendingVisualConfigDirty: false,
        canUndo: false,
        canRedo: false,
        visualConfig: {},
        visualConfigSaveToken: 0,
      })
      applyVisualConfigPayload({})
    }
  },
  async loadRecentProjects() {
    const payload = await fetchRecentProjects()
    set({ recentProjects: mapRecentProjects(payload) })
  },
  async openProject(path) {
    await recordOperation('project.open', async () => {
      if (get().isOpen) {
        await postAction('/api/projects/close')
        set({
          isOpen: false,
          projectName: null,
          projectPath: null,
          isDirty: false,
          backendDirty: false,
          pendingVisualConfigDirty: false,
          canUndo: false,
          canRedo: false,
          visualConfig: {},
          visualConfigSaveToken: 0,
        })
        applyVisualConfigPayload({})
      }
      const payload = await openProjectRequest(path)
      set({
        isOpen: true,
        projectName: payload.project_name,
        projectPath: payload.project_path,
        isDirty: false,
        backendDirty: false,
        pendingVisualConfigDirty: false,
        canUndo: false,
        canRedo: false,
        visualConfig: {},
        visualConfigSaveToken: 0,
      })
      rememberProjectBundlePath(payload.project_path)
      try {
        await get().loadRecentProjects()
      } catch {
        // Do not fail project open because recent-project history could not refresh.
      }
    }, { projectPath: path })
  },
  async createProject(name, path, overwrite = false) {
    await recordOperation('project.create', async () => {
      const payload = await createProjectRequest(name, path, overwrite)
      await get().openProject(payload.project_path)
    }, { projectPath: path, details: { name, overwrite } })
  },
  async closeProject() {
    await recordOperation('project.close', async () => {
      await postAction('/api/projects/close')
      set({
        isOpen: false,
        projectName: null,
        projectPath: null,
        isDirty: false,
        backendDirty: false,
        pendingVisualConfigDirty: false,
        canUndo: false,
        canRedo: false,
        visualConfig: {},
        visualConfigSaveToken: 0,
      })
      applyVisualConfigPayload({})
    }, { projectPath: get().projectPath })
  },
  async loadVisualConfig() {
    const payload = await fetchVisualConfig()
    set({ visualConfig: payload.config })
    applyVisualConfigPayload(payload.config)
  },
  async saveVisualConfig(patch) {
    await get().saveScopedVisualConfig('project', patch)
  },
  async loadScopedVisualConfig(scope, scopeId) {
    const payload = await fetchVisualConfig(scope, scopeId)
    if (scope === 'project') {
      set({ visualConfig: payload.config })
      applyVisualConfigPayload(payload.config)
    }
    return payload.config
  },
  async saveScopedVisualConfig(scope, patch, scopeId) {
    const current = scope === 'project' ? get().visualConfig : {}
    const next = { ...current, ...patch }
    const payload = await patchVisualConfig(scope, patch, scopeId)
    if (scope === 'project') {
      set({ visualConfig: payload.config ?? next })
      // Do not call applyVisualConfigPayload here: values are already live in the
      // stores when the user changed them. Re-applying creates a new colorOverrides
      // reference that triggers the save effect again (infinite loop).
    }
    const status = await fetchStatus()
    set({
      isOpen: status.is_open,
      projectName: status.project_name,
      projectPath: status.project_path,
      backendDirty: status.is_dirty,
      isDirty: status.is_dirty || get().pendingVisualConfigDirty,
      canUndo: status.can_undo,
      canRedo: status.can_redo,
    })
    return payload.config ?? next
  },
  async saveProject() {
    await recordOperation('project.save', async () => {
      const projectConfig = collectProjectVisualConfig()
      const wellConfigs = collectWellVisualConfigs()
      await patchVisualConfig('project', projectConfig as unknown as Record<string, unknown>)
      await Promise.all(
        Object.entries(wellConfigs).map(([wellId, config]) => patchVisualConfig('well', config, wellId)),
      )
      await postAction('/api/projects/save')
      const payload = await fetchStatus()
      set({
        isOpen: payload.is_open,
        projectName: payload.project_name,
        projectPath: payload.project_path,
        backendDirty: payload.is_dirty,
        pendingVisualConfigDirty: false,
        isDirty: payload.is_dirty,
        canUndo: payload.can_undo,
        canRedo: payload.can_redo,
        visualConfig: projectConfig as unknown as Record<string, unknown>,
        visualConfigSaveToken: get().visualConfigSaveToken + 1,
      })
    }, { projectPath: get().projectPath })
  },
  async createCheckpoint(name, description = '') {
    let checkpoint: Checkpoint | null = null
    await recordOperation('checkpoint.create', async () => {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      checkpoint = await postJsonAction<Checkpoint>('/api/projects/checkpoints', {
        name: name?.trim() || `checkpoint-${stamp}`,
        description,
      })
      const payload = await fetchStatus()
      set({
        isOpen: payload.is_open,
        projectName: payload.project_name,
        projectPath: payload.project_path,
        backendDirty: payload.is_dirty,
        isDirty: payload.is_dirty || get().pendingVisualConfigDirty,
        canUndo: payload.can_undo,
        canRedo: payload.can_redo,
      })
    }, { projectPath: get().projectPath, details: { name } })
    if (!checkpoint) throw new Error('Checkpoint was not created')
    return checkpoint
  },
  async listCheckpoints() {
    return fetchCheckpoints()
  },
  async restoreCheckpoint(checkpointId) {
    let checkpoint: Checkpoint | null = null
    await recordOperation('checkpoint.restore', async () => {
      checkpoint = await postJsonAction<Checkpoint>(`/api/projects/checkpoints/${checkpointId}/restore`, {})
      const payload = await fetchStatus()
      set({
        isOpen: payload.is_open,
        projectName: payload.project_name,
        projectPath: payload.project_path,
        backendDirty: payload.is_dirty,
        isDirty: payload.is_dirty || get().pendingVisualConfigDirty,
        canUndo: payload.can_undo,
        canRedo: payload.can_redo,
      })
      await useWellDataStore.getState().loadWellInventories()
      await useWellDataStore.getState().loadStratCharts()
      await useWellDataStore.getState().loadSeaLevelCurves()
      await useWellDataStore.getState().loadTopSets()
      await useWellDataStore.getState().refreshWell()
    }, { projectPath: get().projectPath, details: { checkpointId } })
    if (!checkpoint) throw new Error('Checkpoint was not restored')
    return checkpoint
  },
  async undo() {
    await recordOperation('undo.run', async () => {
      await postAction('/api/projects/undo')
      const payload = await fetchStatus()
      set({
        isOpen: payload.is_open,
        projectName: payload.project_name,
        projectPath: payload.project_path,
        backendDirty: payload.is_dirty,
        isDirty: payload.is_dirty || get().pendingVisualConfigDirty,
        canUndo: payload.can_undo,
        canRedo: payload.can_redo,
      })
      const wellId = useWellDataStore.getState().well?.well_id
      if (wellId) {
        await useWellDataStore.getState().loadWell(wellId)
      }
    }, { projectPath: get().projectPath, activeWellId: useWellDataStore.getState().well?.well_id })
  },
  async redo() {
    await recordOperation('redo.run', async () => {
      await postAction('/api/projects/redo')
      const payload = await fetchStatus()
      set({
        isOpen: payload.is_open,
        projectName: payload.project_name,
        projectPath: payload.project_path,
        backendDirty: payload.is_dirty,
        isDirty: payload.is_dirty || get().pendingVisualConfigDirty,
        canUndo: payload.can_undo,
        canRedo: payload.can_redo,
      })
      const wellId = useWellDataStore.getState().well?.well_id
      if (wellId) {
        await useWellDataStore.getState().loadWell(wellId)
      }
    }, { projectPath: get().projectPath, activeWellId: useWellDataStore.getState().well?.well_id })
  },
  markVisualConfigDirty() {
    set((state) => (
      state.pendingVisualConfigDirty
        ? state
        : {
            pendingVisualConfigDirty: true,
            isDirty: true,
          }
    ))
  },
  clearVisualConfigDirty() {
    set((state) => ({
      pendingVisualConfigDirty: false,
      isDirty: state.backendDirty,
    }))
  },
}))
