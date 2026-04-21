import { useEffect, useState } from 'react'

import type { SelectedObject } from '@/stores/workspaceStore'
import { useViewStore, useWellDataStore } from '@/stores'
import type { CompactionModel, FormationTop, LithologyParam, StratChartInfo, TrackConfig, Well } from '@/types'

import { CurveBrowser } from './CurveBrowser'
import { FormationTopsList } from './FormationTopsList'

function CompactionModelInspector({ model }: { model: CompactionModel }) {
  const fetchCompactionModelParams = useWellDataStore((state) => state.fetchCompactionModelParams)
  const updateCompactionModelParam = useWellDataStore((state) => state.updateCompactionModelParam)
  const renameCompactionModel = useWellDataStore((state) => state.renameCompactionModel)

  const [params, setParams] = useState<LithologyParam[]>([])
  const [nameDraft, setNameDraft] = useState(model.name)

  useEffect(() => {
    setNameDraft(model.name)
  }, [model.name])

  useEffect(() => {
    void fetchCompactionModelParams(model.id).then(setParams)
  }, [model.id, fetchCompactionModelParams])

  async function handleParamBlur(lithologyCode: string, field: 'density' | 'porosity_surface' | 'compaction_coeff', value: string) {
    const num = parseFloat(value)
    if (!Number.isFinite(num)) return
    try {
      const updated = await updateCompactionModelParam(model.id, lithologyCode, { [field]: num })
      setParams((prev) => prev.map((p) => (p.lithology_code === lithologyCode ? { ...p, ...updated } : p)))
      const { useComputedStore } = await import('@/stores/computedStore')
      useComputedStore.getState().triggerRecalculation()
    } catch (err) {
      window.alert(String(err))
    }
  }

  async function handleRenameBlur() {
    const trimmed = nameDraft.trim()
    if (!trimmed || trimmed === model.name) return
    try {
      await renameCompactionModel(model.id, trimmed)
    } catch (err) {
      window.alert(String(err))
      setNameDraft(model.name)
    }
  }

  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Model</div>
        <div className="template-panel__value">{model.name}</div>
      </div>
      {model.is_builtin ? (
        <div className="tree-leaf"><span>Kind</span><span>Built-in (read-only)</span></div>
      ) : (
        <label className="project-dialog__field">
          <span>Name</span>
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => void handleRenameBlur()}
          />
        </label>
      )}
      <div className="template-panel__group" style={{ marginTop: 8 }}>
        <div className="template-panel__label">Lithology parameters</div>
      </div>
      <div className="compaction-table-wrapper">
        <table className="compaction-table">
          <thead>
            <tr>
              <th>Lithology</th>
              <th title="Grain density kg/m³">ρ</th>
              <th title="Surface porosity (fraction)">φ₀</th>
              <th title="Compaction coefficient km⁻¹">c</th>
            </tr>
          </thead>
          <tbody>
            {params.map((p) => (
              <tr key={p.lithology_code}>
                <td title={p.display_name}>{p.lithology_code}</td>
                {model.is_builtin ? (
                  <>
                    <td>{p.density.toFixed(0)}</td>
                    <td>{p.porosity_surface.toFixed(3)}</td>
                    <td>{p.compaction_coeff.toFixed(3)}</td>
                  </>
                ) : (
                  <>
                    <td>
                      <input
                        className="compaction-table__input"
                        defaultValue={p.density.toFixed(0)}
                        key={`${p.lithology_code}-density-${p.density}`}
                        onBlur={(e) => void handleParamBlur(p.lithology_code, 'density', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="compaction-table__input"
                        defaultValue={p.porosity_surface.toFixed(3)}
                        key={`${p.lithology_code}-phi-${p.porosity_surface}`}
                        onBlur={(e) => void handleParamBlur(p.lithology_code, 'porosity_surface', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="compaction-table__input"
                        defaultValue={p.compaction_coeff.toFixed(3)}
                        key={`${p.lithology_code}-c-${p.compaction_coeff}`}
                        onBlur={(e) => void handleParamBlur(p.lithology_code, 'compaction_coeff', e.target.value)}
                      />
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

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
  selectedCompactionModel: CompactionModel | null
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
  curveCount,
  visibleCurveCount,
  minDepth,
  maxDepth,
}: SettingsInspectorProps) {
  const depthTrackConfig = useViewStore((state) => state.depthTrackConfig)
  const updateDepthTrackConfig = useViewStore((state) => state.updateDepthTrackConfig)

  if (!selectedObject) {
    return <EmptyInspector message="Select an object in Data Manager to inspect its settings." />
  }

  if (selectedObject.type === 'depth-track') {
    if (!well || well.well_id !== selectedObject.wellId) {
      return <EmptyInspector message="Selected DEPTH track settings are not loaded yet." />
    }

    return (
      <div className="template-panel">
        <div className="template-panel__group">
          <div className="template-panel__label">Track</div>
          <div className="template-panel__value">DEPTH</div>
        </div>
        <div className="tree-leaf"><span>Depth reference</span><span>{well.depth_reference}</span></div>
        <label className="project-dialog__field">
          <span>Background color</span>
          <input
            type="color"
            value={depthTrackConfig.backgroundColor}
            onChange={(event) => updateDepthTrackConfig({ backgroundColor: event.target.value })}
          />
        </label>
        <div className="project-dialog__grid">
          <label className="project-dialog__field">
            <span>Units</span>
            <select
              value={depthTrackConfig.unit}
              onChange={(event) => updateDepthTrackConfig({ unit: event.target.value as 'm' | 'km' | 'ft' })}
            >
              <option value="m">m</option>
              <option value="km">km</option>
              <option value="ft">ft</option>
            </select>
          </label>
          <label className="project-dialog__field">
            <span>Major ticks</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={depthTrackConfig.majorInterval}
              onChange={(event) => updateDepthTrackConfig({ majorInterval: Number(event.target.value) })}
            />
          </label>
          <label className="project-dialog__field">
            <span>Minor ticks</span>
            <input
              type="number"
              min="0.001"
              step="0.001"
              value={depthTrackConfig.minorInterval}
              onChange={(event) => updateDepthTrackConfig({ minorInterval: Number(event.target.value) })}
            />
          </label>
        </div>
      </div>
    )
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
            <span>Project X</span>
            <input value={wellInspectorDraft.x} onChange={(event) => onWellInspectorDraftChange('x', event.target.value)} />
          </label>
          <label className="project-dialog__field">
            <span>Project Y</span>
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
      return <EmptyInspector message="Selected logs group is not loaded yet." />
    }

    return (
      <div className="template-panel">
        <div className="template-panel__group">
          <div className="template-panel__label">Object</div>
          <div className="template-panel__value">Logs</div>
        </div>
        <div className="tree-leaf"><span>Source</span><span>{well.source_las_path ?? 'mixed / unset'}</span></div>
        <div className="tree-leaf"><span>Curves</span><span>{curveCount}</span></div>
        <div className="tree-leaf"><span>Visible</span><span>{visibleCurveCount}</span></div>
        <div className="tree-leaf"><span>Depth range</span><span>{minDepth.toFixed(1)} - {maxDepth.toFixed(1)}</span></div>
        <div className="template-panel__group" style={{ marginTop: 8 }}>
          <div className="template-panel__label">Add to viewer</div>
        </div>
        <CurveBrowser />
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
        <FormationTopsList />
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

  if (selectedObject.type === 'compaction-model') {
    if (!selectedCompactionModel || selectedCompactionModel.id !== selectedObject.modelId) {
      return <EmptyInspector message="Selected compaction model is not loaded yet." />
    }
    return <CompactionModelInspector model={selectedCompactionModel} />
  }

  return <EmptyInspector message="No editable settings are implemented for the selected object yet." />
}
