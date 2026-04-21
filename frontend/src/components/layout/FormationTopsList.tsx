import { useRef } from 'react'

import { useViewStore, useWellDataStore } from '@/stores'

export function FormationTopsList() {
  const formations = useWellDataStore((s) => s.formations)
  const addFormation = useWellDataStore((s) => s.addFormation)
  const updateFormation = useWellDataStore((s) => s.updateFormation)
  const removeFormation = useWellDataStore((s) => s.removeFormation)

  const cursorDepth = useViewStore((s) => s.cursorDepth)
  const visibleDepthRange = useViewStore((s) => s.visibleDepthRange)
  const setScroll = useViewStore((s) => s.setScroll)
  const selectElement = useViewStore((s) => s.selectElement)

  const listRef = useRef<HTMLUListElement | null>(null)

  const midDepth = (visibleDepthRange.min + visibleDepthRange.max) / 2
  const halfViewport = (visibleDepthRange.max - visibleDepthRange.min) / 2

  function handleAdd() {
    const depth = cursorDepth ?? midDepth
    void addFormation({ name: 'New formation', depth_md: depth, color: '#808080' })
  }

  function handleRowClick(id: string, depth: number) {
    selectElement(id, 'formation')
    setScroll(depth - halfViewport)
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
              <span className="formations-list__depth">{f.depth_md.toFixed(1)}</span>
              <span className="formations-list__name">{f.name}</span>
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
