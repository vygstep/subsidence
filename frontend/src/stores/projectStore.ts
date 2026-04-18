import { create } from 'zustand'

import { useViewStore } from './viewStore'
import { useWellDataStore } from './wellDataStore'

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
  canUndo: boolean
  canRedo: boolean
  visualConfig: Record<string, unknown>
  recentProjects: RecentProject[]
  pollStatus: () => Promise<void>
  loadRecentProjects: () => Promise<void>
  openProject: (path: string) => Promise<void>
  createProject: (name: string, path: string) => Promise<void>
  closeProject: () => Promise<void>
  loadVisualConfig: () => Promise<void>
  saveVisualConfig: (patch: Record<string, unknown>) => Promise<void>
  saveProject: () => Promise<void>
  undo: () => Promise<void>
  redo: () => Promise<void>
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

async function createProjectRequest(name: string, path: string): Promise<CreateProjectResponse> {
  const response = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, path }),
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

async function fetchVisualConfig(): Promise<VisualConfigResponse> {
  const response = await fetch('/api/projects/visual-config?scope=project')
  if (!response.ok) {
    throw new Error(`Failed to read visual config (${response.status})`)
  }
  return (await response.json()) as VisualConfigResponse
}

async function patchVisualConfig(patch: Record<string, unknown>): Promise<VisualConfigResponse> {
  const response = await fetch('/api/projects/visual-config', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope: 'project', config: patch }),
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

export const useProjectStore = create<ProjectStore>((set, get) => ({
  isOpen: false,
  projectName: null,
  projectPath: null,
  isDirty: false,
  canUndo: false,
  canRedo: false,
  visualConfig: {},
  recentProjects: [],
  async pollStatus() {
    try {
      const payload = await fetchStatus()
      set({
        isOpen: payload.is_open,
        projectName: payload.project_name,
        projectPath: payload.project_path,
        isDirty: payload.is_dirty,
        canUndo: payload.can_undo,
        canRedo: payload.can_redo,
      })
    } catch {
      set({
        isOpen: false,
        projectName: null,
        projectPath: null,
        isDirty: false,
        canUndo: false,
        canRedo: false,
        visualConfig: {},
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
        canUndo: false,
        canRedo: false,
        visualConfig: {},
      })
      applyVisualConfigPayload({})
    }
    const payload = await openProjectRequest(path)
    set({
      isOpen: true,
      projectName: payload.project_name,
      projectPath: payload.project_path,
      isDirty: false,
      canUndo: false,
      canRedo: false,
      visualConfig: {},
    })
    try {
      await get().loadRecentProjects()
    } catch {
      // Do not fail project open because recent-project history could not refresh.
    }
  },
  async createProject(name, path) {
    const payload = await createProjectRequest(name, path)
    await get().openProject(payload.project_path)
  },
  async closeProject() {
    await postAction('/api/projects/close')
    set({
      isOpen: false,
      projectName: null,
      projectPath: null,
      isDirty: false,
      canUndo: false,
      canRedo: false,
      visualConfig: {},
    })
    applyVisualConfigPayload({})
  },
  async loadVisualConfig() {
    const payload = await fetchVisualConfig()
    set({ visualConfig: payload.config })
    applyVisualConfigPayload(payload.config)
  },
  async saveVisualConfig(patch) {
    const current = get().visualConfig
    const next = { ...current, ...patch }
    const payload = await patchVisualConfig(patch)
    set({ visualConfig: payload.config ?? next })
    // Do not call applyVisualConfigPayload here: values are already live in the
    // stores when the user changed them. Re-applying creates a new colorOverrides
    // reference that triggers the save effect again (infinite loop).
  },
  async saveProject() {
    await postAction('/api/projects/save')
    const payload = await fetchStatus()
    set({
      isOpen: payload.is_open,
      projectName: payload.project_name,
      projectPath: payload.project_path,
      isDirty: payload.is_dirty,
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
      isDirty: payload.is_dirty,
      canUndo: payload.can_undo,
      canRedo: payload.can_redo,
    })
  },
  async redo() {
    await postAction('/api/projects/redo')
    const payload = await fetchStatus()
    set({
      isOpen: payload.is_open,
      projectName: payload.project_name,
      projectPath: payload.project_path,
      isDirty: payload.is_dirty,
      canUndo: payload.can_undo,
      canRedo: payload.can_redo,
    })
  },
}))
