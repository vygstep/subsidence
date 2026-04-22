import { useEffect } from 'react'

import { useProjectStore, useViewStore, useWellDataStore } from '@/stores'

const MIN_DPP = 0.05
const MAX_DPP = 5.0
const ZOOM_FACTOR = 1.25

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable
}

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      const ctrl = e.ctrlKey || e.metaKey

      // Ctrl+Z / Ctrl+Y — fire even from inputs
      if (ctrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        const { canUndo, undo } = useProjectStore.getState()
        if (canUndo) void undo()
        return
      }
      if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        const { canRedo, redo } = useProjectStore.getState()
        if (canRedo) void redo()
        return
      }

      // Escape — clear selection, even from inputs
      if (e.key === 'Escape') {
        useViewStore.getState().clearSelection()
        return
      }

      // All remaining shortcuts skip editable targets
      if (isEditable(e.target)) return

      const view = useViewStore.getState()

      // Zoom: + / =  →  zoom in;  -  →  zoom out
      if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        view.setScale(Math.max(MIN_DPP, view.depthPerPixel / ZOOM_FACTOR))
        return
      }
      if (e.key === '-') {
        e.preventDefault()
        view.setScale(Math.min(MAX_DPP, view.depthPerPixel * ZOOM_FACTOR))
        return
      }

      // Scroll: arrows or Page keys move 30% of visible viewport
      if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault()
        const step = view.depthPerPixel * view.viewportHeight * 0.3
        view.setScroll(Math.max(0, view.scrollDepth - step))
        return
      }
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault()
        const step = view.depthPerPixel * view.viewportHeight * 0.3
        view.setScroll(view.scrollDepth + step)
        return
      }

      // Formation-specific shortcuts require a selected formation
      const { selectedElementId, selectedElementType } = view
      if (selectedElementType !== 'formation' || !selectedElementId) return

      // Delete / Backspace — remove formation
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        void useWellDataStore.getState().removeFormation(selectedElementId)
        return
      }

      // L — toggle lock
      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault()
        const f = useWellDataStore.getState().formations.find((x) => x.id === selectedElementId)
        if (f) void useWellDataStore.getState().updateFormation(selectedElementId, { is_locked: !f.is_locked })
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
