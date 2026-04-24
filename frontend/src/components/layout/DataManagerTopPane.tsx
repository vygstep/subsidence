import { StratChartTab } from './StratChartTab'
import { TemplatesTab } from './TemplatesTab'
import { WellDataPanel } from './WellDataPanel'
import type { SelectedObject } from '@/stores/workspaceStore'
import type {
  CompactionPresetSummary,
  CurveDictionaryEntry,
  FormationInventoryItem,
  LithologySetSummary,
  StratChartInfo,
  WellInventory,
} from '@/types'

interface DataManagerTopPaneProps {
  activeSidebarTab: 'wells' | 'templates' | 'strat-charts'
  activeWellId: string | null
  compactionPresets: CompactionPresetSummary[]
  curveDictionaryEntries: CurveDictionaryEntry[]
  deviationVisibilityByWellId: Record<string, boolean>
  lithologySets: LithologySetSummary[]
  onActivateChart: (chartId: number) => void
  onContextMenuCurve: (event: React.MouseEvent, wellId: string, curve: { mnemonic: string; unit: string }) => void
  onContextMenuDeviation: (event: React.MouseEvent, wellId: string) => void
  onContextMenuFormation: (event: React.MouseEvent, wellId: string, formation: FormationInventoryItem) => void
  onContextMenuLasGroup: (event: React.MouseEvent, wellId: string) => void
  onContextMenuStratChart: (event: React.MouseEvent, chart: StratChartInfo) => void
  onContextMenuTopsGroup: (event: React.MouseEvent, wellId: string) => void
  onContextMenuWell: (event: React.MouseEvent, well: WellInventory) => void
  onDeleteStratChartById: (chartId: number, name: string, isBuiltin: boolean) => void
  onFocusCurveObject: (wellId: string, mnemonic: string) => void
  onFocusFormationObject: (wellId: string, formationId: string) => void
  onFocusLasGroupObject: (wellId: string) => void
  onFocusTopsGroupObject: (wellId: string) => void
  onFocusWellObject: (wellId: string) => void
  onSelectChart: (chartId: number) => void
  onCreateCompactionPresetDraft: () => void
  onSelectCompactionPreset: (id: number) => void
  onSelectCompactionPresetsRoot: () => void
  onSelectCurveDictionaryEntry: (entryId: number) => void
  onSelectLithologiesRoot: () => void
  onSelectLithologySet: (setId: number) => void
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
  isLithologiesRootSelected: boolean
  selectedCurveDictionaryEntryId: number | null
  selectedFormationId: string | null
  selectedLithologySetId: number | null
  selectedObject: SelectedObject | null
  stratCharts: StratChartInfo[]
  visibleCurveMnemonicsByWellId: Record<string, string[]>
  visibleFormationIdsByWellId: Record<string, string[]>
  wellInventories: WellInventory[]
}

export function DataManagerTopPane({
  activeSidebarTab,
  activeWellId,
  compactionPresets,
  curveDictionaryEntries,
  deviationVisibilityByWellId,
  lithologySets,
  onActivateChart,
  onContextMenuCurve,
  onContextMenuDeviation,
  onContextMenuFormation,
  onContextMenuLasGroup,
  onContextMenuStratChart,
  onContextMenuTopsGroup,
  onContextMenuWell,
  onDeleteStratChartById,
  onFocusCurveObject,
  onFocusFormationObject,
  onFocusLasGroupObject,
  onFocusTopsGroupObject,
  onFocusWellObject,
  onSelectChart,
  onCreateCompactionPresetDraft,
  onSelectCompactionPreset,
  onSelectCompactionPresetsRoot,
  onSelectCurveDictionaryEntry,
  onSelectLithologiesRoot,
  onSelectLithologySet,
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
  isLithologiesRootSelected,
  selectedCurveDictionaryEntryId,
  selectedFormationId,
  selectedLithologySetId,
  selectedObject,
  stratCharts,
  visibleCurveMnemonicsByWellId,
  visibleFormationIdsByWellId,
  wellInventories,
}: DataManagerTopPaneProps) {
  return (
    <section className="sidebar-panel app-sidebar__zone">
      <header className="sidebar-tabs">
        <button
          type="button"
          className={`sidebar-tab ${activeSidebarTab === 'strat-charts' ? 'sidebar-tab--active' : ''}`}
          onClick={onSelectStratChartsTab}
        >
          StratCharts
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
        />
      ) : (
        <TemplatesTab
          curveDictionaryEntries={curveDictionaryEntries}
          lithologySets={lithologySets}
          compactionPresets={compactionPresets}
          isCompactionPresetsRootSelected={isCompactionPresetsRootSelected}
          isLithologiesRootSelected={isLithologiesRootSelected}
          selectedCompactionPresetId={selectedCompactionPresetId}
          selectedCurveDictionaryEntryId={selectedCurveDictionaryEntryId}
          selectedLithologySetId={selectedLithologySetId}
          onCreateCompactionPresetDraft={onCreateCompactionPresetDraft}
          onSelectCompactionPresetsRoot={onSelectCompactionPresetsRoot}
          onSelectCompactionPreset={onSelectCompactionPreset}
          onSelectCurveDictionaryEntry={onSelectCurveDictionaryEntry}
          onSelectLithologiesRoot={onSelectLithologiesRoot}
          onSelectLithologySet={onSelectLithologySet}
        />
      )}
    </section>
  )
}
