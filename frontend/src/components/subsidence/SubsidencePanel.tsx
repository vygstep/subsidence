import { useCallback, useRef } from 'react'

import { useComputedStore, useViewStore } from '@/stores'
import { MultiWellPanel } from './MultiWellPanel'
import { SubsidenceCanvas } from './SubsidenceCanvas'
import { SubsidenceToolbar } from './SubsidenceToolbar'

export function SubsidencePanel() {
  const isComputing = useComputedStore((s) => s.isComputing)
  const computeError = useComputedStore((s) => s.computeError)
  const subsidenceCurves = useComputedStore((s) => s.subsidenceCurves)
  const hasData = subsidenceCurves.length > 0

  const subsidenceWidth = useViewStore((s) => s.subsidenceWidth)
  const setSubsidenceWidth = useViewStore((s) => s.setSubsidenceWidth)
  const subsidenceBottomHeight = useViewStore((s) => s.subsidenceBottomHeight)
  const setSubsidenceBottomHeight = useViewStore((s) => s.setSubsidenceBottomHeight)

  // Right-edge drag: pulling right narrows panel, pulling left widens it
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)
  const onRightHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    startXRef.current = e.clientX
    startWidthRef.current = subsidenceWidth

    const onMove = (mv: MouseEvent) => {
      const delta = mv.clientX - startXRef.current
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

  // Horizontal divider drag: pull up = grow bottom, pull down = shrink bottom
  const startYRef = useRef(0)
  const startHeightRef = useRef(0)
  const onHDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    startYRef.current = e.clientY
    startHeightRef.current = subsidenceBottomHeight

    const onMove = (mv: MouseEvent) => {
      const delta = mv.clientY - startYRef.current
      setSubsidenceBottomHeight(startHeightRef.current - delta)
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.classList.remove('is-resizing-row')
    }
    document.body.classList.add('is-resizing-row')
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [subsidenceBottomHeight, setSubsidenceBottomHeight])

  return (
    <div className="subsidence-panel">
      <div className="subsidence-panel__right-handle" onMouseDown={onRightHandleMouseDown} />
      <SubsidenceToolbar />
      <div className="subsidence-panel__body">
        <div className="subsidence-panel__top">
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
        <div
          className="subsidence-panel__h-divider"
          onMouseDown={onHDividerMouseDown}
        />
        <div className="subsidence-panel__bottom" style={{ height: subsidenceBottomHeight }}>
          <MultiWellPanel />
        </div>
      </div>
    </div>
  )
}
