import { useEffect, useState } from 'react'

import { DataManagerProvider } from './dataManager/DataManagerContext'
import { DataManagerTopPane } from './DataManagerTopPane'
import { SettingsPaneShell } from './SettingsPaneShell'
import { useDataManagerController } from './useDataManagerController'

interface DataManagerPaneProps {
  sidebarRef: React.RefObject<HTMLElement | null>
  onInternalSplitterMouseDown: () => void
}

type ContextMenuTarget =
  | { type: 'well'; wellId: string; name: string }
  | { type: 'las-group'; wellId: string }
  | { type: 'curve'; wellId: string; mnemonic: string; unit: string }
  | { type: 'tops-group'; wellId: string }
  | { type: 'top-pick'; wellId: string; formationId: string; name: string; depth_md: number | null; active_strat_color: string | null }
  | { type: 'deviation-group'; wellId: string }
  | { type: 'strat-chart'; chartId: number; name: string; isBuiltin: boolean }
  | { type: 'compaction-model'; modelId: number; name: string; isBuiltin: boolean; isActive: boolean }

interface ContextMenuState {
  x: number
  y: number
  target: ContextMenuTarget
}

export function DataManagerPane({ sidebarRef, onInternalSplitterMouseDown }: DataManagerPaneProps) {
  const controller = useDataManagerController()
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'F2') return

      const target = event.target as HTMLElement | null
      const tagName = target?.tagName
      if (
        target?.isContentEditable
        || tagName === 'INPUT'
        || tagName === 'TEXTAREA'
        || tagName === 'SELECT'
      ) {
        return
      }

      event.preventDefault()
      controller.onRenameSelectedObject()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [controller])

  useEffect(() => {
    if (!contextMenu) return

    const close = () => setContextMenu(null)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
      }
    }

    window.addEventListener('mousedown', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [contextMenu])

  function openContextMenu(event: React.MouseEvent, target: ContextMenuTarget) {
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      target,
    })
  }

  const contextMenuItems = (() => {
    if (!contextMenu) return []

    const close = () => setContextMenu(null)
    switch (contextMenu.target.type) {
      case 'well': {
        const target = contextMenu.target
        return [
          { label: 'Duplicate', disabled: true, onClick: close },
          {
            label: 'Delete',
            disabled: false,
            onClick: () => {
              close()
              controller.onDeleteWellById(target.wellId, target.name)
            },
          },
          {
            label: 'Rename',
            disabled: false,
            onClick: () => {
              close()
              controller.onRenameWellById(target.wellId, target.name)
            },
          },
        ]
      }
      case 'las-group':
      case 'curve':
      case 'tops-group':
      case 'deviation-group':
        return [
          { label: 'Duplicate', disabled: true, onClick: close },
          { label: 'Delete', disabled: true, onClick: close },
          { label: 'Rename', disabled: true, onClick: close },
        ]
      case 'top-pick': {
        const target = contextMenu.target
        return [
          {
            label: 'Duplicate',
            disabled: false,
            onClick: () => {
              close()
              controller.onDuplicateFormation(target.wellId, target)
            },
          },
          {
            label: 'Delete',
            disabled: false,
            onClick: () => {
              close()
              controller.onDeleteFormation(target.wellId, target.formationId, target.name)
            },
          },
          {
            label: 'Rename',
            disabled: false,
            onClick: () => {
              close()
              controller.onRenameFormation(target.wellId, target.formationId, target.name)
            },
          },
        ]
      }
      case 'strat-chart': {
        const target = contextMenu.target
        return [
          { label: 'Duplicate', disabled: true, onClick: close },
          {
            label: 'Delete',
            disabled: target.isBuiltin,
            onClick: () => {
              close()
              controller.onDeleteStratChartById(target.chartId, target.name, target.isBuiltin)
            },
          },
          { label: 'Rename', disabled: true, onClick: close },
        ]
      }
      case 'compaction-model': {
        const target = contextMenu.target
        return [
          {
            label: 'Duplicate',
            disabled: false,
            onClick: () => {
              close()
              controller.onDuplicateCompactionModel(target.modelId, target.name)
            },
          },
          {
            label: 'Delete',
            disabled: target.isBuiltin || target.isActive,
            onClick: () => {
              close()
              controller.onDeleteCompactionModelById(
                target.modelId,
                target.name,
                target.isBuiltin,
                target.isActive,
              )
            },
          },
          {
            label: 'Rename',
            disabled: false,
            onClick: () => {
              close()
              controller.onSelectCompactionModel(target.modelId)
              controller.onRenameSelectedObject()
            },
          },
        ]
      }
    }
  })()

  return (
    <DataManagerProvider>
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
          compactionPresets={controller.compactionPresets}
          mnemonicSets={controller.mnemonicSets}
          unitDimensions={controller.unitDimensions}
          deviationVisibilityByWellId={controller.deviationVisibilityByWellId}
          lithologySets={controller.lithologySets}
          onActivateChart={controller.onActivateChart}
          onContextMenuCurve={(event, wellId, curve) => openContextMenu(event, {
            type: 'curve',
            wellId,
            mnemonic: curve.mnemonic,
            unit: curve.unit,
          })}
          onContextMenuDeviation={(event, wellId) => openContextMenu(event, {
            type: 'deviation-group',
            wellId,
          })}
          onContextMenuLasGroup={(event, wellId) => openContextMenu(event, {
            type: 'las-group',
            wellId,
          })}
          onContextMenuStratChart={(event, chart) => openContextMenu(event, {
            type: 'strat-chart',
            chartId: chart.id,
            name: chart.name,
            isBuiltin: chart.is_builtin,
          })}
          onContextMenuWell={(event, wellInventory) => openContextMenu(event, {
            type: 'well',
            wellId: wellInventory.well_id,
            name: wellInventory.well_name,
          })}
          onDeleteWell={controller.onDeleteWellById}
          onDeleteStratChartById={controller.onDeleteStratChartById}
          onFocusCurveObject={controller.handleFocusCurveObject}
          onSelectChart={controller.onSelectChart}
          onCreateCompactionPresetDraft={controller.onCreateCompactionPresetDraft}
          onCreateMnemonicSet={controller.onCreateMnemonicSet}
          onSelectCompactionPreset={controller.onSelectCompactionPreset}
          onSelectCompactionPresetsRoot={controller.onSelectCompactionPresetsRoot}
          onSelectCurveMnemonicsRoot={controller.onSelectCurveMnemonicsRoot}
          onSelectMnemonicSet={controller.onSelectMnemonicSet}
          onSelectMeasurementUnitsRoot={controller.onSelectMeasurementUnitsRoot}
          onSelectUnitDimension={controller.onSelectUnitDimension}
          onSelectLithologiesRoot={controller.onSelectLithologiesRoot}
          onSelectLithologySet={controller.onSelectLithologySet}
          onSelectPatternPalettesRoot={controller.onSelectPatternPalettesRoot}
          onSelectLithologyPatternPalette={controller.onSelectLithologyPatternPalette}
          onSelectCurve={controller.handleSelectCurve}
          onSelectFormation={controller.handleSelectFormation}
          onFocusLasGroupObject={controller.handleFocusLasGroupObject}
          onFocusWellObject={controller.handleFocusWellObject}
          onSelectLasGroup={controller.handleSelectLasGroup}
          onSelectTemplatesTab={controller.onSelectTemplatesTab}
          onSelectStratChartsTab={controller.onSelectStratChartsTab}
          onSelectWell={controller.handleSelectWell}
          onSelectWellsTab={controller.onSelectWellsTab}
          onToggleAllCurves={controller.handleToggleAllCurves}
          onToggleAllFormations={controller.handleToggleAllFormations}
          onToggleCurve={controller.handleToggleCurve}
          onToggleDeviation={controller.handleSetDeviationVisible}
          onToggleTopSetVisibility={controller.handleToggleTopSetVisibility}
          onToggleTopSetMarker={controller.handleToggleTopSetMarker}
          onToggleTopSetZone={controller.handleToggleTopSetZone}
          onDeleteTopSet={controller.handleDeleteTopSet}
          onDeleteTopSetMarker={controller.handleDeleteTopSetMarker}
          selectedChartId={controller.selectedChartId}
          selectedCompactionPresetId={controller.selectedCompactionPresetId}
          isCompactionPresetsRootSelected={controller.isCompactionPresetsRootSelected}
          isCurveMnemonicsRootSelected={controller.isCurveMnemonicsRootSelected}
          isMeasurementUnitsRootSelected={controller.isMeasurementUnitsRootSelected}
          isLithologiesRootSelected={controller.isLithologiesRootSelected}
          isPatternPalettesRootSelected={controller.isPatternPalettesRootSelected}
          selectedMnemonicSetId={controller.selectedMnemonicSetId}
          selectedUnitDimensionCode={controller.selectedUnitDimensionCode}
          selectedLithologySetId={controller.selectedLithologySetId}
          selectedLithologyPatternPaletteId={controller.selectedLithologyPatternPaletteId}
          lithologyPatternPalettes={controller.lithologyPatternPalettes}
          selectedObject={controller.selectedObject}
          stratCharts={controller.stratCharts}
          visibleCurveMnemonicsByWellId={controller.visibleCurveMnemonicsByWellId}
          visibleFormationIdsByWellId={controller.visibleFormationIdsByWellId}
          hiddenTopSetZoneIdsByWellId={controller.hiddenTopSetZoneIdsByWellId}
          wellInventories={controller.wellInventories}
          onSelectZoneSetsRoot={controller.handleSelectZoneSetsRoot}
          onSelectZoneSet={controller.handleSelectZoneSet}
          onSelectZoneInSet={controller.handleSelectZoneInSet}
          selectedZoneId={controller.selectedZoneId}
          selectedZoneSetId={controller.selectedZoneSetId}
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
          selectedCurveTrack={controller.selectedCurveTrack}
          onTrackSettingUpdate={controller.handleTrackSettingUpdate}
          formations={controller.formations}
          visibleFormationIds={controller.visibleFormationIds}
          selectedFormation={controller.selectedFormation}
          onFormationUpdate={controller.setFormationUpdate}
          onFormationMove={controller.setFormationMove}
          selectedChart={controller.selectedChart}
          selectedCompactionModel={controller.selectedCompactionModel}
          selectedCompactionPreset={controller.selectedCompactionPreset}
          compactionPresets={controller.compactionPresets}
          mnemonicSets={controller.mnemonicSets}
          selectedMnemonicSet={controller.selectedMnemonicSet}
          unitDimensions={controller.unitDimensions}
          selectedUnitDimension={controller.selectedUnitDimension}
          lithologySets={controller.lithologySets}
          lithologyPatternPalettes={controller.lithologyPatternPalettes}
          selectedLithologySet={controller.selectedLithologySet}
          selectedLithologyPatternPalette={controller.selectedLithologyPatternPalette}
          selectedLithologyDictionaryEntry={controller.selectedLithologyDictionaryEntry}
          curveCount={controller.curveCount}
          visibleCurveCount={controller.visibleCurveCount}
          minDepth={controller.minDepth}
          maxDepth={controller.maxDepth}
          zones={controller.zones}
          selectedZoneId={controller.selectedZoneId}
          onSelectZone={(zoneId) => {
            const selected = controller.selectedObject
            if (selected?.type === 'zone-set') {
              controller.handleSelectZoneInSet(selected.zoneSetId, selected.wellId, zoneId)
              return
            }
            if (selected?.type === 'zone' && selected.zoneSetId) {
              controller.handleSelectZoneInSet(selected.zoneSetId, selected.wellId, zoneId)
              return
            }
            controller.handleSelectZone(controller.activeWellId ?? '', zoneId)
          }}
        />
      </div>

      {contextMenu ? (
        <div
          className="data-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {contextMenuItems.map((item) => (
            <button
              key={item.label}
              type="button"
              className="data-context-menu__item"
              disabled={item.disabled}
              onClick={item.onClick}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </aside>
    </DataManagerProvider>
  )
}
