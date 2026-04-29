import type { SelectedObject } from '@/stores/workspaceStore'
import type {
  CompactionPresetSummary,
  CompactionModel,
  CurveMnemonicSetSummary,
  FormationTop,
  FormationZone,
  LithologyDictionaryEntry,
  LithologyPatternPaletteSummary,
  LithologySetSummary,
  StratChartInfo,
  TrackConfig,
  UnitDimensionSummary,
  Well,
} from '@/types'
import { CompactionPresetDraftSettings } from './settings/CompactionPresetDraftSettings'
import { CompactionPresetSettings } from './settings/CompactionPresetSettings'
import { CompactionPresetsRootSettings } from './settings/CompactionPresetsRootSettings'
import { CurveMnemonicSetSettings } from './settings/CurveMnemonicSetSettings'
import { CurveMnemonicSetsRootSettings } from './settings/CurveMnemonicSetsRootSettings'
import { LithologyDictionarySettings } from './settings/LithologyDictionarySettings'
import { LithologyPatternPaletteSettings } from './settings/LithologyPatternPaletteSettings'
import { LithologyPatternPalettesRootSettings } from './settings/LithologyPatternPalettesRootSettings'
import { LithologySetSettings } from './settings/LithologySetSettings'
import { LithologySetsRootSettings } from './settings/LithologySetsRootSettings'
import { MeasurementUnitsRootSettings } from './settings/MeasurementUnitsRootSettings'
import { UnitDimensionSettings } from './settings/UnitDimensionSettings'

import { CurveSettings } from './settings/CurveSettings'
import { SubsidenceChartSettings } from './settings/SubsidenceChartSettings'
import { SubsidenceModelSettings } from './settings/SubsidenceModelSettings'
import { CurveTrackSettings } from './settings/CurveTrackSettings'
import { DepthTrackSettings } from './settings/DepthTrackSettings'
import { FormationsTrackSettings } from './settings/FormationsTrackSettings'
import { LasSettings } from './settings/LasSettings'
import { ModelSettings } from './settings/ModelSettings'
import { StratChartSettings } from './settings/StratChartSettings'
import { TopPickSettings } from './settings/TopPickSettings'
import { TopsSettings } from './settings/TopsSettings'
import { WellSettings } from './settings/WellSettings'
import { ZoneDetailSettings } from './settings/ZoneDetailSettings'
import { ZoneSettings } from './settings/ZoneSettings'
import { ZoneSetsRootSettings } from './settings/ZoneSetsRootSettings'
import { SeaLevelCurvesRootSettings } from './settings/SeaLevelCurvesRootSettings'
import { SeaLevelCurveSettings } from './settings/SeaLevelCurveSettings'
import type { WellInspectorDraft } from './settings/WellSettings'

export type { WellInspectorDraft }

interface SettingsInspectorProps {
  selectedObject: SelectedObject | null
  well: Well | null
  wellInspectorDraft: WellInspectorDraft
  onWellInspectorDraftChange: (field: keyof WellInspectorDraft, value: string) => void
  onSaveWellInspector: () => void | Promise<void>
  selectedCurveConfig: TrackConfig['curves'][number] | null
  onCurveSettingUpdate: (
    mnemonic: string,
    patch: Partial<TrackConfig['curves'][number]>,
  ) => void
  selectedCurveTrack: TrackConfig | null
  onTrackSettingUpdate: (trackId: string, patch: Partial<TrackConfig>) => void
  formations: FormationTop[]
  visibleFormationIds: string[]
  selectedFormation: FormationTop | null
  onFormationUpdate: (
    formationId: string,
    patch: {
      name?: string
      age_ma?: number
      age_base_ma?: number
      kind?: string
      color?: string
      water_depth_m?: number
      eroded_thickness_m?: number
    },
  ) => void | Promise<void>
  onFormationMove: (formationId: string, depth: number) => void
  selectedChart: StratChartInfo | null
  selectedCompactionModel: CompactionModel | null
  selectedCompactionPreset: CompactionPresetSummary | null
  compactionPresets: CompactionPresetSummary[]
  mnemonicSets: CurveMnemonicSetSummary[]
  selectedMnemonicSet: CurveMnemonicSetSummary | null
  unitDimensions: UnitDimensionSummary[]
  selectedUnitDimension: UnitDimensionSummary | null
  lithologySets: LithologySetSummary[]
  lithologyPatternPalettes: LithologyPatternPaletteSummary[]
  selectedLithologySet: LithologySetSummary | null
  selectedLithologyPatternPalette: LithologyPatternPaletteSummary | null
  selectedLithologyDictionaryEntry: LithologyDictionaryEntry | null
  curveCount: number
  visibleCurveCount: number
  minDepth: number
  maxDepth: number
  zones: FormationZone[]
  selectedZoneId: number | null
  onSelectZone: (zoneId: number) => void
}

