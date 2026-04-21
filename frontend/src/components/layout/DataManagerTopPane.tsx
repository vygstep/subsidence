import { CompactionModelsTab } from './CompactionModelsTab'
import { StratChartTab } from './StratChartTab'
import { WellDataPanel } from './WellDataPanel'
import type { SelectedObject } from '@/stores/workspaceStore'
import type { CompactionModel, StratChartInfo, WellInventory } from '@/types'

interface DataManagerTopPaneProps {
  activeSidebarTab: 'wells' | 'models' | 'strat-charts'
  activeWellId: string | null
  compactionModels: CompactionModel[]
  deviationVisibilityByWellId: Record<string, boolean>
  onActivateChart: (chartId: number) => void
  onActivateCompactionModel: (id: number) => void
  onCreateCompactionModel: () => void
  onDeleteChart: (chartId: number) => void
  onDeleteCompactionModel: (id: number) => void
  onSelectChart: (chartId: number) => void
  onSelectCompactionModel: (id: number) => void
  onSelectCurve: (wellId: string, mnemonic: string) => void | Promise<void>
  onSelectFormation: (wellId: string, formationId: string) => void | Promise<void>
  onSelectLasGroup: (wellId: string) => void | Promise<void>
  onSelectModelsTab: () => void
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
  selectedCompactionModelId: number | null
  selectedFormationId: string | null
  selectedObject: SelectedObject | null
  stratCharts: StratChartInfo[]
  visibleCurveMnemonicsByWellId: Record<string, string[]>
  visibleFormationIdsByWellId: Record<string, string[]>
  wellInventories: WellInventory[]
}

export function DataManagerTopPane({
  activeSidebarTab,
  activeWellId,
  compactionModels,
  deviationVisibilityByWellId,
  onActivateChart,
  onActivateCompactionModel,
  onCreateCompactionModel,
  onDeleteChart,
  onDeleteCompactionModel,
  onSelectChart,
  onSelectCompactionModel,
  onSelectCurve,
  onSelectFormation,
  onSelectLasGroup,
  onSelectModelsTab,
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
  selectedCompactionModelId,
  selectedFormationId,
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
          className={`sidebar-tab ${activeSidebarTab === 'models' ? 'sidebar-tab--active' : ''}`}
          onClick={onSelectModelsTab}
        >
          Models
        </button>
      </header>

      {activeSidebarTab === 'strat-charts' ? (
        <StratChartTab
          charts={stratCharts}
          onActivate={onActivateChart}
          onDelete={onDeleteChart}
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
          onSelectFormation={onSelectFormation}
          selectedObject={selectedObject}
          onSelectLasGroup={onSelectLasGroup}
          onSelectCurve={onSelectCurve}
          onSelectTopsGroup={onSelectTopsGroup}
        />
      ) : (
        <CompactionModelsTab
          models={compactionModels}
          selectedModelId={selectedCompactionModelId}
          onSelect={onSelectCompactionModel}
          onActivate={onActivateCompactionModel}
          onDelete={onDeleteCompactionModel}
          onCreate={onCreateCompactionModel}
        />
      )}
    </section>
  )
}
