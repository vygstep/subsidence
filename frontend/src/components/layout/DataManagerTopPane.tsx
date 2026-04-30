import { StratChartTab } from './StratChartTab'
import { TemplatesTab } from './TemplatesTab'
import { WellDataPanel } from './WellDataPanel'
import type { SelectedObject } from '@/stores/workspaceStore'
import type {
  CompactionPresetSummary,
  CurveMnemonicSetSummary,
  FormationInventoryItem,
  LithologyPatternPaletteSummary,
  LithologySetSummary,
  StratChartInfo,
  UnitDimensionSummary,
  WellInventory,
} from '@/types'

interface DataManagerTopPaneProps {
  activeSidebarTab: 'wells' | 'templates' | 'strat-charts'
  activeWellId: string | null
  compactionPresets: CompactionPresetSummary[]
  mnemonicSets: CurveMnemonicSetSummary[]
  unitDimensions: UnitDimensionSummary[]
  deviationVisibilityByWellId: Record<string, boolean>
  lithologySets: LithologySetSummary[]
  lithologyPatternPalettes: LithologyPatternPaletteSummary[]
  onActivateChart: (chartId: number) => void
  onContextMenuCurve: (event: React.MouseEvent, wellId: string, curve: { mnemonic: string; unit: string }) => void
  onContextMenuDeviation: (event: React.MouseEvent, wellId: string) => void
  onContextMenuFormation: (event: React.MouseEvent, wellId: string, formation: FormationInventoryItem) => void
  onContextMenuLasGroup: (event: React.MouseEvent, wellId: string) => void
  onContextMenuStratChart: (event: React.MouseEvent, chart: StratChartInfo) => void
  onContextMenuTopsGroup: (event: React.MouseEvent, wellId: string) => void
  onContextMenuWell: (event: React.MouseEvent, well: WellInventory) => void
  onDeleteWell: (wellId: string, wellName: string) => void
  onDeleteAllFormations: (wellId: string, formations: FormationInventoryItem[], wellName: string) => void
  onDeleteFormation: (wellId: string, formationId: string, formationName: string) => void
  onDeleteStratChartById: (chartId: number, name: string, isBuiltin: boolean) => void
  onFocusCurveObject: (wellId: string, mnemonic: string) => void
  onFocusFormationObject: (wellId: string, formationId: string) => void
  onFocusLasGroupObject: (wellId: string) => void
  onFocusTopsGroupObject: (wellId: string) => void
  onFocusWellObject: (wellId: string) => void
  onSelectChart: (chartId: number) => void
  onCreateCompactionPresetDraft: () => void
  onCreateMnemonicSet: () => void
  onSelectCompactionPreset: (id: number) => void
  onSelectCompactionPresetsRoot: () => void
  onSelectCurveMnemonicsRoot: () => void
  onSelectMnemonicSet: (setId: number) => void
  onSelectMeasurementUnitsRoot: () => void
  onSelectUnitDimension: (dimensionCode: string) => void
  onSelectLithologiesRoot: () => void
  onSelectLithologySet: (setId: number) => void
  onSelectPatternPalettesRoot: () => void
  onSelectLithologyPatternPalette: (paletteId: number) => void
  onSelectCurve: (wellId: string, mnemonic: string) => void | Promise<void>
  onSelectFormation: (wellId: string, formationId: string) => void | Promise<void>
  onSelectLasGroup: (wellId: string) => void | Promise<void>
  onSelectTemplatesTab: () => void
  onSelectStratChartsTab: () => void
  onSelectTopsGroup: (wellId: string) => void | Promise<void>
  onSelectWell: (wellId: string) => void
  onSelectWellsTab: () => void
  onToggleAllCurves: (wellId: string, nextValue: boolean) => void | Promise<void>
  onToggleAllFormations: (wellId: string, nextValue: boolean) => void | Promise<void>
  onToggleCurve: (wellId: string, mnemonic: string, nextValue: boolean) => void | Promise<void>
  onToggleDeviation: (wellId: string, nextValue: boolean) => void | Promise<void>
  onToggleFormation: (wellId: string, formationId: string, nextValue: boolean) => void | Promise<void>
  selectedChartId: number | null
  selectedCompactionPresetId: number | null
  isCompactionPresetsRootSelected: boolean
  isCurveMnemonicsRootSelected: boolean
  isLithologiesRootSelected: boolean
  isPatternPalettesRootSelected: boolean
  isMeasurementUnitsRootSelected: boolean
  selectedMnemonicSetId: number | null
  selectedUnitDimensionCode: string | null
  selectedFormationId: string | null
  selectedLithologySetId: number | null
  selectedLithologyPatternPaletteId: number | null
  selectedObject: SelectedObject | null
  stratCharts: StratChartInfo[]
  visibleCurveMnemonicsByWellId: Record<string, string[]>
  visibleFormationIdsByWellId: Record<string, string[]>
  wellInventories: WellInventory[]
  onSelectZoneSetsRoot: () => void
  onSelectZoneSet: (zoneSetId: number, wellId: string) => void
  onSelectZoneInSet: (zoneSetId: number, wellId: string, zoneId: number) => void
  selectedZoneId: number | null
  selectedZoneSetId: number | null
}

