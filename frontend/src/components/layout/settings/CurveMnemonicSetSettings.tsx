import { Fragment, useEffect, useState } from 'react'

import { useWellDataStore, useWorkspaceStore } from '@/stores'
import type { CurveMnemonicEntryItem, CurveMnemonicSetDetail, CurveMnemonicSetSummary } from '@/types'

type TextField = 'pattern' | 'family_code' | 'canonical_mnemonic' | 'canonical_unit'
type EntryPatch = {
  pattern?: string
  is_regex?: boolean
  priority?: number
  family_code?: string | null
  canonical_mnemonic?: string | null
  canonical_unit?: string | null
  is_active?: boolean
}

function valueOrDash(value: string | null): string {
  return value ?? '-'
}

function optionalText(value: string): string | null {
  return value.trim() || null
}

export function CurveMnemonicSetSettings({ mnemonicSet }: { mnemonicSet: CurveMnemonicSetSummary }) {
  const fetchMnemonicSet = useWellDataStore((state) => state.fetchMnemonicSet)
  const copyMnemonicSet = useWellDataStore((state) => state.copyMnemonicSet)
  const updateMnemonicSet = useWellDataStore((state) => state.updateMnemonicSet)
  const deleteMnemonicSet = useWellDataStore((state) => state.deleteMnemonicSet)
  const createMnemonicSetEntry = useWellDataStore((state) => state.createMnemonicSetEntry)
  const updateMnemonicSetEntry = useWellDataStore((state) => state.updateMnemonicSetEntry)
  const deleteMnemonicSetEntry = useWellDataStore((state) => state.deleteMnemonicSetEntry)
  const setSelectedObject = useWorkspaceStore((state) => state.setSelectedObject)
  const [detail, setDetail] = useState<CurveMnemonicSetDetail | null>(null)
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({})

  async function reloadSet() {
    const next = await fetchMnemonicSet(mnemonicSet.id)
    setDetail(next)
  }

  useEffect(() => {
    let cancelled = false
    setDetail(null)
    setRowErrors({})
    void fetchMnemonicSet(mnemonicSet.id).then((next) => {
      if (!cancelled) {
        setDetail(next)
      }
    })
    return () => {
      cancelled = true
    }
  }, [fetchMnemonicSet, mnemonicSet.id])

  const resolved = detail ?? { ...mnemonicSet, entries: [] }

  function updateEntry(updated: CurveMnemonicEntryItem) {
    setDetail((current) => (
      current
        ? {
          ...current,
          entries: current.entries.map((entry) => (entry.id === updated.id ? updated : entry)),
        }
        : current
    ))
    setRowErrors((current) => {
      const next = { ...current }
      delete next[updated.id]
      return next
    })
  }

  function setRowError(entryId: number, error: unknown) {
    setRowErrors((current) => ({
      ...current,
      [entryId]: error instanceof Error ? error.message : String(error),
    }))
  }

  async function saveEntryPatch(entryId: number, patch: EntryPatch) {
    try {
      const updated = await updateMnemonicSetEntry(mnemonicSet.id, entryId, patch)
      updateEntry(updated)
    } catch (error) {
      setRowError(entryId, error)
    }
  }

  async function handleCopy() {
    try {
      const copied = await copyMnemonicSet(mnemonicSet.id)
      setSelectedObject({ type: 'mnemonic-set', setId: copied.id })
    } catch (error) {
      window.alert(String(error))
    }
  }

  async function handleRename() {
    const nextName = window.prompt('Rename mnemonic set', resolved.name)?.trim()
    if (!nextName) return
    try {
      const updated = await updateMnemonicSet(mnemonicSet.id, { name: nextName })
      setDetail((current) => (current ? { ...current, name: updated.name } : current))
    } catch (error) {
      window.alert(String(error))
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete mnemonic set "${resolved.name}"?`)) return
    try {
      await deleteMnemonicSet(mnemonicSet.id)
      setSelectedObject({ type: 'curve-mnemonics-root' })
    } catch (error) {
      window.alert(String(error))
    }
  }

  async function handleAddRow() {
    try {
      const created = await createMnemonicSetEntry(mnemonicSet.id)
      setDetail((current) => (
        current
          ? { ...current, entry_count: current.entry_count + 1, entries: [...current.entries, created] }
          : current
      ))
    } catch (error) {
      window.alert(String(error))
    }
  }

  function handleTextBlur(entry: CurveMnemonicEntryItem, field: TextField, value: string) {
    const patch: EntryPatch = {}
    if (field === 'pattern') {
      if (value === entry.pattern) return
      patch.pattern = value
    } else if (field === 'family_code') {
      const nextValue = optionalText(value)
      if (nextValue === entry.family_code) return
      patch.family_code = nextValue
    } else if (field === 'canonical_mnemonic') {
      const nextValue = optionalText(value)
      if (nextValue === entry.canonical_mnemonic) return
      patch.canonical_mnemonic = nextValue
    } else if (field === 'canonical_unit') {
      const nextValue = optionalText(value)
      if (nextValue === entry.canonical_unit) return
      patch.canonical_unit = nextValue
    }
    void saveEntryPatch(entry.id, patch)
  }

  function handlePriorityBlur(entry: CurveMnemonicEntryItem, value: string) {
    const priority = Number(value)
    if (!Number.isFinite(priority)) {
      setRowError(entry.id, 'Priority must be a number')
      return
    }
    if (priority === entry.priority) return
    void saveEntryPatch(entry.id, { priority })
  }

  async function handleDeleteRow(entry: CurveMnemonicEntryItem) {
    if (!window.confirm(`Delete mnemonic row "${entry.pattern}"?`)) return
    try {
      await deleteMnemonicSetEntry(mnemonicSet.id, entry.id)
      setDetail((current) => (
        current
          ? {
            ...current,
            entry_count: Math.max(0, current.entry_count - 1),
            entries: current.entries.filter((row) => row.id !== entry.id),
          }
          : current
      ))
      setRowErrors((current) => {
        const next = { ...current }
        delete next[entry.id]
        return next
      })
    } catch (error) {
      setRowError(entry.id, error)
      await reloadSet()
    }
  }

  return (
    <div className={`template-panel ${resolved.is_builtin ? 'template-panel--muted' : ''}`}>
      <div className="template-panel__group">
        <div className="template-panel__label">Curve Mnemonic Set</div>
        <div className="template-panel__value">{resolved.name}</div>
      </div>
      <div className="dm-table-wrapper">
        <table className="dm-table">
          <thead>
            <tr>
              <th>Pattern</th>
              <th>Regex</th>
              <th>Priority</th>
              <th>Family</th>
              <th>Mnemonic</th>
              <th>Unit</th>
              <th>Active</th>
              {!resolved.is_builtin ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {resolved.entries.map((entry) => (
              <Fragment key={entry.id}>
                <tr className={resolved.is_builtin ? 'dm-table__row--builtin' : ''}>
                  <td>
                    {resolved.is_builtin ? (
                      entry.pattern
                    ) : (
                      <input
                        className="dm-table__input"
                        defaultValue={entry.pattern}
                        key={`${entry.id}-pattern-${entry.pattern}`}
                        onBlur={(event) => handleTextBlur(entry, 'pattern', event.target.value)}
                      />
                    )}
                  </td>
                  <td>
                    {resolved.is_builtin ? (
                      entry.is_regex ? 'Yes' : 'No'
                    ) : (
                      <input
                        type="checkbox"
                        checked={entry.is_regex}
                        onChange={(event) => void saveEntryPatch(entry.id, { is_regex: event.target.checked })}
                      />
                    )}
                  </td>
                  <td>
                    {resolved.is_builtin ? (
                      entry.priority
                    ) : (
                      <input
                        className="dm-table__input dm-table__input--num"
                        defaultValue={entry.priority}
                        key={`${entry.id}-priority-${entry.priority}`}
                        onBlur={(event) => handlePriorityBlur(entry, event.target.value)}
                      />
                    )}
                  </td>
                  <td>
                    {resolved.is_builtin ? (
                      valueOrDash(entry.family_code)
                    ) : (
                      <input
                        className="dm-table__input"
                        defaultValue={entry.family_code ?? ''}
                        key={`${entry.id}-family-${entry.family_code ?? ''}`}
                        onBlur={(event) => handleTextBlur(entry, 'family_code', event.target.value)}
                      />
                    )}
                  </td>
                  <td>
                    {resolved.is_builtin ? (
                      valueOrDash(entry.canonical_mnemonic)
                    ) : (
                      <input
                        className="dm-table__input"
                        defaultValue={entry.canonical_mnemonic ?? ''}
                        key={`${entry.id}-mnemonic-${entry.canonical_mnemonic ?? ''}`}
                        onBlur={(event) => handleTextBlur(entry, 'canonical_mnemonic', event.target.value)}
                      />
                    )}
                  </td>
                  <td>
                    {resolved.is_builtin ? (
                      valueOrDash(entry.canonical_unit)
                    ) : (
                      <input
                        className="dm-table__input"
                        defaultValue={entry.canonical_unit ?? ''}
                        key={`${entry.id}-unit-${entry.canonical_unit ?? ''}`}
                        onBlur={(event) => handleTextBlur(entry, 'canonical_unit', event.target.value)}
                      />
                    )}
                  </td>
                  <td>
                    {resolved.is_builtin ? (
                      entry.is_active ? 'Yes' : 'No'
                    ) : (
                      <input
                        type="checkbox"
                        checked={entry.is_active}
                        onChange={(event) => void saveEntryPatch(entry.id, { is_active: event.target.checked })}
                      />
                    )}
                  </td>
                  {!resolved.is_builtin ? (
                    <td>
                      <button
                        type="button"
                        className="dm-action dm-action--danger"
                        onClick={() => void handleDeleteRow(entry)}
                      >
                        Delete
                      </button>
                    </td>
                  ) : null}
                </tr>
                {rowErrors[entry.id] ? (
                  <tr className="dm-table__empty-row">
                    <td colSpan={resolved.is_builtin ? 7 : 8}>
                      <span className="project-dialog__error">{rowErrors[entry.id]}</span>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
            {resolved.entries.length === 0 ? (
              <tr className="dm-table__empty-row">
                <td colSpan={resolved.is_builtin ? 7 : 8}>No mnemonic entries loaded.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="sidebar-panel__empty">
        {resolved.is_builtin
          ? 'Default Mnemonics is read-only.'
          : 'Rows save when an edited cell loses focus.'}
      </p>
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
              + Add mnemonic row
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
    </div>
  )
}
