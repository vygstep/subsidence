import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { WellDataPanel } from '@/components/layout/WellDataPanel'
import type { WellInventory } from '@/types'

function createWellInventory(overrides: Partial<WellInventory>): WellInventory {
  return {
    well_id: 'well-a',
    well_name: 'Well A',
    kb_elev: 10,
    gl_elev: 0,
    td_md: 1000,
    x: 0,
    y: 0,
    crs: 'local',
    source_las_path: null,
    deviation: null,
    curves: [],
    formations: [],
    ...overrides,
  }
}

function renderPanel(overrides: Partial<React.ComponentProps<typeof WellDataPanel>> = {}) {
  const props: React.ComponentProps<typeof WellDataPanel> = {
    wells: [
      createWellInventory({
        well_id: 'well-a',
        well_name: 'Well A',
        curves: [{ mnemonic: 'GR', unit: 'API' }],
        formations: [{ id: 'top-a', name: 'Top A', depth_md: 100, active_strat_color: '#aaaaaa' }],
        deviation: { reference: 'MD', mode: 'INCL_AZIM', fields: ['MD', 'Inclination', 'Azimuth'] },
      }),
      createWellInventory({
        well_id: 'well-b',
        well_name: 'Well B',
        curves: [{ mnemonic: 'RT', unit: 'ohm.m' }],
        formations: [{ id: 'top-b', name: 'Top B', depth_md: 200, active_strat_color: null }],
      }),
    ],
    activeWellId: 'well-a',
    visibleCurveMnemonicsByWellId: { 'well-a': ['GR'], 'well-b': [] },
    visibleFormationIdsByWellId: { 'well-a': ['top-a'], 'well-b': [] },
    deviationVisibilityByWellId: { 'well-a': true },
    selectedFormationId: null,
    onSelectWell: vi.fn(),
    onToggleCurve: vi.fn(),
    onToggleFormation: vi.fn(),
    onToggleAllFormations: vi.fn(),
    onToggleAllCurves: vi.fn(),
    onToggleDeviation: vi.fn(),
    onFocusCurveObject: vi.fn(),
    onFocusFormationObject: vi.fn(),
    onFocusLasGroupObject: vi.fn(),
    onFocusTopsGroupObject: vi.fn(),
    onFocusWellObject: vi.fn(),
    onSelectFormation: vi.fn(),
    selectedObject: null,
    onSelectLasGroup: vi.fn(),
    onSelectCurve: vi.fn(),
    onSelectTopsGroup: vi.fn(),
    onContextMenuCurve: vi.fn(),
    onContextMenuDeviation: vi.fn(),
    onContextMenuFormation: vi.fn(),
    onContextMenuLasGroup: vi.fn(),
    onContextMenuTopsGroup: vi.fn(),
    onContextMenuWell: vi.fn(),
    ...overrides,
  }
  return { props, ...render(<WellDataPanel {...props} />) }
}

describe('Data Manager well tree', () => {
  it('shows all wells and keeps nodes collapsed by default', () => {
    renderPanel()

    expect(screen.getByText('Well A')).toBeTruthy()
    expect(screen.getByText('Well B')).toBeTruthy()
    expect(screen.queryByText('Logs')).toBeNull()
    expect(screen.queryByText('TOPS')).toBeNull()
  })

  it('expands a well and selects nested objects', () => {
    const { props } = renderPanel()

    fireEvent.click(screen.getAllByLabelText('Expand')[0])
    expect(screen.getByText('Logs')).toBeTruthy()
    expect(screen.getByText('TOPS')).toBeTruthy()

    fireEvent.click(screen.getByText('Logs'))
    expect(props.onSelectLasGroup).toHaveBeenCalledWith('well-a')

    const logsRow = screen.getByText('Logs').closest('.tree-node__row')
    const logsExpand = logsRow?.querySelector('button[aria-label="Expand"]') as HTMLButtonElement
    fireEvent.click(logsExpand)
    fireEvent.click(screen.getByText('GR'))
    expect(props.onSelectCurve).toHaveBeenCalledWith('well-a', 'GR')

    const topsRow = screen.getByText('TOPS').closest('.tree-node__row')
    const topsExpand = topsRow?.querySelector('button[aria-label="Expand"]') as HTMLButtonElement
    fireEvent.click(topsExpand)
    fireEvent.click(screen.getByText('Top A'))
    expect(props.onSelectFormation).toHaveBeenCalledWith('well-a', 'top-a')
  })

  it('uses TOPS tri-state checkbox to toggle all tops', () => {
    const { props } = renderPanel({
      visibleFormationIdsByWellId: { 'well-a': [], 'well-b': [] },
    })

    fireEvent.click(screen.getAllByLabelText('Expand')[0])
    const topsRow = screen.getByText('TOPS').closest('.tree-node__row')
    const checkbox = topsRow?.querySelector('input[type="checkbox"]') as HTMLInputElement
    expect(checkbox).toBeTruthy()

    fireEvent.click(checkbox)
    expect(props.onToggleAllFormations).toHaveBeenCalledWith('well-a', true)
  })
})
