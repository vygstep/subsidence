import { fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { InteractionOverlay } from '@/components/interaction'
import { useViewStore } from '@/stores/viewStore'
import { useWellDataStore } from '@/stores/wellDataStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { createMockFormationTop, createMockWell } from '../fixtures'

describe('InteractionOverlay', () => {
  beforeEach(() => {
    useViewStore.setState({
      activePickId: null,
      depthType: 'MD',
      formationsTrackConfig: {
        backgroundColor: '#ffffff',
        nameSource: 'formation-name',
        showLabels: true,
        showMarkerLabels: true,
        markerLabelPosition: 'left',
        zoneLabelPosition: 'center',
      },
    })
    useWorkspaceStore.setState({
      selectedFormationId: null,
      selectedObject: null,
      wellViewStates: {},
    })
    useWellDataStore.setState({
      well: createMockWell({ well_id: 'well-a' }),
    })
  })

  it('keeps visible inactive markers read-only while active markers remain selectable', () => {
    const active = createMockFormationTop({
      id: 'active-pick',
      name: 'Active Pick',
      depth_md: 100,
      horizon_id: 10,
    })
    const inactive = createMockFormationTop({
      id: 'inactive-pick',
      name: 'Inactive Pick',
      depth_md: 200,
      horizon_id: 20,
    })

    const { container } = render(
      <InteractionOverlay
        width={200}
        height={300}
        formations={[active, inactive]}
        curves={[]}
        editableFormationIds={new Set(['active-pick'])}
        depthToPixel={(depth) => depth}
        cursorDepth={null}
        mouseClient={null}
        tooltipVisible={false}
        topsEditable
        wellTopDepth={0}
        wellBottomDepth={300}
      />,
    )

    const hitLines = container.querySelectorAll('line[stroke="transparent"]')
    expect(hitLines).toHaveLength(2)

    fireEvent.click(hitLines[1])
    expect(useViewStore.getState().activePickId).toBeNull()
    expect(useWorkspaceStore.getState().selectedFormationId).toBeNull()

    fireEvent.click(hitLines[0])
    expect(useViewStore.getState().activePickId).toBe('active-pick')
    expect(useWorkspaceStore.getState().selectedFormationId).toBe('active-pick')
  })
})
