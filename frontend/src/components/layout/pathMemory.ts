const LAST_PROJECT_PATH_KEY = 'subsidence:last-project-path'
const LAST_PROJECT_ROOT_KEY = 'subsidence:last-project-root'
const LAST_IMPORT_ROOT_KEY = 'subsidence:last-import-root'

function hasWindow(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function splitPathSegments(path: string): string[] {
  return path.trim().replace(/[\\/]+$/, '').split(/[\\/]+/).filter(Boolean)
}

export function parentDirectory(path: string): string {
  const trimmed = path.trim()
  if (!trimmed) {
    return ''
  }

  const normalized = trimmed.replace(/\//g, '\\').replace(/\\+$/, '')
  if (/^[A-Za-z]:$/.test(normalized)) {
    return normalized
  }

  const segments = splitPathSegments(normalized)
  if (segments.length <= 1) {
    return normalized
  }

  if (/^[A-Za-z]:/.test(normalized)) {
    return `${segments.slice(0, -1).join('\\')}`
  }

  if (normalized.startsWith('\\\\')) {
    return `\\\\${segments.slice(0, -1).join('\\')}`
  }

  return segments.slice(0, -1).join('\\')
}

function setItem(key: string, value: string): void {
  if (!hasWindow()) {
    return
  }
  window.localStorage.setItem(key, value)
}

function getItem(key: string): string {
  if (!hasWindow()) {
    return ''
  }
  return window.localStorage.getItem(key) ?? ''
}

export function rememberProjectBundlePath(projectPath: string): void {
  const trimmed = projectPath.trim()
  if (!trimmed) {
    return
  }
  setItem(LAST_PROJECT_PATH_KEY, trimmed)
  const root = parentDirectory(trimmed)
  if (root) {
    setItem(LAST_PROJECT_ROOT_KEY, root)
  }
}

export function rememberImportPath(path: string): void {
  const root = parentDirectory(path)
  if (root) {
    setItem(LAST_IMPORT_ROOT_KEY, root)
  }
}

export function getLastProjectPath(): string {
  return getItem(LAST_PROJECT_PATH_KEY)
}

export function getLastProjectRoot(): string {
  return getItem(LAST_PROJECT_ROOT_KEY)
}

export function getLastImportRoot(): string {
  return getItem(LAST_IMPORT_ROOT_KEY)
}

interface PickFileRequest {
  initial_path?: string | null
  file_types?: Array<[string, string]>
}

interface PickFolderRequest {
  initial_path?: string | null
}

async function readPickedPath(response: Response, fallback: string): Promise<string> {
  if (!response.ok) {
    try {
      const payload = (await response.json()) as { detail?: string }
      throw new Error(payload.detail ?? fallback)
    } catch (cause) {
      if (cause instanceof Error) {
        throw cause
      }
      throw new Error(fallback)
    }
  }
  const payload = (await response.json()) as { path?: string | null }
  return payload.path ?? ''
}

export async function pickFile(initialPath: string, fileTypes: Array<[string, string]>): Promise<string> {
  const response = await fetch('/api/projects/pick-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      initial_path: initialPath || null,
      file_types: fileTypes,
    } satisfies PickFileRequest),
  })
  return readPickedPath(response, `Failed to open file picker (${response.status})`)
}

export async function pickFolder(initialPath: string): Promise<string> {
  const response = await fetch('/api/projects/pick-folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      initial_path: initialPath || null,
    } satisfies PickFolderRequest),
  })
  return readPickedPath(response, `Failed to open folder picker (${response.status})`)
}

export async function revealInExplorer(path: string): Promise<void> {
  const trimmed = path.trim()
  if (!trimmed) {
    throw new Error('Path is required')
  }
  const response = await fetch('/api/projects/reveal-path', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: trimmed }),
  })
  if (!response.ok) {
    try {
      const payload = (await response.json()) as { detail?: string }
      throw new Error(payload.detail ?? `Failed to reveal path (${response.status})`)
    } catch (cause) {
      if (cause instanceof Error) {
        throw cause
      }
      throw new Error(`Failed to reveal path (${response.status})`)
    }
  }
}
