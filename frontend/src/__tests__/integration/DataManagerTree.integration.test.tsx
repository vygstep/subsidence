import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DataManagerProvider } from '@/components/layout/dataManager/DataManagerContext'
import { TemplatesTab } from '@/components/layout/TemplatesTab'
import { WellDataPanel } from '@/components/layout/WellDataPanel'
import type { CompactionPresetSummary, CurveDictionaryEntry, LithologySetSummary, WellInventory } from '@/types'

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
  return {
    props,
    ...render(
      <DataManagerProvider>
        <WellDataPanel {...props} />
      </DataManagerProvider>,
    ),
  }
}

const builtinPreset: CompactionPresetSummary = {
  id: 1, name: 'Shale', origin: 'builtin', is_builtin: true, source_lithology_code: 'sh',
}
const userPreset: CompactionPresetSummary = {
  id: 2, name: 'Custom', origin: 'user', is_builtin: false, source_lithology_code: null,
}
const curveEntry: CurveDictionaryEntry = {
  id: 1, scope: 'global', pattern: 'GR', is_regex: false, priority: 1,
  family_code: 'gamma_ray', canonical_mnemonic: 'GR', canonical_unit: 'API', is_active: true,
}
const lithologySet: LithologySetSummary = {
  id: 1, name: 'Default', is_builtin: true, entry_count: 5,
}

function renderTemplatesTab(overrides: Partial<React.ComponentProps<typeof TemplatesTab>> = {}) {
  const props: React.ComponentProps<typeof TemplatesTab> = {
    compactionPresets: [builtinPreset, userPreset],
    curveDictionaryEntries: [curveEntry],
    lithologySets: [lithologySet],
    isCompactionPresetsRootSelected: false,
    isLithologiesRootSelected: false,
    selectedCompactionPresetId: null,
    selectedCurveDictionaryEntryId: null,
    selectedLithologySetId: null,
    onCreateCompactionPresetDraft: vi.fn(),
    onSelectCompactionPresetsRoot: vi.fn(),
    onSelectCompactionPreset: vi.fn(),
    onSelectCurveDictionaryEntry: vi.fn(),
    onSelectLithologiesRoot: vi.fn(),
    onSelectLithologySet: vi.fn(),
    ...overrides,
  }
  return {
    props,
    ...render(
      <DataManagerProvider>
        <TemplatesTab {...props} />
      </DataManagerProvider>,
    ),
  }
}

describe('Data Manager templates tree', () => {
  it('keeps all template sections collapsed by default', () => {
    renderTemplatesTab()

    expect(screen.queryByText('Custom')).toBeNull()
    expect(screen.queryByText('GR')).toBeNull()
    expect(screen.queryByText('Default')).toBeNull()
  })

  it('expands compaction presets and fires selection callback', () => {
    const { props } = renderTemplatesTab()

    const expandButtons = screen.getAllByLabelText('Expand')
    fireEvent.click(expandButtons[0])

    expect(screen.getByText('Custom')).toBeTruthy()
    expect(screen.getByText('Shale')).toBeTruthy()

    fireEvent.click(screen.getByText('Custom'))
    expect(props.onSelectCompactionPreset).toHaveBeenCalledWith(2)
  })

  it('expands lithologies and fires selection callback', () => {
    const { props } = renderTemplatesTab()

    const expandButtons = screen.getAllByLabelText('Expand')
    fireEvent.click(expandButtons[2])

    expect(screen.getByText('Default')).toBeTruthy()
    fireEvent.click(screen.getByText('Default'))
    expect(props.onSelectLithologySet).toHaveBeenCalledWith(1)
  })

  it('expanding one section does not expand siblings', () => {
    renderTemplatesTab()

    fireEvent.click(screen.getAllByLabelText('Expand')[0])
    expect(screen.getByText('Custom')).toBeTruthy()
    expect(screen.queryByText('Default')).toBeNull()
  })

  it('builtin preset shows built-in meta label', () => {
    renderTemplatesTab()

    fireEvent.click(screen.getAllByLabelText('Expand')[0])
    expect(screen.getByText('built-in')).toBeTruthy()
    expect(screen.getByText('user')).toBeTruthy()
  })

  it('selected preset row carries tree-node__item-selected class', () => {
    const { rerender } = renderTemplatesTab()

    fireEvent.click(screen.getAllByLabelText('Expand')[0])
    expect(screen.getByText('Custom').closest('.tree-node__item-selected')).toBeNull()

    rerender(
      <DataManagerProvider>
        <TemplatesTab
          compactionPresets={[builtinPreset, userPreset]}
          curveDictionaryEntries={[curveEntry]}
          lithologySets={[lithologySet]}
          isCompactionPresetsRootSelected={false}
          isLithologiesRootSelected={false}
          selectedCompactionPresetId={2}
          selectedCurveDictionaryEntryId={null}
          selectedLithologySetId={null}
          onCreateCompactionPresetDraft={vi.fn()}
          onSelectCompactionPresetsRoot={vi.fn()}
          onSelectCompactionPreset={vi.fn()}
          onSelectCurveDictionaryEntry={vi.fn()}
          onSelectLithologiesRoot={vi.fn()}
          onSelectLithologySet={vi.fn()}
        />
      </DataManagerProvider>,
    )

    expect(screen.getByText('Custom').closest('.tree-node__item-selected')).toBeTruthy()
  })
})

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
