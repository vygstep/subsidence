import { create } from 'zustand'

export interface ProjectStore {
  isOpen: boolean
  projectName: string | null
  projectPath: string | null
  isDirty: boolean
  canUndo: boolean
  canRedo: boolean
  pollStatus: () => Promise<void>
  saveProject: () => Promise<void>
  undo: () => Promise<void>
  redo: () => Promise<void>
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

export const useProjectStore = create<ProjectStore>((set) => ({
  isOpen: false,
  projectName: null,
  projectPath: null,
  isDirty: false,
  canUndo: false,
  canRedo: false,
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
      })
    }
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
