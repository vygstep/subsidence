import { useWellDataStore, useWorkspaceStore } from '@/stores'
import type { FormationTop } from '@/types'

interface TopPickSettingsProps {
  selectedFormation: FormationTop
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
}

export function TopPickSettings({ selectedFormation, onFormationUpdate, onFormationMove }: TopPickSettingsProps) {
  const wellId = useWellDataStore((state) => state.well?.well_id)
  const updateWellViewState = useWorkspaceStore((state) => state.updateWellViewState)
  const labelHidden = useWorkspaceStore((state) => {
    const view = wellId ? state.wellViewStates[wellId] : null
    return view?.hiddenTopLabelIds?.includes(selectedFormation.id) ?? false
  })

  const handleToggleLabel = (show: boolean) => {
    if (!wellId) return
    updateWellViewState(wellId, (state) => ({
      ...state,
      hiddenTopLabelIds: show
        ? state.hiddenTopLabelIds.filter((id) => id !== selectedFormation.id)
        : [...state.hiddenTopLabelIds, selectedFormation.id],
    }))
  }

  const isUnconformity = selectedFormation.kind === 'unconformity'

  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Top</div>
        <div className="template-panel__value">{selectedFormation.name}</div>
      </div>
      <label className="project-dialog__field">
        <span>Name</span>
        <input
          value={selectedFormation.name}
          onChange={(event) => void onFormationUpdate(selectedFormation.id, { name: event.target.value })}
        />
      </label>
      <div className="project-dialog__grid">
        <label className="project-dialog__field">
          <span>Depth (MD)</span>
          <input
            type="number"
            step="0.1"
            value={selectedFormation.depth_md ?? ''}
            onChange={(event) => onFormationMove(selectedFormation.id, Number(event.target.value))}
          />
        </label>
        <label className="project-dialog__field">
          <span>Kind</span>
          <select
            value={selectedFormation.kind}
            onChange={(event) => void onFormationUpdate(selectedFormation.id, { kind: event.target.value })}
          >
            <option value="strat">Conformable</option>
            <option value="unconformity">Unconformity</option>
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
        <label className="project-dialog__field">
          <span>{isUnconformity ? 'Top age (Ma)' : 'Age (Ma)'}</span>
          <input
            type="number"
            step="0.01"
            value={selectedFormation.age_ma ?? ''}
            onChange={(event) => void onFormationUpdate(selectedFormation.id, {
              age_ma: event.target.value ? Number(event.target.value) : undefined,
            })}
          />
        </label>
        {isUnconformity && (
          <label className="project-dialog__field">
            <span>Base age (Ma)</span>
            <input
              type="number"
              step="0.01"
              value={selectedFormation.age_base_ma ?? ''}
              onChange={(event) => void onFormationUpdate(selectedFormation.id, {
                age_base_ma: event.target.value ? Number(event.target.value) : undefined,
              })}
            />
          </label>
        )}
        <label className="project-dialog__field">
          <span>Paleobathymetry (m)</span>
          <input
            type="number"
            step="1"
            value={selectedFormation.water_depth_m}
            onChange={(event) => void onFormationUpdate(selectedFormation.id, { water_depth_m: Number(event.target.value) })}
          />
        </label>
        {isUnconformity && (
          <label className="project-dialog__field">
            <span>Eroded thickness (m)</span>
            <input
              type="number"
              min="0"
              step="1"
              value={selectedFormation.eroded_thickness_m}
              onChange={(event) => void onFormationUpdate(selectedFormation.id, { eroded_thickness_m: Number(event.target.value) })}
            />
          </label>
        )}
      </div>
      <label className="project-dialog__field project-dialog__field--inline">
        <input
          type="checkbox"
          checked={!labelHidden}
          onChange={(event) => handleToggleLabel(event.target.checked)}
        />
        <span>Show label on track</span>
      </label>
      <div className="tree-leaf">
        <span>Linked unit</span>
        <span>{selectedFormation.active_strat_unit_name ?? 'Unlinked'}</span>
      </div>
    </div>
  )
}
