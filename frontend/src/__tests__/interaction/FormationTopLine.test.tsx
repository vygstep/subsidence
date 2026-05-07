import { fireEvent, render, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FormationTopLine } from '@/components/interaction/FormationTopLine'
import { useViewStore } from '@/stores/viewStore'
import { useWellDataStore } from '@/stores/wellDataStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { createMockFormationTop, createMockWell } from '../fixtures'

describe('FormationTopLine', () => {
  beforeEach(() => {
    useViewStore.setState({
      depthType: 'MD',
      formationsTrackConfig: {
        showMarkerLabels: true,
        markerLabelPosition: 'left',
      },
    })
    useWorkspaceStore.setState({
      selectedFormationId: null,
      selectedObject: null,
      wellViewStates: {},
    })
    useWellDataStore.setState({
      well: createMockWell({ well_id: 'well-a' }),
      removeFormation: vi.fn().mockResolvedValue(undefined),
    })
  })

  it('removes the active pick when Delete is pressed', async () => {
    const formation = createMockFormationTop({
      id: 'pick-a',
      name: 'Pick A',
      depth_md: 1200,
      horizon_id: 10,
    })

    function Harness() {
      const [activePickId, setActivePickId] = useState<string | null>(null)
      return (
        <svg>
          <FormationTopLine
            formation={formation}
            yPosition={50}
            editable
            isActivePick={activePickId === formation.id}
            onSetActivePick={setActivePickId}
          />
        </svg>
      )
    }

    const { container } = render(<Harness />)

    const hitLine = container.querySelector('line[stroke="transparent"]')
    expect(hitLine).not.toBeNull()
    fireEvent.click(hitLine!)
    fireEvent.keyDown(window, { key: 'Delete' })

    await waitFor(() => {
      expect(useWellDataStore.getState().removeFormation).toHaveBeenCalledWith('pick-a')
    })
    expect(useWorkspaceStore.getState().selectedFormationId).toBeNull()
    expect(useWorkspaceStore.getState().selectedObject).toEqual({ type: 'well', wellId: 'well-a' })
  })

  it('makes the dragged pick active before Delete can remove it', () => {
    const setActivePick = vi.fn()
    const formation = createMockFormationTop({
      id: 'dragged-pick',
      name: 'Dragged Pick',
      depth_md: 1400,
      horizon_id: 11,
    })

    const { container } = render(
      <svg>
        <FormationTopLine
          formation={formation}
          yPosition={60}
          editable
          isActivePick={false}
          onSetActivePick={setActivePick}
        />
      </svg>,
    )

    const group = container.querySelector('g')
    expect(group).not.toBeNull()
    Object.defineProperty(group!, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(),
    })
    fireEvent.pointerDown(group!, { pointerId: 1, clientY: 60 })

    expect(setActivePick).toHaveBeenCalledWith('dragged-pick')
    expect(useWorkspaceStore.getState().selectedFormationId).toBe('dragged-pick')
  })
})
