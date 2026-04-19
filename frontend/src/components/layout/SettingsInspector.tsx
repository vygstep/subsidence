import type { SelectedObject } from '@/stores/workspaceStore'
import type { FormationTop, StratChartInfo, TrackConfig, Well } from '@/types'

interface WellInspectorDraft {
  well_name: string
  x: string
  y: string
  kb_elev: string
  gl_elev: string
  td_md: string
  crs: string
}

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
    },
  ) => void | Promise<void>
  onFormationMove: (formationId: string, depth: number) => void
  selectedChart: StratChartInfo | null
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
  curveCount,
  visibleCurveCount,
  minDepth,
  maxDepth,
}: SettingsInspectorProps) {
  if (!selectedObject) {
    return <EmptyInspector message="Select an object in Data Manager to inspect its settings." />
  }

  if (selectedObject.type === 'well') {
    if (!well || well.well_id !== selectedObject.wellId) {
      return <EmptyInspector message="Selected well settings are not loaded yet." />
    }

    return (
      <div className="template-panel">
        <div className="template-panel__group">
          <div className="template-panel__label">Object</div>
          <div className="template-panel__value">Well settings</div>
        </div>
        <label className="project-dialog__field">
          <span>Well name</span>
          <input
            value={wellInspectorDraft.well_name}
            onChange={(event) => onWellInspectorDraftChange('well_name', event.target.value)}
          />
        </label>
        <div className="project-dialog__grid">
          <label className="project-dialog__field">
            <span>X</span>
            <input value={wellInspectorDraft.x} onChange={(event) => onWellInspectorDraftChange('x', event.target.value)} />
          </label>
          <label className="project-dialog__field">
            <span>Y</span>
            <input value={wellInspectorDraft.y} onChange={(event) => onWellInspectorDraftChange('y', event.target.value)} />
          </label>
          <label className="project-dialog__field">
            <span>KB</span>
            <input
              value={wellInspectorDraft.kb_elev}
              onChange={(event) => onWellInspectorDraftChange('kb_elev', event.target.value)}
            />
          </label>
          <label className="project-dialog__field">
            <span>GL</span>
            <input
              value={wellInspectorDraft.gl_elev}
              onChange={(event) => onWellInspectorDraftChange('gl_elev', event.target.value)}
            />
          </label>
          <label className="project-dialog__field">
            <span>TD</span>
            <input
              value={wellInspectorDraft.td_md}
              onChange={(event) => onWellInspectorDraftChange('td_md', event.target.value)}
            />
          </label>
          <label className="project-dialog__field">
            <span>CRS</span>
            <input value={wellInspectorDraft.crs} onChange={(event) => onWellInspectorDraftChange('crs', event.target.value)} />
          </label>
        </div>
        <div className="project-dialog__actions">
          <button
            type="button"
            className="project-dialog__button project-dialog__button--primary"
            onClick={() => void onSaveWellInspector()}
          >
            Save well
          </button>
        </div>
      </div>
    )
  }

  if (selectedObject.type === 'las-group') {
    if (!well || well.well_id !== selectedObject.wellId) {
      return <EmptyInspector message="Selected LAS source is not loaded yet." />
    }

    return (
      <div className="template-panel">
        <div className="template-panel__group">
          <div className="template-panel__label">Object</div>
          <div className="template-panel__value">LAS</div>
        </div>
        <div className="tree-leaf"><span>Source</span><span>{well.source_las_path ?? 'unset'}</span></div>
        <div className="tree-leaf"><span>Curves</span><span>{curveCount}</span></div>
        <div className="tree-leaf"><span>Visible</span><span>{visibleCurveCount}</span></div>
        <div className="tree-leaf"><span>Depth range</span><span>{minDepth.toFixed(1)} - {maxDepth.toFixed(1)}</span></div>
      </div>
    )
  }

  if (selectedObject.type === 'curve') {
    if (!selectedCurveConfig || selectedCurveConfig.mnemonic !== selectedObject.mnemonic) {
      return <EmptyInspector message="Selected curve settings are not available yet." />
    }

    return (
      <div className="template-panel">
        <div className="template-panel__group">
          <div className="template-panel__label">Curve</div>
          <div className="template-panel__value">{selectedCurveConfig.mnemonic}</div>
        </div>
        <div className="tree-leaf"><span>Unit</span><span>{selectedCurveConfig.unit || '-'}</span></div>
        <label className="project-dialog__field">
          <span>Color</span>
          <input
            type="color"
            value={selectedCurveConfig.color}
            onChange={(event) => onCurveSettingUpdate(selectedCurveConfig.mnemonic, { color: event.target.value })}
          />
        </label>
        <div className="project-dialog__grid">
          <label className="project-dialog__field">
            <span>Min</span>
            <input
              value={selectedCurveConfig.scaleMin}
              onChange={(event) => onCurveSettingUpdate(selectedCurveConfig.mnemonic, { scaleMin: Number(event.target.value) })}
            />
          </label>
          <label className="project-dialog__field">
            <span>Max</span>
            <input
              value={selectedCurveConfig.scaleMax}
              onChange={(event) => onCurveSettingUpdate(selectedCurveConfig.mnemonic, { scaleMax: Number(event.target.value) })}
            />
          </label>
          <label className="project-dialog__field">
            <span>Line width</span>
            <input
              value={selectedCurveConfig.lineWidth}
              onChange={(event) => onCurveSettingUpdate(selectedCurveConfig.mnemonic, { lineWidth: Number(event.target.value) })}
            />
          </label>
          <label className="project-dialog__field">
            <span>Line style</span>
            <select
              value={selectedCurveConfig.lineStyle}
              onChange={(event) => onCurveSettingUpdate(selectedCurveConfig.mnemonic, {
                lineStyle: event.target.value as TrackConfig['curves'][number]['lineStyle'],
              })}
            >
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </label>
        </div>
      </div>
    )
  }

  if (selectedObject.type === 'tops-group') {
    if (!well || well.well_id !== selectedObject.wellId) {
      return <EmptyInspector message="Selected TOPS group is not loaded yet." />
    }

    return (
      <div className="template-panel">
        <div className="template-panel__group">
          <div className="template-panel__label">Object</div>
          <div className="template-panel__value">TOPS</div>
        </div>
        <div className="tree-leaf"><span>Total picks</span><span>{formations.length}</span></div>
        <div className="tree-leaf"><span>Visible picks</span><span>{visibleFormationIds.length}</span></div>
        <div className="tree-leaf">
          <span>Linked picks</span>
          <span>{formations.filter((formation) => Boolean(formation.active_strat_unit_name)).length}</span>
        </div>
      </div>
    )
  }

  if (selectedObject.type === 'top-pick') {
    if (!selectedFormation || selectedFormation.id !== selectedObject.formationId) {
      return <EmptyInspector message="Selected top pick is not loaded yet." />
    }

    return (
      <div className="template-panel">
        <div className="template-panel__group">
          <div className="template-panel__label">Top</div>
          <div className="template-panel__value">{selectedFormation.name}</div>
        </div>
        <label className="project-dialog__field">
          <span>Name</span>
          <input value={selectedFormation.name} onChange={(event) => void onFormationUpdate(selectedFormation.id, { name: event.target.value })} />
        </label>
        <div className="project-dialog__grid">
          <label className="project-dialog__field">
            <span>Depth</span>
            <input value={selectedFormation.depth_md} onChange={(event) => onFormationMove(selectedFormation.id, Number(event.target.value))} />
          </label>
          <label className="project-dialog__field">
            <span>Age</span>
            <input
              value={selectedFormation.age_ma ?? ''}
              onChange={(event) => void onFormationUpdate(selectedFormation.id, {
                age_ma: event.target.value ? Number(event.target.value) : undefined,
              })}
            />
          </label>
          <label className="project-dialog__field">
            <span>Type</span>
            <select value={selectedFormation.kind} onChange={(event) => void onFormationUpdate(selectedFormation.id, { kind: event.target.value })}>
              <option value="strat">strat</option>
              <option value="unconformity">unconformity</option>
            </select>
          </label>
          <label className="project-dialog__field">
            <span>Color</span>
            <input
              type="color"
              value={selectedFormation.color}
              onChange={(event) => void onFormationUpdate(selectedFormation.id, { color: event.target.value })}
            />
          </label>
        </div>
        <div className="tree-leaf"><span>Linked unit</span><span>{selectedFormation.active_strat_unit_name ?? 'Unlinked'}</span></div>
      </div>
    )
  }

  if (selectedObject.type === 'strat-chart') {
    if (!selectedChart || selectedChart.id !== selectedObject.chartId) {
      return <EmptyInspector message="Selected stratigraphic chart is not loaded yet." />
    }

    return (
      <div className="template-panel">
        <div className="template-panel__group">
          <div className="template-panel__label">Chart</div>
          <div className="template-panel__value">{selectedChart.name}</div>
        </div>
        <div className="tree-leaf"><span>Units</span><span>{selectedChart.unit_count}</span></div>
        <div className="tree-leaf"><span>Imported at</span><span>{new Date(selectedChart.imported_at).toLocaleString()}</span></div>
        <div className="tree-leaf"><span>Source</span><span>{selectedChart.source_path ?? 'unset'}</span></div>
        <div className="tree-leaf"><span>Kind</span><span>{selectedChart.is_builtin ? 'Built-in ICS' : 'Imported chart'}</span></div>
        <div className="tree-leaf"><span>State</span><span>{selectedChart.is_active ? 'Active' : 'Inactive'}</span></div>
      </div>
    )
  }

  return <EmptyInspector message="No editable settings are implemented for the selected object yet." />
}
