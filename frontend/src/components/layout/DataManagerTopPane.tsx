import { StratChartTab } from './StratChartTab'
import { TemplatesTab } from './TemplatesTab'
import { WellDataPanel } from './WellDataPanel'
import type { SelectedObject } from '@/stores/workspaceStore'
import type {
  CompactionPresetSummary,
  CurveMnemonicSetSummary,
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
  onContextMenuLasGroup: (event: React.MouseEvent, wellId: string) => void
  onContextMenuStratChart: (event: React.MouseEvent, chart: StratChartInfo) => void
  onContextMenuTopSetMarker: (event: React.MouseEvent, target: { zoneSetId: number; wellId: string; horizonId: number; name: string }) => void
  onContextMenuTopSetZone: (event: React.MouseEvent, target: { zoneSetId: number; wellId: string; zoneId: number; name: string }) => void
  onContextMenuWell: (event: React.MouseEvent, well: WellInventory) => void
  onDeleteWell: (wellId: string, wellName: string) => void
  onDeleteStratChartById: (chartId: number, name: string, isBuiltin: boolean) => void
  onFocusCurveObject: (wellId: string, mnemonic: string) => void
  onFocusLasGroupObject: (wellId: string) => void
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
  onSelectWell: (wellId: string) => void
  onSelectWellsTab: () => void
  onToggleAllCurves: (wellId: string, nextValue: boolean) => void | Promise<void>
  onToggleAllFormations: (wellId: string, nextValue: boolean) => void | Promise<void>
  onToggleCurve: (wellId: string, mnemonic: string, nextValue: boolean) => void | Promise<void>
  onToggleDeviation: (wellId: string, nextValue: boolean) => void | Promise<void>
  selectedChartId: number | null
  selectedCompactionPresetId: number | null
  isCompactionPresetsRootSelected: boolean
  isCurveMnemonicsRootSelected: boolean
  isLithologiesRootSelected: boolean
  isPatternPalettesRootSelected: boolean
  isMeasurementUnitsRootSelected: boolean
  selectedMnemonicSetId: number | null
  selectedUnitDimensionCode: string | null
  selectedLithologySetId: number | null
  selectedLithologyPatternPaletteId: number | null
  selectedObject: SelectedObject | null
  stratCharts: StratChartInfo[]
  visibleCurveMnemonicsByWellId: Record<string, string[]>
  visibleFormationIdsByWellId: Record<string, string[]>
  hiddenTopSetZoneIdsByWellId: Record<string, number[]>
  wellInventories: WellInventory[]
  onSelectZoneSetsRoot: () => void
  onSelectZoneSet: (zoneSetId: number, wellId: string) => void
  onSelectZoneInSet: (zoneSetId: number, wellId: string, zoneId: number) => void
  onToggleTopSetVisibility: (zoneSetId: number, nextValue: boolean) => void
  onToggleTopSetMarker: (zoneSetId: number, horizonId: number | null, name: string, nextValue: boolean) => void
  onToggleTopSetZone: (zoneSetId: number, zoneId: number, nextValue: boolean) => void
  onDeleteTopSet: (zoneSetId: number, name: string) => void
  onDeleteTopSetMarker: (zoneSetId: number, horizonId: number, name: string) => void
  onDeleteCurve?: (wellId: string, mnemonic: string) => void
  onDeleteAllCurves?: (wellId: string, wellName: string, curveCount: number) => void
  onDeleteDeviation?: (wellId: string, wellName: string) => void
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
  onContextMenuLasGroup,
  onContextMenuStratChart,
  onContextMenuTopSetMarker,
  onContextMenuTopSetZone,
  onContextMenuWell,
  onDeleteWell,
  onDeleteStratChartById,
  onFocusCurveObject,
  onFocusLasGroupObject,
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
  onSelectWell,
  onSelectWellsTab,
  onToggleAllCurves,
  onToggleAllFormations,
  onToggleCurve,
  onToggleDeviation,
  selectedChartId,
  selectedCompactionPresetId,
  isCompactionPresetsRootSelected,
  isCurveMnemonicsRootSelected,
  isLithologiesRootSelected,
  isPatternPalettesRootSelected,
  isMeasurementUnitsRootSelected,
  selectedMnemonicSetId,
  selectedUnitDimensionCode,
  selectedLithologySetId,
  selectedLithologyPatternPaletteId,
  selectedObject,
  stratCharts,
  visibleCurveMnemonicsByWellId,
  visibleFormationIdsByWellId,
  hiddenTopSetZoneIdsByWellId,
  wellInventories,
  onSelectZoneSetsRoot,
  onSelectZoneSet,
  onSelectZoneInSet,
  onToggleTopSetVisibility,
  onToggleTopSetMarker,
  onToggleTopSetZone,
  onDeleteTopSet,
  onDeleteTopSetMarker,
  onDeleteCurve,
  onDeleteAllCurves,
  onDeleteDeviation,
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
          hiddenTopSetZoneIdsByWellId={hiddenTopSetZoneIdsByWellId}
          deviationVisibilityByWellId={deviationVisibilityByWellId}
          onSelectWell={onSelectWell}
          onToggleCurve={onToggleCurve}
          onToggleTopSetVisibility={onToggleTopSetVisibility}
          onToggleTopSetMarker={onToggleTopSetMarker}
          onToggleTopSetZone={onToggleTopSetZone}
          onDeleteTopSet={onDeleteTopSet}
          onDeleteTopSetMarker={onDeleteTopSetMarker}
          onToggleAllFormations={onToggleAllFormations}
          onToggleAllCurves={onToggleAllCurves}
          onToggleDeviation={onToggleDeviation}
          onFocusCurveObject={onFocusCurveObject}
          onFocusLasGroupObject={onFocusLasGroupObject}
          onFocusWellObject={onFocusWellObject}
          selectedObject={selectedObject}
          onSelectLasGroup={onSelectLasGroup}
          onSelectCurve={onSelectCurve}
          onSelectFormation={onSelectFormation}
          onContextMenuCurve={onContextMenuCurve}
          onContextMenuDeviation={onContextMenuDeviation}
          onContextMenuLasGroup={onContextMenuLasGroup}
          onContextMenuTopSetMarker={onContextMenuTopSetMarker}
          onContextMenuTopSetZone={onContextMenuTopSetZone}
          onContextMenuWell={onContextMenuWell}
          onDeleteWell={onDeleteWell}
          onDeleteCurve={onDeleteCurve}
          onDeleteAllCurves={onDeleteAllCurves}
          onDeleteDeviation={onDeleteDeviation}
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
