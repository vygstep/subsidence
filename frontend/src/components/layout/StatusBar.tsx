import { useComputedStore, useProjectStore, useViewStore } from '@/stores'

export function StatusBar() {
  const cursorDepth = useViewStore((state) => state.cursorDepth)
  const isDirty = useProjectStore((state) => state.isDirty)
  const projectName = useProjectStore((state) => state.projectName)
  const isComputing = useComputedStore((state) => state.isComputing)

  return (
    <div className="status-bar">
      <span className="status-bar__depth">
        {cursorDepth !== null ? `MD ${cursorDepth.toFixed(1)} m` : ''}
      </span>
      <span className="status-bar__center">
        {isComputing && <span className="status-bar__computing">Computing…</span>}
      </span>
      <span className="status-bar__right">
        {isDirty && <span className="status-bar__dirty">●</span>}
        {projectName ?? ''}
      </span>
    </div>
  )
}
