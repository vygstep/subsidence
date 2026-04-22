import { useCallback, useRef } from 'react'

import { useComputedStore, useViewStore } from '@/stores'
import { SubsidenceCanvas } from './SubsidenceCanvas'
import { SubsidenceToolbar } from './SubsidenceToolbar'

export function SubsidencePanel() {
  const isComputing = useComputedStore((s) => s.isComputing)
  const computeError = useComputedStore((s) => s.computeError)
  const subsidenceCurves = useComputedStore((s) => s.subsidenceCurves)
  const hasData = subsidenceCurves.length > 0

  const subsidenceWidth = useViewStore((s) => s.subsidenceWidth)
  const setSubsidenceWidth = useViewStore((s) => s.setSubsidenceWidth)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  // Right-edge drag: pulling left narrows panel, right widens it
  const onRightHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    startXRef.current = e.clientX
    startWidthRef.current = subsidenceWidth

    const onMove = (mv: MouseEvent) => {
      const delta = mv.clientX - startXRef.current
      // delta > 0 → mouse moved right → panel would grow (blocked by screen edge)
      // delta < 0 → mouse moved left  → panel narrows
      setSubsidenceWidth(startWidthRef.current - delta)
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.classList.remove('is-resizing')
    }
    document.body.classList.add('is-resizing')
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [subsidenceWidth, setSubsidenceWidth])

  return (
    <div className="subsidence-panel">
      <div className="subsidence-panel__right-handle" onMouseDown={onRightHandleMouseDown} />
      <SubsidenceToolbar />
      <div className="subsidence-panel__content">
        {isComputing && (
          <div className="subsidence-panel__overlay">Computing...</div>
        )}
        {computeError && !isComputing && (
          <div className="subsidence-panel__error">{computeError}</div>
        )}
        <SubsidenceCanvas />
        {!hasData && !isComputing && !computeError && (
          <div className="subsidence-panel__empty">No data — formation ages required</div>
        )}
      </div>
    </div>
  )
}
