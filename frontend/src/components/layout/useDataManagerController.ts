import { useEffect, useMemo, useState } from 'react'

import { createDefaultWellView, useViewStore, useWellDataStore, useWorkspaceStore } from '@/stores'
import { buildCurveDefaults } from '@/utils/curvePresets'
import { makeActionHandlers } from './dataManagerActions'
import { makeSelectionHandlers } from './dataManagerSelection'
import { makeVisibilityHandlers } from './dataManagerVisibility'

export function useDataManagerController() {
  const [wellInspectorDraft, setWellInspectorDraft] = useState({
    well_name: '',
    color_hex: '#2563eb',
    x: '',
    y: '',
    kb_elev: '',
    gl_elev: '',
    td_md: '',
    crs: '',
  })

  const well = useWellDataStore((state) => state.well)
  const curves = useWellDataStore((state) => state.curves)
  const formations = useWellDataStore((state) => state.formations)
  const zones = useWellDataStore((state) => state.zones)
  const stratCharts = useWellDataStore((state) => state.stratCharts)
  const compactionModels = useWellDataStore((state) => state.compactionModels)
  const compactionPresets = useWellDataStore((state) => state.compactionPresets)
  const mnemonicSets = useWellDataStore((state) => state.mnemonicSets)
  const unitDimensions = useWellDataStore((state) => state.unitDimensions)
  const lithologyDictionaryEntries = useWellDataStore((state) => state.lithologyDictionaryEntries)
  const lithologySets = useWellDataStore((state) => state.lithologySets)
  const lithologyPatternPalettes = useWellDataStore((state) => state.lithologyPatternPalettes)
  const wellInventories = useWellDataStore((state) => state.wellInventories)
  const loadWell = useWellDataStore((state) => state.loadWell)
  const updateFormation = useWellDataStore((state) => state.updateFormation)
  const updateFormationDepth = useWellDataStore((state) => state.updateFormationDepth)
  const activateChart = useWellDataStore((state) => state.activateChart)
  const deleteChart = useWellDataStore((state) => state.deleteChart)
  const refreshWell = useWellDataStore((state) => state.refreshWell)
  const loadWellInventories = useWellDataStore((state) => state.loadWellInventories)
  const activateCompactionModel = useWellDataStore((state) => state.activateCompactionModel)
  const createCompactionModel = useWellDataStore((state) => state.createCompactionModel)
  const deleteCompactionModel = useWellDataStore((state) => state.deleteCompactionModel)
  const createMnemonicSet = useWellDataStore((state) => state.createMnemonicSet)

  const activeSidebarTab = useWorkspaceStore((state) => state.activeSidebarTab)
  const selectedFormationId = useWorkspaceStore((state) => state.selectedFormationId)
  const selectedObject = useWorkspaceStore((state) => state.selectedObject)
  const sidebarTopRatio = useWorkspaceStore((state) => state.sidebarTopRatio)
  const wellViewStates = useWorkspaceStore((state) => state.wellViewStates)
  const sidebarWidth = useWorkspaceStore((state) => state.sidebarWidth)
  const setActiveSidebarTab = useWorkspaceStore((state) => state.setActiveSidebarTab)
  const setActiveToolbarMode = useWorkspaceStore((state) => state.setActiveToolbarMode)
  const setSelectedFormationId = useWorkspaceStore((state) => state.setSelectedFormationId)
  const setSelectedObject = useWorkspaceStore((state) => state.setSelectedObject)
  const updateWellViewState = useWorkspaceStore((state) => state.updateWellViewState)
  const dropWellViewState = useWorkspaceStore((state) => state.dropWellViewState)

  const selectedTrackId = useViewStore((state) => state.selectedTrackId)
  const selectTrack = useViewStore((state) => state.selectTrack)
  const wellId = well?.well_id ?? null

  useEffect(() => {
    if (!well) return
    // Existing inspector draft is local editable state that must reset when active well changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWellInspectorDraft({
      well_name: well.well_name,
      color_hex: well.color_hex,
      x: String(well.x ?? 0),
      y: String(well.y ?? 0),
      kb_elev: String(well.kb_elev ?? 0),
      gl_elev: String(well.gl_elev ?? 0),
      td_md: String(well.td_md ?? 0),
      crs: well.crs ?? '',
    })
  }, [well])

  const activeWellView = useMemo(() => {
    if (!wellId) return createDefaultWellView()
    return wellViewStates[wellId] ?? createDefaultWellView()
  }, [wellId, wellViewStates])

  const { minDepth, maxDepth } = useMemo(() => {
    if (curves.length === 0) return { minDepth: 0, maxDepth: 1000 }
    let min = Infinity
    let max = -Infinity
    for (const curve of curves) {
      if (curve.depths.length > 0) {
        min = Math.min(min, curve.depths[0])
        max = Math.max(max, curve.depths[curve.depths.length - 1])
      }
    }
    return { minDepth: min, maxDepth: max }
  }, [curves])

  const visibleCurveMnemonics = useMemo(() => (
    Array.from(new Set(
      activeWellView.tracks.flatMap((track) =>
        track.curves
          .map((curve) => curve.mnemonic)
          .filter((mnemonic) => !activeWellView.hiddenCurveMnemonics.includes(mnemonic)),
      ),
    ))
  ), [activeWellView.hiddenCurveMnemonics, activeWellView.tracks])

  const visibleCurveMnemonicsByWellId = useMemo(
    () => Object.fromEntries(
      Object.entries(wellViewStates).map(([wellId, state]) => [
        wellId,
        Array.from(new Set(
          state.tracks.flatMap((track) =>
            track.curves
              .map((curve) => curve.mnemonic)
              .filter((mnemonic) => !state.hiddenCurveMnemonics.includes(mnemonic)),
          ),
        )),
      ]),
    ),
    [wellViewStates],
  )

  const visibleFormationIdsByWellId = useMemo(
    () => Object.fromEntries(
      Object.entries(wellViewStates).map(([wellId, state]) => [wellId, state.visibleFormationIds]),
    ),
    [wellViewStates],
  )

  const deviationVisibilityByWellId = useMemo(
    () => Object.fromEntries(
      Object.entries(wellViewStates).map(([wellId, state]) => [wellId, state.deviationVisible]),
    ),
    [wellViewStates],
  )

  const selectedFormation = useMemo(
    () => formations.find((f) => f.id === selectedFormationId) ?? null,
    [formations, selectedFormationId],
  )

  const selectedCurveConfig = useMemo(() => {
    if (selectedObject?.type !== 'curve') return null
    const existing = activeWellView.tracks.flatMap((t) => t.curves).find((c) => c.mnemonic === selectedObject.mnemonic)
    if (existing) return existing
    const curve = curves.find((item) => item.mnemonic === selectedObject.mnemonic)
    return curve ? buildCurveDefaults(curve, activeWellView.tracks.flatMap((track) => track.curves).length).curveConfig : null
  }, [activeWellView.tracks, curves, selectedObject])

  const selectedCurveTrack = useMemo(() => {
    if (selectedObject?.type !== 'curve-track') return null
    return activeWellView.tracks.find((t) => t.id === selectedObject.trackId) ?? null
  }, [activeWellView.tracks, selectedObject])

  const selectedChart = useMemo(() => {
    if (selectedObject?.type !== 'strat-chart') return null
    return stratCharts.find((c) => c.id === selectedObject.chartId) ?? null
  }, [selectedObject, stratCharts])

  const selectedCompactionModel = useMemo(() => {
    if (selectedObject?.type !== 'compaction-model') return null
    return compactionModels.find((m) => m.id === selectedObject.modelId) ?? null
  }, [selectedObject, compactionModels])

  const selectedCompactionPreset = useMemo(() => {
    if (selectedObject?.type !== 'compaction-preset') return null
    return compactionPresets.find((preset) => preset.id === selectedObject.presetId) ?? null
  }, [compactionPresets, selectedObject])

  const selectedMnemonicSet = useMemo(() => {
    if (selectedObject?.type !== 'mnemonic-set') return null
    return mnemonicSets.find((entry) => entry.id === selectedObject.setId) ?? null
  }, [mnemonicSets, selectedObject])

  const selectedUnitDimension = useMemo(() => {
    if (selectedObject?.type !== 'unit-dimension') return null
    return unitDimensions.find((entry) => entry.code === selectedObject.dimensionCode) ?? null
  }, [selectedObject, unitDimensions])

  const selectedLithologySet = useMemo(() => {
    if (selectedObject?.type !== 'lithology-set') return null
    return lithologySets.find((entry) => entry.id === selectedObject.setId) ?? null
  }, [lithologySets, selectedObject])

  const selectedLithologyPatternPalette = useMemo(() => {
    if (selectedObject?.type !== 'lithology-pattern-palette') return null
    return lithologyPatternPalettes.find((entry) => entry.id === selectedObject.paletteId) ?? null
  }, [lithologyPatternPalettes, selectedObject])

  const selectedLithologyDictionaryEntry = useMemo(() => {
    if (selectedObject?.type !== 'lithology-dictionary-entry') return null
    return lithologyDictionaryEntries.find((entry) => entry.id === selectedObject.entryId) ?? null
  }, [lithologyDictionaryEntries, selectedObject])

  const selection = makeSelectionHandlers({
    well,
    selectedObject,
    setSelectedObject,
    setSelectedFormationId,
    setActiveToolbarMode,
    loadWell,
  })

  const visibility = makeVisibilityHandlers({
    well,
    selectedTrackId,
    updateWellViewState,
    loadWell,
  })

  const actions = makeActionHandlers({
    well,
    wellInspectorDraft,
    setWellInspectorDraft,
    selectedObject,
    selectedFormation,
    selectedCompactionModel,
    selectedFormationId,
    setSelectedObject,
    setSelectedFormationId,
    dropWellViewState,
    updateWellViewState,
    selectTrack,
    refreshWell,
    loadWellInventories,
    updateFormation: updateFormation as (id: string, patch: Record<string, unknown>) => Promise<void>,
    deleteChart,
    createCompactionModel,
    deleteCompactionModel,
  })

  return {
    activeSidebarTab,
    activeWellId: wellId,
    activeWellView,
    compactionModels,
    compactionPresets,
    curveCount: curves.length,
    deviationVisibilityByWellId,
    formations,
    lithologyDictionaryEntries,
    lithologyPatternPalettes,
    lithologySets,
    mnemonicSets,
    unitDimensions,
    handleCurveSettingUpdate: visibility.handleCurveSettingUpdate,
    handleTrackSettingUpdate: visibility.handleTrackSettingUpdate,
    handleFocusCurveObject: selection.handleFocusCurveObject,
    handleFocusFormationObject: selection.handleFocusFormationObject,
    handleFocusLasGroupObject: selection.handleFocusLasGroupObject,
    handleFocusTopsGroupObject: selection.handleFocusTopsGroupObject,
    handleFocusWellObject: selection.handleFocusWellObject,
    handleSaveWellInspector: actions.handleSaveWellInspector,
    handleSelectCurve: selection.handleSelectCurve,
    handleSelectFormation: selection.handleSelectFormation,
    handleSelectLasGroup: selection.handleSelectLasGroup,
    handleSelectTopsGroup: selection.handleSelectTopsGroup,
    handleSelectWell: selection.handleSelectWell,
    handleSelectZonesGroup: selection.handleSelectZonesGroup,
    handleSelectZone: selection.handleSelectZone,
    handleSelectZoneSetsRoot: selection.handleSelectZoneSetsRoot,
    handleSelectZoneSet: selection.handleSelectZoneSet,
    handleSelectZoneInSet: selection.handleSelectZoneInSet,
    handleSetDeviationVisible: visibility.handleSetDeviationVisible,
    handleToggleAllCurves: visibility.handleToggleAllCurves,
    handleToggleAllFormations: visibility.handleToggleAllFormations,
    handleToggleCurve: visibility.handleToggleCurve,
    handleToggleFormation: visibility.handleToggleFormation,
    handleWellInspectorDraftChange: actions.handleWellInspectorDraftChange,
    maxDepth,
    minDepth,
    onActivateChart: (chartId: number) => void activateChart(chartId),
    onActivateCompactionModel: (id: number) => void activateCompactionModel(id),
    onCreateCompactionModel: actions.handleCreateCompactionModel,
    onCreateMnemonicSet: () => {
      const name = window.prompt('New mnemonic set name:', 'New Mnemonic Set')?.trim()
      if (!name) return
      void createMnemonicSet(name)
        .then((created) => setSelectedObject({ type: 'mnemonic-set', setId: created.id }))
        .catch((error: unknown) => window.alert(String(error)))
    },
    onDeleteChart: (chartId: number) => void deleteChart(chartId),
    onDeleteCompactionModel: (id: number) => void deleteCompactionModel(id).catch((e: unknown) => window.alert(String(e))),
    onDeleteCompactionModelById: (id: number, name: string, isBuiltin: boolean, isActive: boolean) =>
      void actions.handleDeleteCompactionModelById(id, name, isBuiltin, isActive),
    onDeleteFormation: (wellId: string, formationId: string, name: string) => void actions.handleDeleteFormation(wellId, formationId, name),
    onDeleteAllFormations: (wellId: string, formations: Array<{ id: string; name: string }>, wellName: string) =>
      void actions.handleDeleteAllFormations(wellId, formations, wellName),
    onDeleteStratChartById: (chartId: number, name: string, isBuiltin: boolean) => void actions.handleDeleteChartById(chartId, name, isBuiltin),
    onDeleteWellById: (wellId: string, wellName: string) => void actions.handleDeleteWell(wellId, wellName),
    onDuplicateCompactionModel: (id: number, name: string) => void actions.handleDuplicateCompactionModel(id, name),
    onDuplicateFormation: (
      wellId: string,
      formation: { name: string; depth_md: number | null; active_strat_color: string | null },
    ) => void actions.handleDuplicateFormation(wellId, formation),
    onRenameFormation: (wellId: string, formationId: string, currentName: string) =>
      void actions.handleRenameFormation(wellId, formationId, currentName),
    onRenameSelectedObject: () => void actions.handleRenameSelectedObject(),
    onRenameWellById: (wellId: string, currentName: string) => void actions.handleRenameWell(wellId, currentName),
    onSelectChart: (chartId: number) => setSelectedObject({ type: 'strat-chart', chartId }),
    onCreateCompactionPresetDraft: () => setSelectedObject({ type: 'compaction-preset-draft' }),
    onSelectCompactionPreset: (presetId: number) => setSelectedObject({ type: 'compaction-preset', presetId }),
    onSelectCompactionPresetsRoot: () => setSelectedObject({ type: 'compaction-presets-root' }),
    onSelectCompactionModel: (modelId: number) => setSelectedObject({ type: 'compaction-model', modelId }),
    onSelectCurveMnemonicsRoot: () => setSelectedObject({ type: 'curve-mnemonics-root' }),
    onSelectMnemonicSet: (setId: number) => setSelectedObject({ type: 'mnemonic-set', setId }),
    onSelectMeasurementUnitsRoot: () => setSelectedObject({ type: 'measurement-units-root' }),
    onSelectUnitDimension: (dimensionCode: string) => setSelectedObject({ type: 'unit-dimension', dimensionCode }),
    onSelectLithologiesRoot: () => setSelectedObject({ type: 'lithologies-root' }),
    onSelectLithologySet: (setId: number) => setSelectedObject({ type: 'lithology-set', setId }),
    onSelectPatternPalettesRoot: () => setSelectedObject({ type: 'pattern-palettes-root' }),
    onSelectLithologyPatternPalette: (paletteId: number) => setSelectedObject({ type: 'lithology-pattern-palette', paletteId }),
    onSelectLithologyDictionaryEntry: (entryId: number) => setSelectedObject({ type: 'lithology-dictionary-entry', entryId }),
    onSelectTemplatesTab: () => setActiveSidebarTab('templates'),
    onSelectStratChartsTab: () => setActiveSidebarTab('strat-charts'),
    onSelectWellsTab: () => setActiveSidebarTab('wells'),
    selectedChart,
    selectedChartId: selectedObject?.type === 'strat-chart' ? selectedObject.chartId : null,
    selectedCompactionModel,
    selectedCompactionModelId: selectedObject?.type === 'compaction-model' ? selectedObject.modelId : null,
    selectedCompactionPreset,
    selectedCompactionPresetId: selectedObject?.type === 'compaction-preset' ? selectedObject.presetId : null,
    selectedCurveConfig,
    selectedCurveTrack,
    selectedFormation,
    selectedFormationId,
    selectedLithologySet,
    selectedLithologySetId: selectedObject?.type === 'lithology-set' ? selectedObject.setId : null,
    selectedLithologyPatternPalette,
    selectedLithologyPatternPaletteId: selectedObject?.type === 'lithology-pattern-palette' ? selectedObject.paletteId : null,
    selectedMnemonicSet,
    selectedMnemonicSetId: selectedObject?.type === 'mnemonic-set' ? selectedObject.setId : null,
    selectedUnitDimension,
    selectedUnitDimensionCode: selectedObject?.type === 'unit-dimension' ? selectedObject.dimensionCode : null,
    selectedLithologyDictionaryEntry,
    selectedLithologyDictionaryEntryId: selectedObject?.type === 'lithology-dictionary-entry' ? selectedObject.entryId : null,
    selectedObject,
    isCompactionPresetsRootSelected: selectedObject?.type === 'compaction-presets-root',
    isCurveMnemonicsRootSelected: selectedObject?.type === 'curve-mnemonics-root',
    isMeasurementUnitsRootSelected: selectedObject?.type === 'measurement-units-root',
    isLithologiesRootSelected: selectedObject?.type === 'lithologies-root',
    isPatternPalettesRootSelected: selectedObject?.type === 'pattern-palettes-root',
    setFormationMove: (formationId: string, depth: number) => {
      if (Number.isFinite(depth)) void updateFormationDepth(formationId, depth)
    },
    setFormationUpdate: (formationId: string, patch: { name?: string; age_ma?: number; hiatus_duration_ma?: number; kind?: string; color?: string; water_depth_m?: number; eroded_thickness_m?: number }) => void updateFormation(formationId, patch),
    sidebarTopRatio,
    sidebarWidth,
    stratCharts,
    visibleCurveCount: visibleCurveMnemonics.length,
    visibleCurveMnemonicsByWellId,
    visibleFormationIds: activeWellView.visibleFormationIds,
    visibleFormationIdsByWellId,
    well,
    wellInspectorDraft,
    wellInventories,
    zones,
    selectedZoneId: selectedObject?.type === 'zone' ? selectedObject.zoneId : null,
    selectedZoneSetId: selectedObject?.type === 'zone-set'
      ? selectedObject.zoneSetId
      : selectedObject?.type === 'zone'
        ? selectedObject.zoneSetId ?? null
        : null,
  }
}
