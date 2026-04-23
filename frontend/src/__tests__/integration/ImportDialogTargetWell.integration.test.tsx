import { render, screen } from '@testing-library/react'
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
  })

  it('preselects the active well in the logs dialog', () => {
    render(
      <ImportLasDialog
        wells={wells}
        activeWellId="well-b"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    )

    expect((screen.getByLabelText('Target well') as HTMLSelectElement).value).toBe('well-b')
  })

  it('preselects the active well in the tops dialog', () => {
    render(
      <ImportTopsDialog
        wells={wells}
        activeWellId="well-b"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    )

    expect((screen.getByLabelText('Target well') as HTMLSelectElement).value).toBe('well-b')
  })

  it('preselects the active well in the deviation dialog', () => {
    render(
      <ImportDeviationDialog
        wells={wells}
        activeWellId="well-b"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    )

    expect((screen.getByLabelText('Target well') as HTMLSelectElement).value).toBe('well-b')
  })
})
