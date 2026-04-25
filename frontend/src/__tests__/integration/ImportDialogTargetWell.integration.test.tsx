import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ImportDeviationDialog } from '@/components/layout/ImportDeviationDialog'
import { ImportLasDialog } from '@/components/layout/ImportLasDialog'
import { ImportTopsDialog } from '@/components/layout/ImportTopsDialog'
import { useProjectStore } from '@/stores/projectStore'

const wells = [
  { well_id: 'well-a', well_name: 'Well A' },
  { well_id: 'well-b', well_name: 'Well B' },
]

const TABULAR_PREVIEW_RESPONSE = {
  columns: ['well_name', 'depth', 'top_name', 'incl', 'azim'],
  rows: [['Well A', '100', 'Top A', '0', '0']],
  detected_delimiter: ',',
  header_row: 0,
  total_rows: 1,
  warnings: [],
}

const LAS_PREVIEW_RESPONSE = {
  well_name: 'Well B',
  well_id: null,
  depth_unit: 'M',
  curves: [{ mnemonic: 'DEPT', unit: 'M', description: 'Depth' }],
  start_depth: 100,
  stop_depth: 3000,
  step: 0.1524,
  null_value: -999.25,
  warnings: [],
}

function mockFetch(lasResponse = LAS_PREVIEW_RESPONSE, tabularResponse = TABULAR_PREVIEW_RESPONSE) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    const body = url.includes('/las') ? lasResponse : tabularResponse
    return Promise.resolve({ ok: true, json: async () => body })
  }))
}

async function advancePastPreview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await waitFor(() => {
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(false)
  })
  await user.click(screen.getByRole('button', { name: 'Next' }))
}

async function advancePastMapping(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Next' }))
}

describe('Import dialogs target active well by default', () => {
  beforeEach(() => {
    useProjectStore.setState({ projectPath: 'D:\\projects\\test.subsidence' })
    window.localStorage.setItem('subsidence:last-import-root', 'D:\\data\\imports')
    mockFetch()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('preselects the active well in the logs dialog', async () => {
    const user = userEvent.setup()
    render(
      <ImportLasDialog
        wells={wells}
        activeWellId="well-b"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    )

    await advancePastPreview(user)
    expect((screen.getByLabelText('Target well') as HTMLSelectElement).value).toBe('well-b')
  })

  it('preselects the active well in the tops dialog', async () => {
    const user = userEvent.setup()
    render(
      <ImportTopsDialog
        wells={wells}
        activeWellId="well-b"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    )

    await advancePastPreview(user)
    await advancePastMapping(user)
    expect((screen.getByLabelText('Target well') as HTMLSelectElement).value).toBe('well-b')
  })

  it('preselects the active well in the deviation dialog', async () => {
    const user = userEvent.setup()
    render(
      <ImportDeviationDialog
        wells={wells}
        activeWellId="well-b"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    )

    await advancePastPreview(user)
    await advancePastMapping(user)
    expect((screen.getByLabelText('Target well') as HTMLSelectElement).value).toBe('well-b')
  })

  it('blocks the options step until a source path is present', () => {
    window.localStorage.removeItem('subsidence:last-import-root')
    render(
      <ImportTopsDialog
        wells={wells}
        activeWellId="well-b"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    )

    expect(screen.getByText('CSV path is required.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
