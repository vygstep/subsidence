export type MultiFileImportStatus = 'pending' | 'imported' | 'failed' | 'skipped'

export interface MultiFileImportItem {
  path: string
  status: MultiFileImportStatus
  message?: string
}

export interface MultiFileImportSummary {
  total: number
  imported: number
  failed: number
  skipped: number
}

export function createMultiFileQueue(paths: string[]): MultiFileImportItem[] {
  return paths
    .map((path) => path.trim())
    .filter((path, index, all) => path.length > 0 && all.indexOf(path) === index)
    .map((path) => ({ path, status: 'pending' }))
}

export function summarizeMultiFileQueue(queue: MultiFileImportItem[]): MultiFileImportSummary {
  return {
    total: queue.length,
    imported: queue.filter((item) => item.status === 'imported').length,
    failed: queue.filter((item) => item.status === 'failed').length,
    skipped: queue.filter((item) => item.status === 'skipped').length,
  }
}

export function nextPendingFileIndex(queue: MultiFileImportItem[], afterIndex: number): number {
  for (let index = afterIndex + 1; index < queue.length; index += 1) {
    if (queue[index].status === 'pending') return index
  }
  return -1
}
