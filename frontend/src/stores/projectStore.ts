import { create } from 'zustand'

import { useViewStore } from './viewStore'
import { useWellDataStore } from './wellDataStore'

export interface ProjectStore {
  isOpen: boolean
  projectName: string | null
  projectPath: string | null
  isDirty: boolean
  canUndo: boolean
  canRedo: boolean
  visualConfig: Record<string, unknown>
  pollStatus: () => Promise<void>
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

async function fetchStatus(): Promise<ProjectStatusResponse> {
  const response = await fetch('/api/projects/status')
  if (!response.ok) {
    throw new Error(`Failed to read project status (${response.status})`)
  }
  return (await response.json()) as ProjectStatusResponse
}

async function postAction(path: string): Promise<void> {
  const response = await fetch(path, { method: 'POST' })
  if (!response.ok) {
    throw new Error(`Request failed for ${path} (${response.status})`)
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

export const useProjectStore = create<ProjectStore>((set, get) => ({
  isOpen: false,
  projectName: null,
  projectPath: null,
  isDirty: false,
  canUndo: false,
  canRedo: false,
  visualConfig: {},
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
