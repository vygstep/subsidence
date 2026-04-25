import type { ImportWizardWellOption } from './types'

interface ImportWizardTargetWellFieldsProps {
  wells: ImportWizardWellOption[]
  wellId: string
  createNewWell: boolean
  emptyLabel: string
  onWellIdChange: (wellId: string) => void
  onCreateNewWellChange: (createNewWell: boolean) => void
}

export function ImportWizardTargetWellFields({
  wells,
  wellId,
  createNewWell,
  emptyLabel,
  onWellIdChange,
  onCreateNewWellChange,
}: ImportWizardTargetWellFieldsProps) {
  return (
    <>
      <label className="project-dialog__field">
        <span>Target well</span>
        <select value={wellId} onChange={(event) => onWellIdChange(event.target.value)}>
          <option value="">{emptyLabel}</option>
          {wells.map((well) => (
            <option key={well.well_id} value={well.well_id}>{well.well_name}</option>
          ))}
        </select>
      </label>

      <label className="project-dialog__checkbox">
        <input
          type="checkbox"
          checked={createNewWell}
          disabled={Boolean(wellId)}
          onChange={(event) => onCreateNewWellChange(event.target.checked)}
        />
        <span>Create new well if a matching well already exists</span>
      </label>
    </>
  )
}
