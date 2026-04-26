import { useRef, useState } from 'react'

import { useComputedStore, useViewStore, useWellDataStore } from '@/stores'
import type { FormationTop } from '@/types'

export function FormationTopsList() {
  const formations = useWellDataStore((s) => s.formations)
  const addFormation = useWellDataStore((s) => s.addFormation)
  const updateFormation = useWellDataStore((s) => s.updateFormation)
  const removeFormation = useWellDataStore((s) => s.removeFormation)
  const triggerRecalculation = useComputedStore((s) => s.triggerRecalculation)

  const cursorDepth = useViewStore((s) => s.cursorDepth)
  const visibleDepthRange = useViewStore((s) => s.visibleDepthRange)
  const depthType = useViewStore((s) => s.depthType)
  const setScroll = useViewStore((s) => s.setScroll)
  const selectElement = useViewStore((s) => s.selectElement)

  const listRef = useRef<HTMLUListElement | null>(null)

  const [editingAgeId, setEditingAgeId] = useState<string | null>(null)
  const [draftAge, setDraftAge] = useState('')
  const [editingDepthId, setEditingDepthId] = useState<string | null>(null)
  const [draftDepth, setDraftDepth] = useState('')

  const midDepth = (visibleDepthRange.min + visibleDepthRange.max) / 2
  const halfViewport = (visibleDepthRange.max - visibleDepthRange.min) / 2

  function handleAdd() {
    const depth = cursorDepth ?? midDepth
    void addFormation({ name: 'New formation', depth_md: depth, color: '#808080' })
  }

  function handleRowClick(id: string, depth: number | null) {
    selectElement(id, 'formation')
    if (depth !== null) setScroll(depth - halfViewport)
  }

  function startAgeEdit(e: React.MouseEvent, f: FormationTop) {
    e.stopPropagation()
    setEditingAgeId(f.id)
    setDraftAge(f.age_ma != null ? String(f.age_ma) : '')
  }

  function commitAge(f: FormationTop) {
    const val = parseFloat(draftAge)
    if (!isNaN(val) && val >= 0 && val !== f.age_ma) {
      void updateFormation(f.id, { age_ma: val }).then(() => triggerRecalculation())
    }
    setEditingAgeId(null)
  }

  function handleAgeKeyDown(e: React.KeyboardEvent, f: FormationTop) {
    if (e.key === 'Enter') commitAge(f)
    if (e.key === 'Escape') setEditingAgeId(null)
  }

  function getDisplayDepth(f: FormationTop): number | null {
    if (depthType === 'TVD') return f.depth_tvd
    if (depthType === 'TVDSS') return f.depth_tvdss
    return f.depth_md
  }

  function startDepthEdit(e: React.MouseEvent, f: FormationTop) {
    e.stopPropagation()
    setEditingDepthId(f.id)
    const d = getDisplayDepth(f)
    setDraftDepth(d != null ? String(d.toFixed(2)) : '')
  }

  function commitDepth(f: FormationTop) {
    const val = parseFloat(draftDepth)
    if (!isNaN(val)) {
      const field =
        depthType === 'TVD' ? 'depth_tvd' : depthType === 'TVDSS' ? 'depth_tvdss' : 'depth_md'
      void updateFormation(f.id, { [field]: val })
    }
    setEditingDepthId(null)
  }

  function handleDepthKeyDown(e: React.KeyboardEvent, f: FormationTop) {
    if (e.key === 'Enter') commitDepth(f)
    if (e.key === 'Escape') setEditingDepthId(null)
  }

  return (
    <div className="formations-list">
      <div className="formations-list__toolbar">
        <button type="button" className="formations-list__add-btn" onClick={handleAdd}>
          ＋ Add formation
        </button>
      </div>
      {formations.length === 0 ? (
        <p className="sidebar-panel__empty">No formation tops loaded.</p>
      ) : (
        <ul ref={listRef} className="formations-list__rows">
          {formations.map((f) => (
            <li key={f.id} className="formations-list__row" onClick={() => handleRowClick(f.id, f.depth_md)}>
              <span
                className="formations-list__swatch"
                style={{ background: f.active_strat_color ?? f.color }}
              />
              {editingDepthId === f.id ? (
                <input
                  className="formations-list__depth-input"
                  type="number"
                  step="0.1"
                  autoFocus
                  value={draftDepth}
                  onChange={(e) => setDraftDepth(e.target.value)}
                  onBlur={() => commitDepth(f)}
                  onKeyDown={(e) => handleDepthKeyDown(e, f)}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className="formations-list__depth"
                  title={`${depthType} — double-click to edit`}
                  onDoubleClick={(e) => startDepthEdit(e, f)}
                >
                  {getDisplayDepth(f)?.toFixed(1) ?? '—'}
                </span>
              )}
              <span className="formations-list__name">{f.name}</span>
              {editingAgeId === f.id ? (
                <input
                  className="formations-list__age-input"
                  type="number"
                  step="0.1"
                  min="0"
                  autoFocus
                  value={draftAge}
                  onChange={(e) => setDraftAge(e.target.value)}
                  onBlur={() => commitAge(f)}
                  onKeyDown={(e) => handleAgeKeyDown(e, f)}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className="formations-list__age"
                  title="Click to set age (Ma)"
                  onClick={(e) => startAgeEdit(e, f)}
                >
                  {f.age_ma != null ? `${f.age_ma.toFixed(1)} Ma` : '— Ma'}
                </span>
              )}
              <button
                type="button"
                className="formations-list__icon-btn"
                title={f.is_locked ? 'Unlock' : 'Lock'}
                onClick={(e) => { e.stopPropagation(); void updateFormation(f.id, { is_locked: !f.is_locked }) }}
              >
                {f.is_locked ? '🔒' : '🔓'}
              </button>
              <button
                type="button"
                className="formations-list__icon-btn formations-list__icon-btn--danger"
                title="Delete"
                onClick={(e) => { e.stopPropagation(); void removeFormation(f.id) }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
