import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DataManagerProvider } from '@/components/layout/dataManager/DataManagerContext'
import { TemplatesTab } from '@/components/layout/TemplatesTab'
import { WellDataPanel } from '@/components/layout/WellDataPanel'
import type {
  CompactionPresetSummary,
  CurveMnemonicSetSummary,
  LithologyPatternPaletteSummary,
  LithologySetSummary,
  UnitDimensionSummary,
  WellInventory,
} from '@/types'

function createWellInventory(overrides: Partial<WellInventory>): WellInventory {
  return {
    well_id: 'well-a',
    well_name: 'Well A',
    color_hex: '#2563eb',
    kb_elev: 10,
    gl_elev: 0,
    td_md: 1000,
    x: 0,
    y: 0,
    crs: 'local',
    source_las_path: null,
    active_top_set_id: null,
    active_top_set_name: null,
    active_sea_level_curve_id: null,
    deviation: null,
    curves: [],
    formations: [],
    zones: [],
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
        formations: [{ id: 'top-a', name: 'Top A', depth_md: 100, depth_tvd: null, depth_tvdss: null, horizon_id: null, active_strat_color: '#aaaaaa', kind: 'strat' }],
        deviation: { reference: 'MD', mode: 'INCL_AZIM', fields: ['MD', 'Inclination', 'Azimuth'] },
      }),
      createWellInventory({
        well_id: 'well-b',
        well_name: 'Well B',
        curves: [{ mnemonic: 'RT', unit: 'ohm.m' }],
        formations: [{ id: 'top-b', name: 'Top B', depth_md: 200, depth_tvd: null, depth_tvdss: null, horizon_id: null, active_strat_color: null, kind: 'strat' }],
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
    onDeleteWell: vi.fn(),
    onDeleteAllFormations: vi.fn(),
    onDeleteFormation: vi.fn(),
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
const mnemonicSet: CurveMnemonicSetSummary = {
  id: 1, name: 'Default Mnemonics', is_builtin: true, entry_count: 12,
}
const lithologySet: LithologySetSummary = {
  id: 1, name: 'Default', is_builtin: true, entry_count: 5,
}
const patternPalette: LithologyPatternPaletteSummary = {
  id: 1,
  name: 'Equinor Lithology Patterns',
  origin: 'equinor',
  is_builtin: true,
  source_url: 'https://github.com/equinor/lithology-patterns',
  license_name: 'MIT',
  entry_count: 10,
}
const unitDimension: UnitDimensionSummary = {
  id: 1,
  code: 'density',
  display_name: 'Density',
  description: 'Density values',
  engine_unit_code: 'density_kg_m3',
  is_builtin: true,
  sort_order: 30,
  unit_count: 2,
  alias_count: 5,
}

function renderTemplatesTab(overrides: Partial<React.ComponentProps<typeof TemplatesTab>> = {}) {
  const props: React.ComponentProps<typeof TemplatesTab> = {
    compactionPresets: [builtinPreset, userPreset],
    mnemonicSets: [mnemonicSet],
    unitDimensions: [unitDimension],
    lithologySets: [lithologySet],
    lithologyPatternPalettes: [patternPalette],
    isCompactionPresetsRootSelected: false,
    isCurveMnemonicsRootSelected: false,
    isMeasurementUnitsRootSelected: false,
    isLithologiesRootSelected: false,
    isPatternPalettesRootSelected: false,
    selectedCompactionPresetId: null,
    selectedMnemonicSetId: null,
    selectedUnitDimensionCode: null,
    selectedLithologySetId: null,
    selectedLithologyPatternPaletteId: null,
    onCreateCompactionPresetDraft: vi.fn(),
    onCreateMnemonicSet: vi.fn(),
    onSelectCompactionPresetsRoot: vi.fn(),
    onSelectCompactionPreset: vi.fn(),
    onSelectCurveMnemonicsRoot: vi.fn(),
    onSelectMnemonicSet: vi.fn(),
    onSelectMeasurementUnitsRoot: vi.fn(),
    onSelectUnitDimension: vi.fn(),
    onSelectLithologiesRoot: vi.fn(),
    onSelectLithologySet: vi.fn(),
    onSelectPatternPalettesRoot: vi.fn(),
    onSelectLithologyPatternPalette: vi.fn(),
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
    expect(screen.queryByText('Default Mnemonics')).toBeNull()
    expect(screen.queryByText('Density')).toBeNull()
    expect(screen.queryByText('Default')).toBeNull()
    expect(screen.queryByText('Equinor Lithology Patterns')).toBeNull()
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
    fireEvent.click(expandButtons[4])

    expect(screen.getByText('Default')).toBeTruthy()
    fireEvent.click(screen.getByText('Default'))
    expect(props.onSelectLithologySet).toHaveBeenCalledWith(1)
  })

  it('expands pattern palettes and fires selection callback', () => {
    const { props } = renderTemplatesTab()

    const expandButtons = screen.getAllByLabelText('Expand')
    fireEvent.click(expandButtons[3])

    expect(screen.getByText('Equinor Lithology Patterns')).toBeTruthy()
    fireEvent.click(screen.getByText('Equinor Lithology Patterns'))
    expect(props.onSelectLithologyPatternPalette).toHaveBeenCalledWith(1)
  })

  it('expands measurement units and fires dimension selection callback', () => {
    const { props } = renderTemplatesTab()

    const expandButtons = screen.getAllByLabelText('Expand')
    fireEvent.click(expandButtons[2])

    expect(screen.getByText('Density')).toBeTruthy()
    fireEvent.click(screen.getByText('Density'))
    expect(props.onSelectUnitDimension).toHaveBeenCalledWith('density')
  })

  it('expands curve mnemonics and fires selection callback', () => {
    const { props } = renderTemplatesTab()

    const expandButtons = screen.getAllByLabelText('Expand')
    fireEvent.click(expandButtons[1])

    expect(screen.getByText('Default Mnemonics')).toBeTruthy()
    fireEvent.click(screen.getByText('Default Mnemonics'))
    expect(props.onSelectMnemonicSet).toHaveBeenCalledWith(1)
  })

  it('curve mnemonics exposes new set action', () => {
    const { props } = renderTemplatesTab()

    fireEvent.click(screen.getAllByLabelText('Expand')[1])
    fireEvent.click(screen.getByText('+ New set'))

    expect(props.onCreateMnemonicSet).toHaveBeenCalledOnce()
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
          mnemonicSets={[mnemonicSet]}
          unitDimensions={[unitDimension]}
          lithologySets={[lithologySet]}
          lithologyPatternPalettes={[patternPalette]}
          isCompactionPresetsRootSelected={false}
          isCurveMnemonicsRootSelected={false}
          isMeasurementUnitsRootSelected={false}
          isLithologiesRootSelected={false}
          isPatternPalettesRootSelected={false}
          selectedCompactionPresetId={2}
          selectedMnemonicSetId={null}
          selectedUnitDimensionCode={null}
          selectedLithologySetId={null}
          selectedLithologyPatternPaletteId={null}
          onCreateCompactionPresetDraft={vi.fn()}
          onCreateMnemonicSet={vi.fn()}
          onSelectCompactionPresetsRoot={vi.fn()}
          onSelectCompactionPreset={vi.fn()}
          onSelectCurveMnemonicsRoot={vi.fn()}
          onSelectMnemonicSet={vi.fn()}
          onSelectMeasurementUnitsRoot={vi.fn()}
          onSelectUnitDimension={vi.fn()}
          onSelectLithologiesRoot={vi.fn()}
          onSelectLithologySet={vi.fn()}
          onSelectPatternPalettesRoot={vi.fn()}
          onSelectLithologyPatternPalette={vi.fn()}
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

  it('exposes delete actions in the well tree', () => {
    const { props } = renderPanel()

    fireEvent.click(screen.getAllByLabelText('Expand')[0])
    fireEvent.click(screen.getByLabelText('Delete well "Well A"'))
    expect(props.onDeleteWell).toHaveBeenCalledWith('well-a', 'Well A')

    fireEvent.click(screen.getByLabelText('Delete all tops for "Well A"'))
    expect(props.onDeleteAllFormations).toHaveBeenCalledWith(
      'well-a',
      expect.arrayContaining([expect.objectContaining({ id: 'top-a' })]),
      'Well A',
    )

    const topsRow = screen.getByText('TOPS').closest('.tree-node__row')
    const topsExpand = topsRow?.querySelector('button[aria-label="Expand"]') as HTMLButtonElement
    fireEvent.click(topsExpand)
    fireEvent.click(screen.getByLabelText('Delete top "Top A"'))
    expect(props.onDeleteFormation).toHaveBeenCalledWith('well-a', 'top-a', 'Top A')
  })
})
