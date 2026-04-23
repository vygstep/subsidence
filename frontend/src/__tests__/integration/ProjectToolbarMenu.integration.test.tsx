import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ProjectToolbar } from '@/components/layout/ProjectToolbar'
import { useProjectStore } from '@/stores/projectStore'
import { useViewStore } from '@/stores/viewStore'
import { useWellDataStore } from '@/stores/wellDataStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { createMockWell } from '../fixtures'

describe('ProjectToolbar menu', () => {
  beforeEach(() => {
    useProjectStore.setState({
      isOpen: true,
      projectName: 'Toolbar Project',
      projectPath: 'D:\\projects\\toolbar.subsidence',
      isDirty: false,
      canUndo: true,
      canRedo: true,
    })
    useWellDataStore.setState({
      well: createMockWell({ well_id: 'well-a', well_name: 'Well A' }),
      curves: [],
      formations: [],
      stratCharts: [],
      wellInventories: [],
      isLoading: false,
      error: null,
    })
    useWorkspaceStore.setState({ activeSidebarTab: 'wells', selectedFormationId: null })
    useViewStore.setState({ lodEnabled: true })
  })

  it('opens the project menu and exposes project actions', () => {
    render(<ProjectToolbar />)

    fireEvent.click(screen.getByText('Project'))

    expect(screen.getByText('New project')).toBeTruthy()
    expect(screen.getByText('Open project')).toBeTruthy()
    expect(screen.getByText('Close project')).toBeTruthy()
    expect(screen.getByText('Save project')).toBeTruthy()
    expect(screen.getByText('Create checkpoint')).toBeTruthy()
    expect(screen.getByText('Copy diagnostics')).toBeTruthy()
  })

  it('calls undo and redo actions from the top bar', () => {
    const undo = vi.fn()
    const redo = vi.fn()
    useProjectStore.setState({ undo, redo })
    render(<ProjectToolbar />)

    fireEvent.click(screen.getByText('Undo'))
    fireEvent.click(screen.getByText('Redo'))

    expect(undo).toHaveBeenCalledOnce()
    expect(redo).toHaveBeenCalledOnce()
  })
})
