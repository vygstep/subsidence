import { create } from 'zustand'

import { rememberProjectBundlePath } from '@/components/layout/pathMemory'

import { useViewStore } from './viewStore'
import { useWellDataStore } from './wellDataStore'
import { useWorkspaceStore } from './workspaceStore'

export interface RecentProject {
  name: string
  path: string
  lastOpened: string
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
  createCheckpoint: (name?: string, description?: string) => Promise<void>
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
  splitRatio?: number
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

async function postJsonAction(path: string, payload: Record<string, unknown>): Promise<void> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    throw new Error(await readError(response, `Request failed for ${path} (${response.status})`))
  }
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
    splitRatio: payload.splitRatio,
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
  return {
    depthPerPixel: useViewStore.getState().depthPerPixel,
    trackWidths: projectTrackWidths(),
    curveColors: useWellDataStore.getState().colorOverrides,
    splitRatio: useViewStore.getState().splitRatio,
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
  },
  async createProject(name, path, overwrite = false) {
    const payload = await createProjectRequest(name, path, overwrite)
    await get().openProject(payload.project_path)
  },
  async closeProject() {
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
  },
  async createCheckpoint(name, description = '') {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    await postJsonAction('/api/projects/checkpoints', {
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
  },
  async undo() {
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
  },
  async redo() {
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
