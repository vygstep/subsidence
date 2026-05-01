import { SettingsInspector } from './SettingsInspector'
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

interface WellInspectorDraft {
  well_name: string
  color_hex: string
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
      hiatus_duration_ma?: number
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

export function SettingsPaneShell({ zones, selectedZoneId, onSelectZone, ...rest }: SettingsPaneShellProps) {
  return (
    <section className="sidebar-panel app-sidebar__zone">
      <header className="sidebar-panel__header">
        <h2 className="sidebar-panel__title">Settings</h2>
      </header>
      <div className="sidebar-panel__body">
        <SettingsInspector {...rest} zones={zones} selectedZoneId={selectedZoneId} onSelectZone={onSelectZone} />
      </div>
    </section>
  )
}
