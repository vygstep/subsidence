import { useCallback, useRef, useState } from 'react'

import { useViewStore } from '@/stores'
import type { FormationTop } from '@/types'

interface UseFormationDragOptions {
  formation: FormationTop
  onDepthChange: (depth: number) => void
  onDragEnd: (finalDepth: number) => void
}

interface UseFormationDragResult {
  isDragging: boolean
  dragHandlers: {
    onPointerDown: (e: React.PointerEvent) => void
  }
}

export function useFormationDrag({
  formation,
  onDepthChange,
  onDragEnd,
}: UseFormationDragOptions): UseFormationDragResult {
  const [isDragging, setIsDragging] = useState(false)

  const depthPerPixelRef = useRef(useViewStore.getState().depthPerPixel)
  useViewStore.subscribe((state) => {
    depthPerPixelRef.current = state.depthPerPixel
  })

  const dragState = useRef<{
    startY: number
    startDepth: number
    currentDepth: number
  } | null>(null)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (formation.is_locked) return
      e.currentTarget.setPointerCapture(e.pointerId)

      dragState.current = {
        startY: e.clientY,
        startDepth: formation.depth_md,
        currentDepth: formation.depth_md,
      }
      setIsDragging(true)

      function handlePointerMove(ev: PointerEvent) {
        if (!dragState.current) return
        const dy = ev.clientY - dragState.current.startY
        const newDepth = dragState.current.startDepth + dy * depthPerPixelRef.current
        dragState.current.currentDepth = newDepth
        onDepthChange(newDepth)
      }

      function handlePointerUp() {
        if (!dragState.current) return
        onDragEnd(dragState.current.currentDepth)
        dragState.current = null
        setIsDragging(false)
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', handlePointerUp)
      }

      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
    },
    [formation.is_locked, formation.depth_md, onDepthChange, onDragEnd],
  )

  return { isDragging, dragHandlers: { onPointerDown } }
}
