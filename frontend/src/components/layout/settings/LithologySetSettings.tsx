import { useEffect, useState } from 'react'

import { useWellDataStore, useWorkspaceStore } from '@/stores'
import type { LithologySetDetail, LithologySetSummary } from '@/types'

function formatOrDash(value: number | null, digits: number): string {
  return value === null ? '-' : value.toFixed(digits)
}

export function LithologySetSettings({ lithologySet }: { lithologySet: LithologySetSummary }) {
  const compactionPresets = useWellDataStore((state) => state.compactionPresets)
  const fetchLithologySet = useWellDataStore((state) => state.fetchLithologySet)
  const copyLithologySet = useWellDataStore((state) => state.copyLithologySet)
  const loadLithologySets = useWellDataStore((state) => state.loadLithologySets)
  const updateLithologySet = useWellDataStore((state) => state.updateLithologySet)
  const deleteLithologySet = useWellDataStore((state) => state.deleteLithologySet)
  const createLithologySetEntry = useWellDataStore((state) => state.createLithologySetEntry)
  const updateLithologySetEntry = useWellDataStore((state) => state.updateLithologySetEntry)
  const deleteLithologySetEntry = useWellDataStore((state) => state.deleteLithologySetEntry)
  const setSelectedObject = useWorkspaceStore((state) => state.setSelectedObject)

  const [detail, setDetail] = useState<LithologySetDetail | null>(null)

  async function reloadSet() {
    const next = await fetchLithologySet(lithologySet.id)
    setDetail(next)
  }

  useEffect(() => {
    let cancelled = false
    setDetail(null)
    void fetchLithologySet(lithologySet.id).then((next) => {
      if (!cancelled) {
        setDetail(next)
      }
    })
    return () => {
      cancelled = true
    }
  }, [fetchLithologySet, lithologySet.id])

  async function handleCopy() {
    try {
      const copied = await copyLithologySet(lithologySet.id)
      await loadLithologySets()
      setSelectedObject({ type: 'lithology-set', setId: copied.id })
    } catch (error) {
      window.alert(String(error))
    }
  }

  async function handleRename() {
    const nextName = window.prompt('Rename lithology set', resolved.name)?.trim()
    if (!nextName) return
    try {
      const updated = await updateLithologySet(lithologySet.id, { name: nextName })
      setDetail((current) => (current ? { ...current, name: updated.name } : current))
    } catch (error) {
      window.alert(String(error))
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete lithology set "${resolved.name}"?`)) return
    try {
      await deleteLithologySet(lithologySet.id)
      setSelectedObject({ type: 'lithologies-root' })
    } catch (error) {
      window.alert(String(error))
    }
  }

  async function handleAddRow() {
    try {
      await createLithologySetEntry(lithologySet.id)
      await reloadSet()
    } catch (error) {
      window.alert(String(error))
    }
  }

  async function handleEntryBlur(
    entryId: number,
    field: 'lithology_code' | 'display_name' | 'color_hex' | 'pattern_id',
    value: string,
  ) {
    try {
      const updated = await updateLithologySetEntry(lithologySet.id, entryId, {
        [field]: field === 'pattern_id' ? (value.trim() || null) : value,
      })
      setDetail((current) => (
        current
          ? {
            ...current,
            entries: current.entries.map((entry) => (entry.id === updated.id ? updated : entry)),
          }
          : current
      ))
    } catch (error) {
      window.alert(String(error))
      await reloadSet()
    }
  }

  async function handlePresetChange(entryId: number, value: string) {
    try {
      const updated = await updateLithologySetEntry(lithologySet.id, entryId, {
        compaction_preset_id: value ? Number(value) : null,
      })
      setDetail((current) => (
        current
          ? {
            ...current,
            entries: current.entries.map((entry) => (entry.id === updated.id ? updated : entry)),
          }
          : current
      ))
    } catch (error) {
      window.alert(String(error))
      await reloadSet()
    }
  }

  async function handleDeleteRow(entryId: number, lithologyName: string) {
    if (!window.confirm(`Delete lithology row "${lithologyName}"?`)) return
    try {
      await deleteLithologySetEntry(lithologySet.id, entryId)
      setDetail((current) => (
        current
          ? {
            ...current,
            entry_count: Math.max(0, current.entry_count - 1),
            entries: current.entries.filter((entry) => entry.id !== entryId),
          }
          : current
      ))
    } catch (error) {
      window.alert(String(error))
      await reloadSet()
    }
  }

  const resolved = detail ?? { ...lithologySet, entries: [] }

  return (
    <div className={`template-panel ${resolved.is_builtin ? 'template-panel--muted' : ''}`}>
      <div className="template-panel__group">
        <div className="template-panel__label">Lithology Set</div>
        <div className="template-panel__value">{resolved.name}</div>
      </div>
      <div className="template-table-wrapper">
        <table className="template-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Color</th>
              <th>Pattern</th>
              <th>Compaction preset</th>
              <th>Density</th>
              <th>Phi0</th>
              <th>C</th>
              {!resolved.is_builtin ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {resolved.entries.map((entry) => (
              <tr key={entry.id}>
                <td>
                  {resolved.is_builtin ? (
                    entry.lithology_code
                  ) : (
                    <input
                      className="template-table__input"
                      defaultValue={entry.lithology_code}
                      key={`${entry.id}-code-${entry.lithology_code}`}
                      onBlur={(event) => void handleEntryBlur(entry.id, 'lithology_code', event.target.value)}
                    />
                  )}
                </td>
                <td>
                  {resolved.is_builtin ? (
                    entry.display_name
                  ) : (
                    <input
                      className="template-table__input"
                      defaultValue={entry.display_name}
                      key={`${entry.id}-name-${entry.display_name}`}
                      onBlur={(event) => void handleEntryBlur(entry.id, 'display_name', event.target.value)}
                    />
                  )}
                </td>
                <td>
                  {resolved.is_builtin ? (
                    <>
                      <span className="template-color-chip" style={{ backgroundColor: entry.color_hex }} />
                      {entry.color_hex}
                    </>
                  ) : (
                    <input
                      className="template-table__input"
                      defaultValue={entry.color_hex}
                      key={`${entry.id}-color-${entry.color_hex}`}
                      onBlur={(event) => void handleEntryBlur(entry.id, 'color_hex', event.target.value)}
                    />
                  )}
                </td>
                <td>
                  {resolved.is_builtin ? (
                    entry.pattern_id ?? 'Solid fill'
                  ) : (
                    <input
                      className="template-table__input"
                      defaultValue={entry.pattern_id ?? ''}
                      key={`${entry.id}-pattern-${entry.pattern_id ?? ''}`}
                      onBlur={(event) => void handleEntryBlur(entry.id, 'pattern_id', event.target.value)}
                    />
                  )}
                </td>
                <td>
                  {resolved.is_builtin ? (
                    entry.compaction_preset_label ?? '-'
                  ) : (
                    <select
                      className="template-table__select"
                      value={entry.compaction_preset_id ?? ''}
                      onChange={(event) => void handlePresetChange(entry.id, event.target.value)}
                    >
                      <option value="">-</option>
                      {compactionPresets.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {`${preset.id} ${preset.name} [${preset.origin}]`}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td>{formatOrDash(entry.density, 0)}</td>
                <td>{formatOrDash(entry.porosity_surface, 2)}</td>
                <td>{formatOrDash(entry.compaction_coeff, 3)}</td>
                {!resolved.is_builtin ? (
                  <td>
                    <button
                      type="button"
                      className="dm-action dm-action--danger"
                      onClick={() => void handleDeleteRow(entry.id, entry.display_name)}
                    >
                      Delete
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="template-settings__actions">
        {!resolved.is_builtin ? (
          <>
            <button type="button" className="project-dialog__button" onClick={() => void handleRename()}>
              Rename
            </button>
            <button type="button" className="project-dialog__button" onClick={() => void handleDelete()}>
              Delete
            </button>
            <button type="button" className="project-dialog__button" onClick={() => void handleAddRow()}>
              + Add lithology row
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="project-dialog__button project-dialog__button--primary"
          onClick={() => void handleCopy()}
        >
          Make copy
        </button>
      </div>
      <p className="sidebar-panel__empty">
        {resolved.is_builtin
          ? 'Default Lithologies is read-only.'
          : 'Rows save when an edited cell loses focus.'}
      </p>
    </div>
  )
}
