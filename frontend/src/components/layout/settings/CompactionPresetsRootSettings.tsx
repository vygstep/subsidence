import { useEffect, useState } from 'react'

import { useWellDataStore } from '@/stores'
import type { CompactionPresetDetail, CompactionPresetSummary } from '@/types'

type RowDraft = {
  name: string
  density: string
  porosity_surface: string
  compaction_coeff: string
}

function buildDraft(preset: CompactionPresetDetail): RowDraft {
  return {
    name: preset.name,
    density: preset.density.toFixed(0),
    porosity_surface: preset.porosity_surface.toFixed(3),
    compaction_coeff: preset.compaction_coeff.toFixed(3),
  }
}

function validateDraft(draft: RowDraft): boolean {
  return Boolean(
    draft.name.trim()
    && Number.isFinite(Number(draft.density))
    && Number.isFinite(Number(draft.porosity_surface))
    && Number.isFinite(Number(draft.compaction_coeff)),
  )
}

export function CompactionPresetsRootSettings({ presets }: { presets: CompactionPresetSummary[] }) {
  const fetchCompactionPreset = useWellDataStore((state) => state.fetchCompactionPreset)
  const updateCompactionPreset = useWellDataStore((state) => state.updateCompactionPreset)
  const [details, setDetails] = useState<CompactionPresetDetail[]>([])
  const [drafts, setDrafts] = useState<Record<number, RowDraft>>({})
  const [savingId, setSavingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setDetails([])
    setDrafts({})
    setError(null)
    void Promise.all(presets.map((preset) => fetchCompactionPreset(preset.id))).then((rows) => {
      if (cancelled) {
        return
      }
      const resolved = rows.filter((row): row is CompactionPresetDetail => row !== null)
      setDetails(resolved)
      setDrafts(
        Object.fromEntries(
          resolved.map((row) => [row.id, buildDraft(row)]),
        ),
      )
    })
    return () => {
      cancelled = true
    }
  }, [fetchCompactionPreset, presets])

  function updateDraft(presetId: number, field: keyof RowDraft, value: string) {
    setDrafts((current) => ({
      ...current,
      [presetId]: {
        ...(current[presetId] ?? { name: '', density: '', porosity_surface: '', compaction_coeff: '' }),
        [field]: value,
      },
    }))
    setError(null)
  }

  async function handleBlur(presetId: number) {
    const preset = details.find((row) => row.id === presetId)
    const draft = drafts[presetId]
    if (!preset || preset.is_builtin || !draft) {
      return
    }
    if (!validateDraft(draft)) {
      setError('Fill all required parameters')
      setDrafts((current) => ({ ...current, [presetId]: buildDraft(preset) }))
      return
    }
    const unchanged = (
      draft.name === preset.name
      && draft.density === preset.density.toFixed(0)
      && draft.porosity_surface === preset.porosity_surface.toFixed(3)
      && draft.compaction_coeff === preset.compaction_coeff.toFixed(3)
    )
    if (unchanged) {
      return
    }

    setSavingId(presetId)
    try {
      const updated = await updateCompactionPreset(presetId, {
        name: draft.name.trim(),
        density: Number(draft.density),
        porosity_surface: Number(draft.porosity_surface),
        compaction_coeff: Number(draft.compaction_coeff),
      })
      setDetails((current) => current.map((row) => (row.id === presetId ? updated : row)))
      setDrafts((current) => ({ ...current, [presetId]: buildDraft(updated) }))
      setError(null)
    } catch (nextError) {
      setError(String(nextError))
      setDrafts((current) => ({ ...current, [presetId]: buildDraft(preset) }))
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Compaction Presets</div>
        <div className="template-panel__value">{presets.length}</div>
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
            {details.map((preset) => {
              const draft = drafts[preset.id] ?? buildDraft(preset)
              return (
                <tr key={preset.id} className={preset.is_builtin ? 'dm-table__row--builtin' : ''}>
                  <td>{preset.id}</td>
                  <td title={`${preset.id} ${preset.name} [${preset.origin}]`}>
                    {preset.is_builtin ? (
                      draft.name
                    ) : (
                      <input
                        className="dm-table__input"
                        value={draft.name}
                        onChange={(event) => updateDraft(preset.id, 'name', event.target.value)}
                        onBlur={() => void handleBlur(preset.id)}
                      />
                    )}
                  </td>
                  <td>
                    {preset.is_builtin ? (
                      draft.density
                    ) : (
                      <input
                        className="dm-table__input dm-table__input--num"
                        value={draft.density}
                        onChange={(event) => updateDraft(preset.id, 'density', event.target.value)}
                        onBlur={() => void handleBlur(preset.id)}
                      />
                    )}
                  </td>
                  <td>
                    {preset.is_builtin ? (
                      draft.porosity_surface
                    ) : (
                      <input
                        className="dm-table__input dm-table__input--num"
                        value={draft.porosity_surface}
                        onChange={(event) => updateDraft(preset.id, 'porosity_surface', event.target.value)}
                        onBlur={() => void handleBlur(preset.id)}
                      />
                    )}
                  </td>
                  <td>
                    {preset.is_builtin ? (
                      draft.compaction_coeff
                    ) : (
                      <input
                        className="dm-table__input dm-table__input--num"
                        value={draft.compaction_coeff}
                        onChange={(event) => updateDraft(preset.id, 'compaction_coeff', event.target.value)}
                        onBlur={() => void handleBlur(preset.id)}
                      />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {savingId !== null ? <p className="sidebar-panel__empty">{`Saving preset ${savingId}...`}</p> : null}
      {error ? <p className="project-dialog__error">{error}</p> : null}
    </div>
  )
}
