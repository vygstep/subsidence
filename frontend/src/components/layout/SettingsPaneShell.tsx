import { SettingsInspector } from './SettingsInspector'
import type { SelectedObject } from '@/stores/workspaceStore'
import type {
  CompactionPresetSummary,
  CompactionModel,
  CurveDictionaryEntry,
  FormationTop,
  LithologyDictionaryEntry,
  StratChartInfo,
  TrackConfig,
  Well,
} from '@/types'

interface WellInspectorDraft {
  well_name: string
  x: string
  y: string
  kb_elev: string
  gl_elev: string
  td_md: string
  crs: string
}

interface SettingsPaneShellProps {
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
  selectedCompactionPreset: CompactionPresetSummary | null
  compactionPresets: CompactionPresetSummary[]
  selectedCurveDictionaryEntry: CurveDictionaryEntry | null
  selectedLithologyDictionaryEntry: LithologyDictionaryEntry | null
  curveCount: number
  visibleCurveCount: number
  minDepth: number
  maxDepth: number
}

export function SettingsPaneShell(props: SettingsPaneShellProps) {
  return (
    <section className="sidebar-panel app-sidebar__zone">
      <header className="sidebar-panel__header">
        <h2 className="sidebar-panel__title">Settings</h2>
      </header>
      <div className="sidebar-panel__body">
        <SettingsInspector {...props} />
      </div>
    </section>
  )
}
