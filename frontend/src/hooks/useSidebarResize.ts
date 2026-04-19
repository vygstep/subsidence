import { useEffect, useRef } from 'react'

import { useWorkspaceStore } from '@/stores'

export function useSidebarResize() {
  const setSidebarWidth = useWorkspaceStore((state) => state.setSidebarWidth)
  const setSidebarTopRatio = useWorkspaceStore((state) => state.setSidebarTopRatio)
  const workspaceRef = useRef<HTMLDivElement | null>(null)
  const sidebarRef = useRef<HTMLElement | null>(null)
  const dragModeRef = useRef<'sidebar-width' | 'sidebar-split' | null>(null)

  useEffect(() => {
    const handlePointerMove = (event: MouseEvent) => {
      if (!dragModeRef.current) return

      if (dragModeRef.current === 'sidebar-width') {
        const rect = workspaceRef.current?.getBoundingClientRect()
        if (!rect) return
        setSidebarWidth(Math.min(520, Math.max(240, event.clientX - rect.left)))
        return
      }

      const rect = sidebarRef.current?.getBoundingClientRect()
      if (!rect) return
      setSidebarTopRatio(Math.min(0.85, Math.max(0.2, (event.clientY - rect.top) / rect.height)))
    }

    const handlePointerUp = () => {
      dragModeRef.current = null
      document.body.classList.remove('is-resizing')
    }

    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', handlePointerUp)
    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', handlePointerUp)
    }
  }, [setSidebarWidth, setSidebarTopRatio])

  function startWidthDrag() {
    dragModeRef.current = 'sidebar-width'
    document.body.classList.add('is-resizing')
  }

  function startSplitDrag() {
    dragModeRef.current = 'sidebar-split'
    document.body.classList.add('is-resizing')
  }

  return { workspaceRef, sidebarRef, startWidthDrag, startSplitDrag }
}
