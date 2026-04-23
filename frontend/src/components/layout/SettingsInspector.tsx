import type { SelectedObject } from '@/stores/workspaceStore'
import type {
  CompactionModel,
  CurveDictionaryEntry,
  FormationTop,
  LithologyDictionaryEntry,
  StratChartInfo,
  TrackConfig,
  Well,
} from '@/types'
import { CurveDictionarySettings } from './settings/CurveDictionarySettings'
import { LithologyDictionarySettings } from './settings/LithologyDictionarySettings'

import { CurveSettings } from './settings/CurveSettings'
import { DepthTrackSettings } from './settings/DepthTrackSettings'
import { FormationsTrackSettings } from './settings/FormationsTrackSettings'
import { LasSettings } from './settings/LasSettings'
import { ModelSettings } from './settings/ModelSettings'
import { StratChartSettings } from './settings/StratChartSettings'
import { TopPickSettings } from './settings/TopPickSettings'
import { TopsSettings } from './settings/TopsSettings'
import { WellSettings } from './settings/WellSettings'
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
  formations: FormationTop[]
  visibleFormationIds: string[]
  selectedFormation: FormationTop | null
  onFormationUpdate: (
    formationId: string,
    patch: {
      name?: string
      age_ma?: number
      kind?: string
      color?: string
      water_depth_m?: number
      eroded_thickness_m?: number
    },
  ) => void | Promise<void>
  onFormationMove: (formationId: string, depth: number) => void
  selectedChart: StratChartInfo | null
  selectedCompactionModel: CompactionModel | null
  selectedCurveDictionaryEntry: CurveDictionaryEntry | null
  selectedLithologyDictionaryEntry: LithologyDictionaryEntry | null
  curveCount: number
  visibleCurveCount: number
  minDepth: number
  maxDepth: number
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
  formations,
  visibleFormationIds,
  selectedFormation,
  onFormationUpdate,
  onFormationMove,
  selectedChart,
  selectedCompactionModel,
  selectedCurveDictionaryEntry,
  selectedLithologyDictionaryEntry,
  curveCount,
  visibleCurveCount,
  minDepth,
  maxDepth,
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

  if (selectedObject.type === 'compaction-model') {
    if (!selectedCompactionModel || selectedCompactionModel.id !== selectedObject.modelId) {
      return <EmptyInspector message="Selected compaction preset is not loaded yet." />
    }
    return <ModelSettings model={selectedCompactionModel} />
  }

  if (selectedObject.type === 'curve-dictionary-entry') {
    if (!selectedCurveDictionaryEntry || selectedCurveDictionaryEntry.id !== selectedObject.entryId) {
      return <EmptyInspector message="Selected curve dictionary rule is not loaded yet." />
    }
    return <CurveDictionarySettings entry={selectedCurveDictionaryEntry} />
  }

  if (selectedObject.type === 'lithology-dictionary-entry') {
    if (!selectedLithologyDictionaryEntry || selectedLithologyDictionaryEntry.id !== selectedObject.entryId) {
      return <EmptyInspector message="Selected lithology entry is not loaded yet." />
    }
    return <LithologyDictionarySettings entry={selectedLithologyDictionaryEntry} />
  }

  return <EmptyInspector message="No editable settings are implemented for the selected object yet." />
}
