import { useState } from 'react'

import { useWellDataStore, useWorkspaceStore } from '@/stores'

type DraftState = {
  name: string
  density: string
  porosity_surface: string
  compaction_coeff: string
}

const initialDraft: DraftState = {
  name: '',
  density: '',
  porosity_surface: '',
  compaction_coeff: '',
}

function validateDraft(draft: DraftState): string | null {
  if (!draft.name.trim()) {
    return 'Fill all required parameters'
  }
  const numericFields = [draft.density, draft.porosity_surface, draft.compaction_coeff]
  if (numericFields.some((value) => !Number.isFinite(Number(value)))) {
    return 'Fill all required parameters'
  }
  return null
}

export function CompactionPresetDraftSettings() {
  const createCompactionPreset = useWellDataStore((state) => state.createCompactionPreset)
  const setSelectedObject = useWorkspaceStore((state) => state.setSelectedObject)
  const [draft, setDraft] = useState<DraftState>(initialDraft)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  function updateField(field: keyof DraftState, value: string) {
    setDraft((current) => ({ ...current, [field]: value }))
    setError(null)
  }

  async function handleSave() {
    const validationError = validateDraft(draft)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSaving(true)
    try {
      const created = await createCompactionPreset({
        name: draft.name.trim(),
        density: Number(draft.density),
        porosity_surface: Number(draft.porosity_surface),
        compaction_coeff: Number(draft.compaction_coeff),
      })
      setSelectedObject({ type: 'compaction-preset', presetId: created.id })
    } catch (nextError) {
      setError(String(nextError))
    } finally {
      setIsSaving(false)
    }
  }

  function handleCancel() {
    setSelectedObject({ type: 'compaction-presets-root' })
  }

  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Compaction Preset</div>
        <div className="template-panel__value">New preset</div>
      </div>
      <div className="dm-table-wrapper">
        <table className="dm-table dm-table--numeric">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Density</th>
              <th>Phi0</th>
              <th>C</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>New</td>
              <td>
                <input
                  className="dm-table__input"
                  value={draft.name}
                  onChange={(event) => updateField('name', event.target.value)}
                />
              </td>
              <td>
                <input
                  className="dm-table__input dm-table__input--num"
                  value={draft.density}
                  onChange={(event) => updateField('density', event.target.value)}
                />
              </td>
              <td>
                <input
                  className="dm-table__input dm-table__input--num"
                  value={draft.porosity_surface}
                  onChange={(event) => updateField('porosity_surface', event.target.value)}
                />
              </td>
              <td>
                <input
                  className="dm-table__input dm-table__input--num"
                  value={draft.compaction_coeff}
                  onChange={(event) => updateField('compaction_coeff', event.target.value)}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {error ? <p className="project-dialog__error">{error}</p> : null}
      <div className="template-settings__actions">
        <button type="button" className="project-dialog__button" onClick={handleCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="project-dialog__button project-dialog__button--primary"
          onClick={() => void handleSave()}
          disabled={isSaving}
        >
          Save
        </button>
      </div>
    </div>
  )
}
