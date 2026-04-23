import type { FormationTop } from '@/types'

interface TopPickSettingsProps {
  selectedFormation: FormationTop
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
}

export function TopPickSettings({ selectedFormation, onFormationUpdate, onFormationMove }: TopPickSettingsProps) {
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
          <span>Depth</span>
          <input
            value={selectedFormation.depth_md}
            onChange={(event) => onFormationMove(selectedFormation.id, Number(event.target.value))}
          />
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
          <select
            value={selectedFormation.kind}
            onChange={(event) => void onFormationUpdate(selectedFormation.id, { kind: event.target.value })}
          >
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
        <label className="project-dialog__field">
          <span>Water depth (m)</span>
          <input
            type="number"
            min="0"
            step="1"
            value={selectedFormation.water_depth_m}
            onChange={(event) => void onFormationUpdate(selectedFormation.id, { water_depth_m: Number(event.target.value) })}
          />
        </label>
        {selectedFormation.kind === 'unconformity' && (
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
      <div className="tree-leaf">
        <span>Linked unit</span>
        <span>{selectedFormation.active_strat_unit_name ?? 'Unlinked'}</span>
      </div>
    </div>
  )
}
