import { useComputedStore, useProjectStore, useViewStore, useWellDataStore } from '@/stores'
import { mdToTvd } from '@/utils/depthTransform'

export function StatusBar() {
  const cursorDepth = useViewStore((state) => state.cursorDepth)
  const depthType = useViewStore((state) => state.depthType)
  const isDirty = useProjectStore((state) => state.isDirty)
  const projectName = useProjectStore((state) => state.projectName)
  const isComputing = useComputedStore((state) => state.isComputing)
  const tvdTable = useWellDataStore((state) => state.tvdTable)
  const kbElev = useWellDataStore((state) => state.well?.kb_elev ?? 0)

  const displayDepth = cursorDepth !== null && tvdTable
    ? (depthType === 'TVD' ? mdToTvd(cursorDepth, tvdTable) : depthType === 'TVDSS' ? mdToTvd(cursorDepth, tvdTable) - kbElev : cursorDepth)
    : cursorDepth

  return (
    <div className="status-bar">
      <span className="status-bar__depth">
        {displayDepth !== null ? `${depthType} ${displayDepth.toFixed(1)} m` : ''}
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