export function DataManagerTopPane({
  activeSidebarTab,
  activeWellId,
  compactionPresets,
  mnemonicSets,
  unitDimensions,
  deviationVisibilityByWellId,
  lithologySets,
  lithologyPatternPalettes,
  onActivateChart,
  onContextMenuCurve,
  onContextMenuDeviation,
  onContextMenuFormation,
  onContextMenuLasGroup,
  onContextMenuStratChart,
  onContextMenuTopsGroup,
  onContextMenuWell,
  onDeleteWell,
  onDeleteAllFormations,
  onDeleteFormation,
  onDeleteStratChartById,
  onFocusCurveObject,
  onFocusFormationObject,
  onFocusLasGroupObject,
  onFocusTopsGroupObject,
  onFocusWellObject,
  onSelectChart,
  onCreateCompactionPresetDraft,
  onCreateMnemonicSet,
  onSelectCompactionPreset,
  onSelectCompactionPresetsRoot,
  onSelectCurveMnemonicsRoot,
  onSelectMnemonicSet,
  onSelectMeasurementUnitsRoot,
  onSelectUnitDimension,
  onSelectLithologiesRoot,
  onSelectLithologySet,
  onSelectPatternPalettesRoot,
  onSelectLithologyPatternPalette,
  onSelectCurve,
  onSelectFormation,
  onSelectLasGroup,
  onSelectTemplatesTab,
  onSelectStratChartsTab,
  onSelectTopsGroup,
  onSelectWell,
  onSelectWellsTab,
  onToggleAllCurves,
  onToggleAllFormations,
  onToggleCurve,
  onToggleDeviation,
  onToggleFormation,
  selectedChartId,
  selectedCompactionPresetId,
  isCompactionPresetsRootSelected,
  isCurveMnemonicsRootSelected,
  isLithologiesRootSelected,
  isPatternPalettesRootSelected,
  isMeasurementUnitsRootSelected,
  selectedMnemonicSetId,
  selectedUnitDimensionCode,
  selectedFormationId,
  selectedLithologySetId,
  selectedLithologyPatternPaletteId,
  selectedObject,
  stratCharts,
  visibleCurveMnemonicsByWellId,
  visibleFormationIdsByWellId,
  wellInventories,
  onSelectZoneSetsRoot,
  onSelectZoneSet,
  onSelectZoneInSet,
  selectedZoneId,
  selectedZoneSetId,
}: DataManagerTopPaneProps) {
  return (
    <section className="sidebar-panel app-sidebar__zone">
      <header className="sidebar-tabs">
        <button
          type="button"
          className={`sidebar-tab ${activeSidebarTab === 'strat-charts' ? 'sidebar-tab--active' : ''}`}
          onClick={onSelectStratChartsTab}
        >
          Charts
        </button>
        <button
          type="button"
          className={`sidebar-tab ${activeSidebarTab === 'wells' ? 'sidebar-tab--active' : ''}`}
          onClick={onSelectWellsTab}
        >
          Wells
        </button>
        <button
          type="button"
          className={`sidebar-tab ${activeSidebarTab === 'templates' ? 'sidebar-tab--active' : ''}`}
          onClick={onSelectTemplatesTab}
        >
          Templates
        </button>
      </header>

      {activeSidebarTab === 'strat-charts' ? (
        <StratChartTab
          charts={stratCharts}
          onActivate={onActivateChart}
          onDeleteById={onDeleteStratChartById}
          onContextMenu={onContextMenuStratChart}
          selectedChartId={selectedChartId}
          onSelect={onSelectChart}
        />
      ) : activeSidebarTab === 'wells' ? (
        <WellDataPanel
          wells={wellInventories}
          activeWellId={activeWellId}
          visibleCurveMnemonicsByWellId={visibleCurveMnemonicsByWellId}
          visibleFormationIdsByWellId={visibleFormationIdsByWellId}
          deviationVisibilityByWellId={deviationVisibilityByWellId}
          selectedFormationId={selectedFormationId}
          onSelectWell={onSelectWell}
          onToggleCurve={onToggleCurve}
          onToggleFormation={onToggleFormation}
          onToggleAllFormations={onToggleAllFormations}
          onToggleAllCurves={onToggleAllCurves}
          onToggleDeviation={onToggleDeviation}
          onFocusCurveObject={onFocusCurveObject}
          onSelectFormation={onSelectFormation}
          onFocusFormationObject={onFocusFormationObject}
          onFocusLasGroupObject={onFocusLasGroupObject}
          onFocusTopsGroupObject={onFocusTopsGroupObject}
          onFocusWellObject={onFocusWellObject}
          selectedObject={selectedObject}
          onSelectLasGroup={onSelectLasGroup}
          onSelectCurve={onSelectCurve}
          onSelectTopsGroup={onSelectTopsGroup}
          onContextMenuCurve={onContextMenuCurve}
          onContextMenuDeviation={onContextMenuDeviation}
          onContextMenuFormation={onContextMenuFormation}
          onContextMenuLasGroup={onContextMenuLasGroup}
          onContextMenuTopsGroup={onContextMenuTopsGroup}
          onContextMenuWell={onContextMenuWell}
          onDeleteWell={onDeleteWell}
          onDeleteAllFormations={onDeleteAllFormations}
          onDeleteFormation={onDeleteFormation}
          onSelectZoneSetsRoot={onSelectZoneSetsRoot}
          onSelectZoneSet={onSelectZoneSet}
          onSelectZoneInSet={onSelectZoneInSet}
          selectedZoneId={selectedZoneId}
          selectedZoneSetId={selectedZoneSetId}
        />
      ) : (
        <TemplatesTab
          mnemonicSets={mnemonicSets}
          unitDimensions={unitDimensions}
          lithologySets={lithologySets}
          lithologyPatternPalettes={lithologyPatternPalettes}
          compactionPresets={compactionPresets}
          isCompactionPresetsRootSelected={isCompactionPresetsRootSelected}
          isCurveMnemonicsRootSelected={isCurveMnemonicsRootSelected}
          isMeasurementUnitsRootSelected={isMeasurementUnitsRootSelected}
          isLithologiesRootSelected={isLithologiesRootSelected}
          isPatternPalettesRootSelected={isPatternPalettesRootSelected}
          selectedCompactionPresetId={selectedCompactionPresetId}
          selectedMnemonicSetId={selectedMnemonicSetId}
          selectedUnitDimensionCode={selectedUnitDimensionCode}
          selectedLithologySetId={selectedLithologySetId}
          selectedLithologyPatternPaletteId={selectedLithologyPatternPaletteId}
          onCreateCompactionPresetDraft={onCreateCompactionPresetDraft}
          onCreateMnemonicSet={onCreateMnemonicSet}
          onSelectCompactionPresetsRoot={onSelectCompactionPresetsRoot}
          onSelectCompactionPreset={onSelectCompactionPreset}
          onSelectCurveMnemonicsRoot={onSelectCurveMnemonicsRoot}
          onSelectMnemonicSet={onSelectMnemonicSet}
          onSelectMeasurementUnitsRoot={onSelectMeasurementUnitsRoot}
          onSelectUnitDimension={onSelectUnitDimension}
          onSelectLithologiesRoot={onSelectLithologiesRoot}
          onSelectLithologySet={onSelectLithologySet}
          onSelectPatternPalettesRoot={onSelectPatternPalettesRoot}
          onSelectLithologyPatternPalette={onSelectLithologyPatternPalette}
        />
      )}
    </section>
  )
}
