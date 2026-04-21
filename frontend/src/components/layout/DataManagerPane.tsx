import { DataManagerTopPane } from './DataManagerTopPane'
import { SettingsPaneShell } from './SettingsPaneShell'
import { useDataManagerController } from './useDataManagerController'

interface DataManagerPaneProps {
  sidebarRef: React.RefObject<HTMLElement | null>
  onInternalSplitterMouseDown: () => void
}

export function DataManagerPane({ sidebarRef, onInternalSplitterMouseDown }: DataManagerPaneProps) {
  const controller = useDataManagerController()

  return (
    <aside
      ref={sidebarRef as React.RefObject<HTMLElement>}
      className="app-sidebar"
      style={{ width: `${controller.sidebarWidth}px` }}
    >
      <div
        className="app-sidebar__zone"
        style={{ flex: `${controller.sidebarTopRatio} 1 0%`, minHeight: 0 }}
      >
        <DataManagerTopPane
          activeSidebarTab={controller.activeSidebarTab}
          activeWellId={controller.activeWellId}
          deviationVisibilityByWellId={controller.deviationVisibilityByWellId}
          onActivateChart={controller.onActivateChart}
          onDeleteChart={controller.onDeleteChart}
          onSelectChart={controller.onSelectChart}
          onSelectCurve={controller.handleSelectCurve}
          onSelectFormation={controller.handleSelectFormation}
          onSelectLasGroup={controller.handleSelectLasGroup}
          onSelectModelsTab={controller.onSelectModelsTab}
          onSelectStratChartsTab={controller.onSelectStratChartsTab}
          onSelectTopsGroup={controller.handleSelectTopsGroup}
          onSelectWell={controller.handleSelectWell}
          onSelectWellsTab={controller.onSelectWellsTab}
          onToggleAllCurves={controller.handleToggleAllCurves}
          onToggleAllFormations={controller.handleToggleAllFormations}
          onToggleCurve={controller.handleToggleCurve}
          onToggleDeviation={controller.handleSetDeviationVisible}
          onToggleFormation={controller.handleToggleFormation}
          selectedChartId={controller.selectedChartId}
          selectedFormationId={controller.selectedFormationId}
          selectedObject={controller.selectedObject}
          stratCharts={controller.stratCharts}
          visibleCurveMnemonicsByWellId={controller.visibleCurveMnemonicsByWellId}
          visibleFormationIdsByWellId={controller.visibleFormationIdsByWellId}
          wellInventories={controller.wellInventories}
        />
      </div>

      <div
        className="app-sidebar__splitter"
        onMouseDown={onInternalSplitterMouseDown}
      />

      <div
        className="app-sidebar__zone"
        style={{ flex: `${1 - controller.sidebarTopRatio} 1 0%`, minHeight: 0 }}
      >
        <SettingsPaneShell
          selectedObject={controller.selectedObject}
          well={controller.well}
          wellInspectorDraft={controller.wellInspectorDraft}
          onWellInspectorDraftChange={controller.handleWellInspectorDraftChange}
          onSaveWellInspector={controller.handleSaveWellInspector}
          selectedCurveConfig={controller.selectedCurveConfig}
          onCurveSettingUpdate={controller.handleCurveSettingUpdate}
          formations={controller.formations}
          visibleFormationIds={controller.visibleFormationIds}
          selectedFormation={controller.selectedFormation}
          onFormationUpdate={controller.setFormationUpdate}
          onFormationMove={controller.setFormationMove}
          selectedChart={controller.selectedChart}
          curveCount={controller.curveCount}
          visibleCurveCount={controller.visibleCurveCount}
          minDepth={controller.minDepth}
          maxDepth={controller.maxDepth}
        />
      </div>
    </aside>
  )
}
