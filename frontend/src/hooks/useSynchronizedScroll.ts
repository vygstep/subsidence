import { useEffect, useRef } from 'react'

import { useViewStore } from '@/stores'

export function useSynchronizedScroll(
  containerRef: React.RefObject<HTMLElement | null>,
  minDepth: number,
  maxDepth: number,
): void {
  const setScroll = useViewStore((state) => state.setScroll)
  const setScale = useViewStore((state) => state.setScale)

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
    const element = containerRef.current
    if (!element) {
      return
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      const { scrollDepth, depthPerPixel } = stateRef.current

      if (event.ctrlKey) {
        const zoomFactor = event.deltaY > 0 ? 1.15 : 1 / 1.15
        const newDepthPerPixel = Math.max(0.05, Math.min(5.0, depthPerPixel * zoomFactor))
        const bounds = element.getBoundingClientRect()
        const offsetY = event.clientY - bounds.top
        const cursorDepth = scrollDepth + offsetY * depthPerPixel
        const span = newDepthPerPixel * bounds.height
        const unclampedScrollDepth = cursorDepth - offsetY * newDepthPerPixel
        const maxScrollDepth = Math.max(minDepth, maxDepth - span)
        const nextScrollDepth = Math.max(minDepth, Math.min(maxScrollDepth, unclampedScrollDepth))

        setScale(newDepthPerPixel)
        setScroll(nextScrollDepth)
        return
      }

      const depthDelta = event.deltaY * depthPerPixel
      const nextScrollDepth = scrollDepth + depthDelta
      const maxScrollDepth = Math.max(minDepth, maxDepth - depthPerPixel * element.clientHeight)
      setScroll(Math.max(minDepth, Math.min(maxScrollDepth, nextScrollDepth)))
    }

    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      element.removeEventListener('wheel', handleWheel)
    }
  }, [containerRef, maxDepth, minDepth, setScale, setScroll])
}
