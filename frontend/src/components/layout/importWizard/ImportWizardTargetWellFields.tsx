import type { ImportWizardWellOption } from './types'

interface ImportWizardTargetWellFieldsProps {
  wells: ImportWizardWellOption[]
  wellId: string
  createNewWell: boolean
  emptyLabel: string
  /** When set, shows a policy toggle: use file's well name vs override with the target well dropdown. */
  fileWellSource?: string | null
  wellPolicy?: 'file' | 'override'
  onWellIdChange: (wellId: string) => void
  onCreateNewWellChange: (createNewWell: boolean) => void
  onWellPolicyChange?: (policy: 'file' | 'override') => void
}

export function ImportWizardTargetWellFields({
  wells,
  wellId,
  createNewWell,
  emptyLabel,
  fileWellSource,
  wellPolicy = 'override',
  onWellIdChange,
  onCreateNewWellChange,
  onWellPolicyChange,
}: ImportWizardTargetWellFieldsProps) {
  const useFileWell = fileWellSource && wellPolicy === 'file'

  return (
    <>
      {fileWellSource ? (
        <div className="project-dialog__field">
          <span>Target well</span>
          <div className="import-well-policy">
            <label className="project-dialog__checkbox">
              <input
                type="radio"
                name="well-policy"
                value="file"
                checked={wellPolicy === 'file'}
                onChange={() => onWellPolicyChange?.('file')}
              />
              <span>Use file well name: <em>{fileWellSource}</em></span>
            </label>
            <label className="project-dialog__checkbox">
              <input
                type="radio"
                name="well-policy"
                value="override"
                checked={wellPolicy === 'override'}
                onChange={() => onWellPolicyChange?.('override')}
              />
              <span>Override with target well</span>
            </label>
            {wellPolicy === 'override' ? (
              <select aria-label="Target well" value={wellId} onChange={(event) => onWellIdChange(event.target.value)}>
                <option value="">{emptyLabel}</option>
                {wells.map((well) => (
                  <option key={well.well_id} value={well.well_id}>{well.well_name}</option>
                ))}
              </select>
            ) : null}
          </div>
        </div>
      ) : (
        <label className="project-dialog__field">
          <span>Target well</span>
          <select value={wellId} onChange={(event) => onWellIdChange(event.target.value)}>
            <option value="">{emptyLabel}</option>
            {wells.map((well) => (
              <option key={well.well_id} value={well.well_id}>{well.well_name}</option>
            ))}
          </select>
        </label>
      )}

      {!useFileWell ? (
        <label className="project-dialog__checkbox">
          <input
            type="checkbox"
            checked={createNewWell}
            disabled={Boolean(wellId)}
            onChange={(event) => onCreateNewWellChange(event.target.checked)}
          />
          <span>Create new well if a matching well already exists</span>
        </label>
      ) : null}
    </>
  )
}
