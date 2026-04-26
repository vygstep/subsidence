import { useCallback, useEffect, useRef, useState } from 'react'

import { useFormationDrag } from '@/hooks'
import { useViewStore, useWellDataStore, useWorkspaceStore } from '@/stores'
import type { FormationTop } from '@/types'

interface FormationTopLineProps {
  formation: FormationTop
  yPosition: number
  editable: boolean
  isActivePick?: boolean
  onSetActivePick?: (id: string | null) => void
}

const LABEL_HEIGHT = 18
const LABEL_PADDING = 5

interface DepthPopover {
  x: number
  y: number
  field: 'MD' | 'TVD' | 'TVDSS'
  draft: string
}

export function FormationTopLine({
  formation,
  yPosition,
  editable,
  isActivePick = false,
  onSetActivePick,
}: FormationTopLineProps) {
  const updateFormationDepth = useWellDataStore((state) => state.updateFormationDepth)
  const updateFormation = useWellDataStore((state) => state.updateFormation)
  const wellId = useWellDataStore((state) => state.well?.well_id)
  const setSelectedFormationId = useWorkspaceStore((state) => state.setSelectedFormationId)
  const setSelectedObject = useWorkspaceStore((state) => state.setSelectedObject)
  const depthType = useViewStore((state) => state.depthType)
  const [localY, setLocalY] = useState<number | null>(null)
  const [popover, setPopover] = useState<DepthPopover | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const didDragRef = useRef(false)

  const handleDragStart = useCallback(() => {
    if (!wellId) return
    didDragRef.current = false
    setSelectedFormationId(formation.id)
    setSelectedObject({ type: 'top-pick', wellId, formationId: formation.id })
  }, [formation.id, setSelectedFormationId, setSelectedObject, wellId])

  const handleDepthChange = useCallback((depth: number) => {
    didDragRef.current = true
    const { scrollDepth, depthPerPixel } = useViewStore.getState()
    setLocalY((depth - scrollDepth) / depthPerPixel)
  }, [])

  const handleDragEnd = useCallback(
    (finalDepth: number) => {
      setLocalY(null)
      void updateFormationDepth(formation.id, finalDepth)
    },
    [formation.id, updateFormationDepth],
  )

  const { isDragging, dragHandlers } = useFormationDrag({
    formation,
    enabled: editable,
    onDragStart: handleDragStart,
    onDepthChange: handleDepthChange,
    onDragEnd: handleDragEnd,
  })

  const handleClick = useCallback(() => {
    if (didDragRef.current) return
    if (!editable) return
    onSetActivePick?.(isActivePick ? null : formation.id)
  }, [editable, formation.id, isActivePick, onSetActivePick])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!editable) return
      e.preventDefault()
      const currentVal =
        depthType === 'TVD'
          ? formation.depth_tvd
          : depthType === 'TVDSS'
            ? formation.depth_tvdss
            : formation.depth_md
      setPopover({
        x: e.clientX,
        y: e.clientY,
        field: depthType,
        draft: currentVal != null ? String(currentVal.toFixed(2)) : '',
      })
    },
    [depthType, editable, formation.depth_md, formation.depth_tvd, formation.depth_tvdss],
  )

  const commitPopover = useCallback(async () => {
    if (!popover || !wellId) return
    const val = parseFloat(popover.draft)
    if (isNaN(val)) {
      setPopover(null)
      return
    }
    const patchField =
      popover.field === 'TVD' ? 'depth_tvd' : popover.field === 'TVDSS' ? 'depth_tvdss' : 'depth_md'
    try {
      await updateFormation(formation.id, { [patchField]: val })
    } catch (err) {
      window.alert(String(err))
    }
    setPopover(null)
  }, [formation.id, popover, updateFormation, wellId])

  // Dismiss popover on outside click
  useEffect(() => {
    if (!popover) return
    function onDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        void commitPopover()
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPopover(null)
      if (e.key === 'Enter') void commitPopover()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [popover, commitPopover])

  const color = formation.active_strat_color ?? formation.color
  const displayY = localY !== null ? localY : yPosition
  const cursor = !editable ? 'default' : formation.is_locked ? 'not-allowed' : isActivePick ? 'crosshair' : 'ns-resize'
  const strokeOpacity = isDragging || isActivePick ? 1.0 : 0.75
  const strokeWidth = isActivePick ? 2.5 : 1.5

  return (
    <>
      <g
        style={{ pointerEvents: 'auto', cursor }}
        {...dragHandlers}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <line
          x1={0}
          y1={displayY}
          x2="100%"
          y2={displayY}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray="6 3"
          strokeOpacity={strokeOpacity}
        />
        {isActivePick && (
          <circle cx={8} cy={displayY} r={5} fill={color} strokeWidth={0} />
        )}
        <rect
          x={2}
          y={displayY - LABEL_HEIGHT}
          width={120}
          height={LABEL_HEIGHT}
          fill={color}
          opacity={isActivePick ? 1.0 : 0.85}
          rx={2}
        />
        <text
          x={LABEL_PADDING}
          y={displayY - LABEL_HEIGHT / 2}
          dominantBaseline="middle"
          fill="#ffffff"
          fontSize={11}
          fontWeight={600}
          style={{ userSelect: 'none' }}
        >
          {formation.name}
        </text>
        {formation.is_locked && (
          <text
            x={126}
            y={displayY - LABEL_HEIGHT / 2}
            dominantBaseline="middle"
            fill={color}
            fontSize={11}
            style={{ userSelect: 'none' }}
          >
            🔒
          </text>
        )}
      </g>
      {popover && (
        <foreignObject x={0} y={0} width="100%" height="100%" style={{ overflow: 'visible', pointerEvents: 'none' }}>
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              left: popover.x,
              top: popover.y,
              background: '#1e2631',
              border: '1px solid #374151',
              borderRadius: 6,
              padding: '8px 10px',
              zIndex: 9999,
              pointerEvents: 'auto',
              minWidth: 180,
            }}
          >
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6, fontWeight: 600 }}>
              Set depth — {formation.name}
            </div>
            {(['MD', 'TVD', 'TVDSS'] as const).map((field) => {
              const stored =
                field === 'TVD' ? formation.depth_tvd : field === 'TVDSS' ? formation.depth_tvdss : formation.depth_md
              const isEditable = field === popover.field
              return (
                <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <label style={{ fontSize: 11, color: '#9ca3af', width: 40 }}>{field}</label>
                  <input
                    type="number"
                    step="0.1"
                    autoFocus={isEditable}
                    readOnly={!isEditable}
                    value={isEditable ? popover.draft : (stored != null ? stored.toFixed(2) : '')}
                    placeholder="—"
                    onChange={(e) => isEditable && setPopover((p) => p ? { ...p, draft: e.target.value } : p)}
                    style={{
                      width: 90,
                      background: isEditable ? '#111827' : '#0f1623',
                      color: isEditable ? '#f9fafb' : '#6b7280',
                      border: `1px solid ${isEditable ? '#3b82f6' : '#374151'}`,
                      borderRadius: 4,
                      padding: '2px 6px',
                      fontSize: 12,
                    }}
                  />
                </div>
              )
            })}
          </div>
        </foreignObject>
      )}
    </>
  )
}
