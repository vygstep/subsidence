import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ImportDeviationDialog } from '@/components/layout/ImportDeviationDialog'
import { ImportLasDialog } from '@/components/layout/ImportLasDialog'
import { ImportTopsDialog } from '@/components/layout/ImportTopsDialog'
import { useProjectStore } from '@/stores/projectStore'

const wells = [
  { well_id: 'well-a', well_name: 'Well A' },
  { well_id: 'well-b', well_name: 'Well B' },
]

describe('Import dialogs target active well by default', () => {
  beforeEach(() => {
    useProjectStore.setState({ projectPath: 'D:\\projects\\test.subsidence' })
    window.localStorage.setItem('subsidence:last-import-root', 'D:\\data\\imports')
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

    await user.click(screen.getByRole('button', { name: 'Next' }))
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

    await user.click(screen.getByRole('button', { name: 'Next' }))
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

    await user.click(screen.getByRole('button', { name: 'Next' }))
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
