import type { ImportWizardWellOption } from './types'

interface ImportWizardTargetWellExtraOption {
  value: string
  label: string
}

interface ImportWizardTargetWellSelectProps {
  value: string
  wells: ImportWizardWellOption[]
  onChange: (value: string) => void
  emptyLabel?: string
  extraOptions?: ImportWizardTargetWellExtraOption[]
}

export const IMPORT_WIZARD_CREATE_NEW_WELL = '__create_new__'

export function ImportWizardTargetWellSelect({
  value,
  wells,
  onChange,
  emptyLabel,
  extraOptions = [],
}: ImportWizardTargetWellSelectProps) {
  return (
    <label className="project-dialog__field project-dialog__field--inline import-wizard__field">
      <span>Target well</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {emptyLabel ? <option value="">{emptyLabel}</option> : null}
        {extraOptions.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
        {wells.map((well) => (
          <option key={well.well_id} value={well.well_id}>{well.well_name}</option>
        ))}
        <option value={IMPORT_WIZARD_CREATE_NEW_WELL}>Create new well</option>
      </select>
    </label>
  )
}
