import { useEffect, useMemo, useState } from 'react'

import { useWellDataStore, useWorkspaceStore } from '@/stores'
import type { CompactionPresetDetail, CompactionPresetSummary } from '@/types'

type PresetDraft = {
  name: string
  density: string
  porosity_surface: string
  compaction_coeff: string
}

function buildDraft(detail: CompactionPresetDetail): PresetDraft {
  return {
    name: detail.name,
    density: detail.density.toFixed(0),
    porosity_surface: detail.porosity_surface.toFixed(3),
    compaction_coeff: detail.compaction_coeff.toFixed(3),
  }
}

function validateDraft(draft: PresetDraft): string | null {
  if (!draft.name.trim()) {
    return 'Fill all required parameters'
  }
  const numericFields = [draft.density, draft.porosity_surface, draft.compaction_coeff]
  if (numericFields.some((value) => !Number.isFinite(Number(value)))) {
    return 'Fill all required parameters'
  }
  return null
}

export function CompactionPresetSettings({ preset }: { preset: CompactionPresetSummary }) {
  const fetchCompactionPreset = useWellDataStore((state) => state.fetchCompactionPreset)
  const updateCompactionPreset = useWellDataStore((state) => state.updateCompactionPreset)
  const createCompactionPreset = useWellDataStore((state) => state.createCompactionPreset)
  const setSelectedObject = useWorkspaceStore((state) => state.setSelectedObject)

  const [detail, setDetail] = useState<CompactionPresetDetail | null>(null)
  const [draft, setDraft] = useState<PresetDraft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setDetail(null)
    setDraft(null)
    setError(null)
    void fetchCompactionPreset(preset.id).then((next) => {
      if (!cancelled && next) {
        setDetail(next)
        setDraft(buildDraft(next))
      }
    })
    return () => {
      cancelled = true
    }
  }, [fetchCompactionPreset, preset.id])

  const resolved = detail ?? {
    ...preset,
    description: null,
    density: 0,
    porosity_surface: 0,
    compaction_coeff: 0,
  }
  const currentDraft = draft ?? buildDraft(resolved)
  const isDirty = detail !== null && (
    currentDraft.name !== detail.name
    || currentDraft.density !== detail.density.toFixed(0)
    || currentDraft.porosity_surface !== detail.porosity_surface.toFixed(3)
    || currentDraft.compaction_coeff !== detail.compaction_coeff.toFixed(3)
  )
  const saveDisabled = useMemo(() => validateDraft(currentDraft) !== null || !isDirty || isSaving, [currentDraft, isDirty, isSaving])

  function updateDraftField(field: keyof PresetDraft, value: string) {
    setDraft((current) => ({
      ...(current ?? currentDraft),
      [field]: value,
    }))
    setError(null)
  }

  async function handleSave() {
    const validationError = validateDraft(currentDraft)
    if (validationError) {
      setError(validationError)
      return
    }
    if (!detail) {
      return
    }

    setIsSaving(true)
    try {
      const updated = await updateCompactionPreset(detail.id, {
        name: currentDraft.name.trim(),
        density: Number(currentDraft.density),
        porosity_surface: Number(currentDraft.porosity_surface),
        compaction_coeff: Number(currentDraft.compaction_coeff),
      })
      setDetail(updated)
      setDraft(buildDraft(updated))
      setError(null)
    } catch (nextError) {
      setError(String(nextError))
    } finally {
      setIsSaving(false)
    }
  }

  function handleCancel() {
    if (!detail) {
      return
    }
    setDraft(buildDraft(detail))
    setError(null)
  }

  async function handleMakeCopy() {
    setIsSaving(true)
    try {
      const created = await createCompactionPreset({ cloneFromId: preset.id })
      setSelectedObject({ type: 'compaction-preset', presetId: created.id })
    } catch (nextError) {
      setError(String(nextError))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className={`template-panel ${resolved.is_builtin ? 'template-panel--muted' : ''}`}>
      <div className="template-panel__group">
        <div className="template-panel__label">Compaction Preset</div>
        <div className="template-panel__value">{`${resolved.id} ${resolved.name} [${resolved.origin}]`}</div>
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
            <tr className={resolved.is_builtin ? 'dm-table__row--builtin' : ''}>
              <td>{resolved.id}</td>
              <td>
                {resolved.is_builtin ? (
                  currentDraft.name
                ) : (
                  <input
                    className="dm-table__input"
                    value={currentDraft.name}
                    onChange={(event) => updateDraftField('name', event.target.value)}
                  />
                )}
              </td>
              <td>
                {resolved.is_builtin ? (
                  currentDraft.density
                ) : (
                  <input
                    className="dm-table__input dm-table__input--num"
                    value={currentDraft.density}
                    onChange={(event) => updateDraftField('density', event.target.value)}
                  />
                )}
              </td>
              <td>
                {resolved.is_builtin ? (
                  currentDraft.porosity_surface
                ) : (
                  <input
                    className="dm-table__input dm-table__input--num"
                    value={currentDraft.porosity_surface}
                    onChange={(event) => updateDraftField('porosity_surface', event.target.value)}
                  />
                )}
              </td>
              <td>
                {resolved.is_builtin ? (
                  currentDraft.compaction_coeff
                ) : (
                  <input
                    className="dm-table__input dm-table__input--num"
                    value={currentDraft.compaction_coeff}
                    onChange={(event) => updateDraftField('compaction_coeff', event.target.value)}
                  />
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {error ? <p className="project-dialog__error">{error}</p> : null}
      <div className="template-settings__actions">
        {!resolved.is_builtin ? (
          <button type="button" className="project-dialog__button" onClick={handleCancel}>
            Cancel
          </button>
        ) : null}
        {!resolved.is_builtin ? (
          <button
            type="button"
            className="project-dialog__button project-dialog__button--primary"
            onClick={() => void handleSave()}
            disabled={saveDisabled}
          >
            Save
          </button>
        ) : null}
        <button
          type="button"
          className="project-dialog__button project-dialog__button--primary"
          onClick={() => void handleMakeCopy()}
          disabled={isSaving}
        >
          Make copy
        </button>
      </div>
    </div>
  )
}
