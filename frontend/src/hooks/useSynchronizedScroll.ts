import { useEffect, useRef } from 'react'

import { useViewStore } from '@/stores'

/**
 * Attaches a wheel listener to `containerRef` that converts deltaY to a
 * depth delta and writes it to viewStore. The listener is passive:false so
 * we can call preventDefault and prevent the page from scrolling.
 *
 * Uses internal refs for scrollDepth and depthPerPixel so the wheel handler
 * never needs to re-bind when those values change at 60 fps.
 */
export function useSynchronizedScroll(
  containerRef: React.RefObject<HTMLElement | null>,
  minDepth: number,
  maxDepth: number,
): void {
  const setScroll = useViewStore((state) => state.setScroll)

  // Mirror high-frequency store values into refs so the wheel handler stays
  // bound to the same function for the lifetime of minDepth/maxDepth.
  const stateRef = useRef({ scrollDepth: 0, depthPerPixel: 0.2 })

  useEffect(() => {
    return useViewStore.subscribe((state) => {
      stateRef.current = {
        scrollDepth: state.scrollDepth,
        depthPerPixel: state.depthPerPixel,
      }
    })
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const { scrollDepth, depthPerPixel } = stateRef.current
      const depthDelta = e.deltaY * depthPerPixel
      const next = scrollDepth + depthDelta
      setScroll(Math.max(minDepth, Math.min(maxDepth, next)))
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', handleWheel)
    }
  }, [containerRef, minDepth, maxDepth, setScroll])
}
