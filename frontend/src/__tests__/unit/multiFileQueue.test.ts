import { describe, expect, it } from 'vitest'

import {
  createMultiFileQueue,
  nextPendingFileIndex,
  summarizeMultiFileQueue,
} from '@/components/layout/importWizard'

describe('multi-file import queue', () => {
  it('normalizes paths and removes duplicates', () => {
    expect(createMultiFileQueue([' a.las ', '', 'b.csv', 'a.las'])).toEqual([
      { path: 'a.las', status: 'pending' },
      { path: 'b.csv', status: 'pending' },
    ])
  })

  it('summarizes import statuses', () => {
    expect(summarizeMultiFileQueue([
      { path: 'a.las', status: 'imported' },
      { path: 'b.csv', status: 'failed', message: 'bad file' },
      { path: 'c.csv', status: 'skipped' },
      { path: 'd.csv', status: 'pending' },
    ])).toEqual({
      total: 4,
      imported: 1,
      failed: 1,
      skipped: 1,
    })
  })

  it('finds the next pending file after the current index', () => {
    const queue = [
      { path: 'a.las', status: 'imported' as const },
      { path: 'b.csv', status: 'failed' as const },
      { path: 'c.csv', status: 'pending' as const },
    ]

    expect(nextPendingFileIndex(queue, 0)).toBe(2)
    expect(nextPendingFileIndex(queue, 2)).toBe(-1)
  })
})
