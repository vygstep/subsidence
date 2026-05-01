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
    if (url === '/api/top-sets') {
      return Promise.resolve({
        ok: true,
        json: async () => [{ id: 7, name: 'Regional TopSet', description: null, horizon_count: 3 }],
      })
    }
    if (url === '/api/projects/import-tops') {
      return Promise.resolve({
        ok: true,
        json: async () => ({ well_id: 'well-b', zone_set_id: 8, qc_warnings: [] }),
      })
    }
    const body = url.includes('/las') ? lasResponse : tabularResponse
    return Promise.resolve({ ok: true, json: async () => body })
  }))
}

async function advanceToPreview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await waitFor(() => {
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull()
  })
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

    await advanceToPreview(user)
    expect((screen.getByRole('combobox', { name: 'Target well' }) as HTMLSelectElement).value).toBe('well-b')
  })

  it('offers creating a well from the LAS preview name', async () => {
    const user = userEvent.setup()
    render(
      <ImportLasDialog
        wells={wells}
        activeWellId="well-b"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    )

    await advanceToPreview(user)
    expect(screen.getByRole('option', { name: /Create new well "Well B"/i })).toBeTruthy()
  })

  it('uses the file well name by default in the tops dialog when mapped', async () => {
    const user = userEvent.setup()
    render(
      <ImportTopsDialog
        wells={wells}
        activeWellId="well-b"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    )

    await advanceToPreview(user)
    await waitFor(() => {
      expect((screen.getByRole('combobox', { name: 'Target well' }) as HTMLSelectElement).value).toBe('__file__')
    })
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

    await advanceToPreview(user)
    expect((screen.getByLabelText('Target well') as HTMLSelectElement).value).toBe('well-b')
  })

  it('blocks the options step until a source path is present', async () => {
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
    await waitFor(() => {
      const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
      expect(fetchMock.mock.calls.some(([url]) => url === '/api/top-sets')).toBe(true)
    })
  })

  it('sends create TopSet selection by default for tops import', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    render(
      <ImportTopsDialog
        wells={wells}
        activeWellId="well-b"
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />,
    )

    await advanceToPreview(user)
    expect((screen.getByRole('option', { name: /Create new TopSet/i }) as HTMLOptionElement).selected).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Load tops' }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('well-b'))
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    const executeCall = fetchMock.mock.calls.find(([url]) => url === '/api/projects/import-tops')
    expect(executeCall).toBeTruthy()
    const body = JSON.parse(String(executeCall?.[1]?.body))
    expect(body.create_zone_set).toBe(true)
    expect(body.zone_set_id).toBeNull()
  })
})
