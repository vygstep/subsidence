import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DataManagerProvider } from '@/components/layout/dataManager/DataManagerContext'
import { TopSetSettings } from '@/components/layout/settings/TopSetSettings'
import { TemplatesTab } from '@/components/layout/TemplatesTab'
import { WellDataPanel } from '@/components/layout/WellDataPanel'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import type {
  CompactionPresetSummary,
  CurveMnemonicSetSummary,
  LithologyPatternPaletteSummary,
  LithologySetSummary,
  TopSetSummary,
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
    onToggleTopSetVisibility: vi.fn(),
    onToggleTopSetMarker: vi.fn(),
    onToggleTopSetZone: vi.fn(),
    onDeleteTopSet: vi.fn(),
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
    onDeleteTopSetMarker: vi.fn(),
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

beforeEach(() => {
  useWorkspaceStore.getState().resetWorkspace()
})

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
    expect(screen.queryByText('TOPS')).toBeNull()

    fireEvent.click(screen.getByText('Logs'))
    expect(props.onSelectLasGroup).toHaveBeenCalledWith('well-a')

    const logsRow = screen.getByText('Logs').closest('.tree-node__row')
    const logsExpand = logsRow?.querySelector('button[aria-label="Expand"]') as HTMLButtonElement
    fireEvent.click(logsExpand)
    fireEvent.click(screen.getByText('GR'))
    expect(props.onSelectCurve).toHaveBeenCalledWith('well-a', 'GR')
  })

  it('uses TopSet tri-state checkbox to toggle stratigraphy markers and zones', () => {
    const { props } = renderPanel({
      wells: [
        createWellInventory({
          well_id: 'well-a',
          well_name: 'Well A',
          active_top_set_id: 10,
          active_top_set_name: 'Regional',
          formations: [{ id: 'top-a', name: 'Top A', depth_md: 100, depth_tvd: null, depth_tvdss: null, horizon_id: 100, active_strat_color: '#aaaaaa', kind: 'strat' }],
        }),
      ],
      visibleFormationIdsByWellId: { 'well-a': [], 'well-b': [] },
    })

    const topSetRow = screen.getByText('Regional').closest('.tree-node__row')
    const checkbox = topSetRow?.querySelector('input[type="checkbox"]') as HTMLInputElement
    expect(checkbox).toBeTruthy()

    fireEvent.click(checkbox)
    expect(props.onToggleTopSetVisibility).toHaveBeenCalledWith(10, true)
  })

  it('routes active TopSets to per-well settings and inactive TopSets to generic settings', () => {
    const { props } = renderPanel({
      topSets: [
        { id: 10, name: 'Regional', description: null, horizon_count: 2 },
        {
          id: 20,
          name: 'Legacy',
          description: null,
          horizon_count: 2,
          horizons: [
            { id: 201, name: 'Legacy Top', kind: 'strat', age_ma: 5, color: '#123456', sort_order: 1, note: null },
            { id: 202, name: 'Legacy Base', kind: 'strat', age_ma: 15, color: '#654321', sort_order: 0, note: null },
          ],
        },
      ],
      wells: [
        createWellInventory({
          well_id: 'well-a',
          well_name: 'Well A',
          active_top_set_id: 10,
          active_top_set_name: 'Regional',
          formations: [
            { id: 'top-a', name: 'Top A', depth_md: 100, depth_tvd: null, depth_tvdss: null, horizon_id: 100, active_strat_color: '#aaaaaa', kind: 'strat' },
            { id: 'legacy-base-a', name: 'Legacy Base', depth_md: 220, depth_tvd: null, depth_tvdss: null, horizon_id: 202, active_strat_color: '#654321', color: '#654321', color_source: 'user', kind: 'strat' },
          ],
        }),
      ],
    })

    expect(screen.getByText('Regional')).toBeTruthy()
    expect(screen.getByText('Legacy')).toBeTruthy()

    fireEvent.click(screen.getByText('Regional'))
    expect(useWorkspaceStore.getState().selectedObject).toEqual({ type: 'zone-set', zoneSetId: 10, wellId: 'well-a' })

    const legacyRow = screen.getByText('Legacy').closest('.tree-node__row')!
    expect(legacyRow.textContent).toContain('inactive')
    const checkbox = legacyRow.querySelector('input[type="checkbox"]') as HTMLInputElement
    expect(checkbox.disabled).toBe(false)

    const legacyExpand = legacyRow.querySelector('button[aria-label="Expand"]') as HTMLButtonElement
    fireEvent.click(legacyExpand)
    expect(screen.getByText('Legacy Top')).toBeTruthy()
    expect(screen.getByText('Legacy Base')).toBeTruthy()
    const legacyMarkerLabels = Array.from(legacyRow.parentElement!.querySelectorAll('.tree-node__section-label'))
      .map((node) => node.textContent)
    expect(legacyMarkerLabels).toEqual(['Legacy', 'Legacy Base', 'Legacy Top'])
    expect(screen.queryByText('No markers loaded.')).toBeNull()
    const legacyBaseRow = screen.getByText('Legacy Base').closest('.tree-node__row')!
    const legacyBaseCheckbox = legacyBaseRow.querySelector('input[type="checkbox"]') as HTMLInputElement
    expect(legacyBaseCheckbox.disabled).toBe(false)
    fireEvent.click(legacyBaseCheckbox)
    expect(props.onToggleTopSetMarker).toHaveBeenCalledWith(20, 202, 'Legacy Base', true)

    fireEvent.click(screen.getByText('Legacy'))
    expect(useWorkspaceStore.getState().selectedObject).toEqual({ type: 'top-set', topSetId: 20 })
  })

  it('selects a TopSet marker as the active well top pick', () => {
    const { props } = renderPanel({
      wells: [
        createWellInventory({
          well_id: 'well-a',
          well_name: 'Well A',
          active_top_set_id: 10,
          active_top_set_name: 'Regional',
          formations: [{ id: 'top-a', name: 'Top A', depth_md: 100, depth_tvd: null, depth_tvdss: null, horizon_id: 100, active_strat_color: '#aaaaaa', kind: 'strat' }],
        }),
      ],
    })

    const topSetRow = screen.getByText('Regional').closest('.tree-node__row')
    const topSetExpand = topSetRow?.querySelector('button[aria-label="Expand"]') as HTMLButtonElement
    fireEvent.click(topSetExpand)

    fireEvent.click(screen.getByText('Top A'))
    expect(props.onSelectFormation).toHaveBeenCalledWith('well-a', 'top-a')
  })

  it('does not render inactive TopSet picks as active STRATIGRAPHY markers', () => {
    renderPanel({
      wells: [
        createWellInventory({
          well_id: 'well-a',
          well_name: 'Well A',
          active_top_set_id: 20,
          active_top_set_name: 'Second TopSet',
          formations: [
            { id: 'old-q', name: 'Quaternary', depth_md: 0, depth_tvd: null, depth_tvdss: null, horizon_id: 101, active_strat_color: '#111111', color: '#111111', color_source: 'user', kind: 'strat' },
            { id: 'old-n', name: 'Neogene', depth_md: 100, depth_tvd: null, depth_tvdss: null, horizon_id: 102, active_strat_color: '#222222', color: '#222222', color_source: 'user', kind: 'strat' },
            { id: 'new-q', name: 'Quaternary', depth_md: 0, depth_tvd: null, depth_tvdss: null, horizon_id: 201, active_strat_color: '#aaaaaa', color: '#aaaaaa', color_source: 'user', kind: 'strat' },
            { id: 'new-n', name: 'Neogene', depth_md: 120, depth_tvd: null, depth_tvdss: null, horizon_id: 202, active_strat_color: '#bbbbbb', color: '#bbbbbb', color_source: 'user', kind: 'strat' },
          ],
          zones: [{
            zone_id: 300,
            top_set_id: 20,
            upper_horizon: { id: 201, name: 'Quaternary', age_ma: 0 },
            lower_horizon: { id: 202, name: 'Neogene', age_ma: 23 },
            sort_order: 0,
            thickness_md: 120,
            thickness_tvd: 120,
            age_span_ma: 23,
            hiatus_ma: null,
            lithology_fractions: null,
            lithology_source: 'auto',
            water_depth_m: 0,
          }],
        }),
      ],
      visibleFormationIdsByWellId: { 'well-a': ['new-q', 'new-n'], 'well-b': [] },
    })

    const topSetRow = screen.getByText('Second TopSet').closest('.tree-node__row')
    const topSetExpand = topSetRow?.querySelector('button[aria-label="Expand"]') as HTMLButtonElement
    fireEvent.click(topSetExpand)

    expect(screen.getAllByText('Quaternary')).toHaveLength(1)
    expect(screen.getAllByText('Neogene')).toHaveLength(1)
  })

  it('exposes delete actions for wells and TopSet markers', () => {
    const { props } = renderPanel({
      wells: [
        createWellInventory({
          well_id: 'well-a',
          well_name: 'Well A',
          active_top_set_id: 10,
          active_top_set_name: 'Regional',
          formations: [{ id: 'top-a', name: 'Top A', depth_md: 100, depth_tvd: null, depth_tvdss: null, horizon_id: 100, active_strat_color: '#aaaaaa', kind: 'strat' }],
        }),
      ],
    })

    fireEvent.click(screen.getAllByLabelText('Expand')[0])
    fireEvent.click(screen.getByLabelText('Delete well "Well A"'))
    expect(props.onDeleteWell).toHaveBeenCalledWith('well-a', 'Well A')

    const topSetRow = screen.getByText('Regional').closest('.tree-node__row')
    const topSetExpand = topSetRow?.querySelector('button[aria-label="Expand"]') as HTMLButtonElement
    fireEvent.click(topSetExpand)
    fireEvent.click(screen.getByLabelText('Delete TopSet "Regional"'))
    expect(props.onDeleteTopSet).toHaveBeenCalledWith(10, 'Regional')

    fireEvent.click(screen.getByLabelText('Delete marker "Top A"'))
    expect(props.onDeleteTopSetMarker).toHaveBeenCalledWith(10, 100, 'Top A')
  })
})

describe('TopSet settings', () => {
  const topSet: TopSetSummary = { id: 20, name: 'Legacy', description: null, horizon_count: 2 }

  it('activates an inactive TopSet for the current well', () => {
    const onActivateTopSet = vi.fn()
    render(
      <TopSetSettings
        topSet={topSet}
        activeWellId="well-a"
        wellInventories={[
          createWellInventory({
            well_id: 'well-a',
            well_name: 'Well A',
            active_top_set_id: 10,
            active_top_set_name: 'Regional',
          }),
        ]}
        onActivateTopSet={onActivateTopSet}
      />,
    )

    expect(screen.getByText('inactive')).toBeTruthy()
    fireEvent.click(screen.getByText('Activate for current well'))
    expect(onActivateTopSet).toHaveBeenCalledWith(20, 'well-a')
  })
})