function EmptyInspector({ message }: { message: string }) {
  return <p className="sidebar-panel__empty">{message}</p>
}

export function SettingsInspector({
  selectedObject,
  well,
  wellInspectorDraft,
  onWellInspectorDraftChange,
  onSaveWellInspector,
  selectedCurveConfig,
  onCurveSettingUpdate,
  selectedCurveTrack,
  onTrackSettingUpdate,
  formations,
  visibleFormationIds,
  selectedFormation,
  onFormationUpdate,
  onFormationMove,
  selectedChart,
  selectedCompactionModel,
  selectedCompactionPreset,
  compactionPresets,
  mnemonicSets,
  selectedMnemonicSet,
  unitDimensions,
  selectedUnitDimension,
  lithologySets,
  lithologyPatternPalettes,
  selectedLithologySet,
  selectedLithologyPatternPalette,
  selectedLithologyDictionaryEntry,
  curveCount,
  visibleCurveCount,
  minDepth,
  maxDepth,
  zones,
  selectedZoneId,
  onSelectZone,
}: SettingsInspectorProps) {
  if (!selectedObject) {
    return <EmptyInspector message="Select an object in Data Manager to inspect its settings." />
  }

  if (selectedObject.type === 'depth-track') {
    if (!well || well.well_id !== selectedObject.wellId) {
      return <EmptyInspector message="Selected DEPTH track settings are not loaded yet." />
    }
    return <DepthTrackSettings />
  }

  if (selectedObject.type === 'well') {
    if (!well || well.well_id !== selectedObject.wellId) {
      return <EmptyInspector message="Selected well settings are not loaded yet." />
    }
    return (
      <WellSettings
        well={well}
        wellInspectorDraft={wellInspectorDraft}
        onWellInspectorDraftChange={onWellInspectorDraftChange}
        onSaveWellInspector={onSaveWellInspector}
      />
    )
  }

  if (selectedObject.type === 'formations-track') {
    if (!well || well.well_id !== selectedObject.wellId) {
      return <EmptyInspector message="Selected FORMATIONS track settings are not loaded yet." />
    }
    return <FormationsTrackSettings visibleFormationIds={visibleFormationIds} />
  }

  if (selectedObject.type === 'las-group') {
    if (!well || well.well_id !== selectedObject.wellId) {
      return <EmptyInspector message="Selected logs group is not loaded yet." />
    }
    return (
      <LasSettings
        well={well}
        curveCount={curveCount}
        visibleCurveCount={visibleCurveCount}
        minDepth={minDepth}
        maxDepth={maxDepth}
      />
    )
  }

  if (selectedObject.type === 'curve-track') {
    if (!selectedCurveTrack || selectedCurveTrack.id !== selectedObject.trackId) {
      return <EmptyInspector message="Selected track settings are not available yet." />
    }
    return <CurveTrackSettings track={selectedCurveTrack} onTrackSettingUpdate={onTrackSettingUpdate} />
  }

  if (selectedObject.type === 'curve') {
    if (!selectedCurveConfig || selectedCurveConfig.mnemonic !== selectedObject.mnemonic) {
      return <EmptyInspector message="Selected curve settings are not available yet." />
    }
    return <CurveSettings selectedCurveConfig={selectedCurveConfig} onCurveSettingUpdate={onCurveSettingUpdate} />
  }

  if (selectedObject.type === 'tops-group') {
    if (!well || well.well_id !== selectedObject.wellId) {
      return <EmptyInspector message="Selected TOPS group is not loaded yet." />
    }
    return <TopsSettings formations={formations} visibleFormationIds={visibleFormationIds} />
  }

  if (selectedObject.type === 'zone-sets-root') {
    return <ZoneSetsRootSettings />
  }

  if (selectedObject.type === 'zone-set') {
    return (
      <ZoneSettings
        wellId={selectedObject.wellId}
        zoneSetId={selectedObject.zoneSetId}
        onSelectZone={onSelectZone}
        selectedZoneId={selectedZoneId}
      />
    )
  }

  if (selectedObject.type === 'zones-group') {
    return (
      <ZoneSettings
        wellId={selectedObject.wellId}
        onSelectZone={onSelectZone}
        selectedZoneId={selectedZoneId}
      />
    )
  }

  if (selectedObject.type === 'zone') {
    const zone = zones.find((z) => z.zone_id === selectedObject.zoneId)
    if (!zone) {
      return <EmptyInspector message="Selected zone is not loaded yet." />
    }
    return <ZoneDetailSettings zone={zone} />
  }

  if (selectedObject.type === 'top-pick') {
    if (!selectedFormation || selectedFormation.id !== selectedObject.formationId) {
      return <EmptyInspector message="Selected top pick is not loaded yet." />
    }
    return (
      <TopPickSettings
        selectedFormation={selectedFormation}
        onFormationUpdate={onFormationUpdate}
        onFormationMove={onFormationMove}
      />
    )
  }

  if (selectedObject.type === 'strat-chart') {
    if (!selectedChart || selectedChart.id !== selectedObject.chartId) {
      return <EmptyInspector message="Selected stratigraphic chart is not loaded yet." />
    }
    return <StratChartSettings selectedChart={selectedChart} />
  }

  if (selectedObject.type === 'compaction-presets-root') {
    return <CompactionPresetsRootSettings presets={compactionPresets} />
  }

  if (selectedObject.type === 'compaction-preset') {
    if (!selectedCompactionPreset || selectedCompactionPreset.id !== selectedObject.presetId) {
      return <EmptyInspector message="Selected compaction preset is not loaded yet." />
    }
    return <CompactionPresetSettings preset={selectedCompactionPreset} />
  }

  if (selectedObject.type === 'compaction-preset-draft') {
    return <CompactionPresetDraftSettings />
  }

  if (selectedObject.type === 'curve-mnemonics-root') {
    return <CurveMnemonicSetsRootSettings sets={mnemonicSets} />
  }

  if (selectedObject.type === 'mnemonic-set') {
    if (!selectedMnemonicSet || selectedMnemonicSet.id !== selectedObject.setId) {
      return <EmptyInspector message="Selected mnemonic set is not loaded yet." />
    }
    return <CurveMnemonicSetSettings mnemonicSet={selectedMnemonicSet} />
  }

  if (selectedObject.type === 'measurement-units-root') {
    return <MeasurementUnitsRootSettings dimensions={unitDimensions} />
  }

  if (selectedObject.type === 'unit-dimension') {
    if (!selectedUnitDimension || selectedUnitDimension.code !== selectedObject.dimensionCode) {
      return <EmptyInspector message="Selected unit dimension is not loaded yet." />
    }
    return <UnitDimensionSettings dimension={selectedUnitDimension} />
  }

  if (selectedObject.type === 'lithologies-root') {
    return <LithologySetsRootSettings sets={lithologySets} />
  }

  if (selectedObject.type === 'pattern-palettes-root') {
    return <LithologyPatternPalettesRootSettings palettes={lithologyPatternPalettes} />
  }

  if (selectedObject.type === 'lithology-pattern-palette') {
    if (!selectedLithologyPatternPalette || selectedLithologyPatternPalette.id !== selectedObject.paletteId) {
      return <EmptyInspector message="Selected pattern palette is not loaded yet." />
    }
    return <LithologyPatternPaletteSettings palette={selectedLithologyPatternPalette} />
  }

  if (selectedObject.type === 'lithology-set') {
    if (!selectedLithologySet || selectedLithologySet.id !== selectedObject.setId) {
      return <EmptyInspector message="Selected lithology set is not loaded yet." />
    }
    return <LithologySetSettings lithologySet={selectedLithologySet} />
  }

  if (selectedObject.type === 'compaction-model') {
    if (!selectedCompactionModel || selectedCompactionModel.id !== selectedObject.modelId) {
      return <EmptyInspector message="Selected legacy compaction model is not loaded yet." />
    }
    return <ModelSettings model={selectedCompactionModel} />
  }

  if (selectedObject.type === 'lithology-dictionary-entry') {
    if (!selectedLithologyDictionaryEntry || selectedLithologyDictionaryEntry.id !== selectedObject.entryId) {
      return <EmptyInspector message="Selected lithology entry is not loaded yet." />
    }
    return <LithologyDictionarySettings entry={selectedLithologyDictionaryEntry} />
  }

  if (selectedObject.type === 'subsidence-chart') {
    return <SubsidenceChartSettings chartType={selectedObject.chartType} />
  }

  if (selectedObject.type === 'subsidence-model') {
    return <SubsidenceModelSettings modelType={selectedObject.modelType} />
  }

  if (selectedObject.type === 'sea-level-curves-root') {
    return <SeaLevelCurvesRootSettings />
  }

  if (selectedObject.type === 'sea-level-curve') {
    return <SeaLevelCurveSettings curveId={selectedObject.curveId} />
  }

  return <EmptyInspector message="No editable settings are implemented for the selected object yet." />
}
