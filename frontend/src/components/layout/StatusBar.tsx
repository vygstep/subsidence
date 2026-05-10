import { useComputedStore, useProjectStore, useViewStore, useWellDataStore } from '@/stores'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { mdToTvd } from '@/utils/depthTransform'

import { QcWarningsIndicator } from './QcWarningsIndicator'

export function StatusBar() {
  const cursorDepth = useViewStore((state) => state.cursorDepth)
  const depthType = useViewStore((state) => state.depthType)
  const singleRange = useViewStore((state) => state.subsidenceSingleDisplayedRange)
  const multiRange = useViewStore((state) => state.subsidenceMultiDisplayedRange)
  const selectedObject = useWorkspaceStore((state) => state.selectedObject)
  const isDirty = useProjectStore((state) => state.isDirty)
  const projectName = useProjectStore((state) => state.projectName)
  const isComputing = useComputedStore((state) => state.isComputing)
  const tvdTable = useWellDataStore((state) => state.tvdTable)
  const kbElev = useWellDataStore((state) => state.well?.kb_elev ?? 0)

  const displayDepth = cursorDepth !== null && tvdTable
    ? (depthType === 'TVD' ? mdToTvd(cursorDepth, tvdTable) : depthType === 'TVDSS' ? mdToTvd(cursorDepth, tvdTable) - kbElev : cursorDepth)
    : cursorDepth
  const chartRange = selectedObject?.type === 'subsidence-chart'
    ? (selectedObject.chartType === 'single' ? singleRange : multiRange)
    : null
  const chartLabel = selectedObject?.type === 'subsidence-chart'
    ? (selectedObject.chartType === 'single' ? 'Single chart' : 'Multi chart')
    : null
  const chartRangeLabel = chartRange && chartLabel
    ? `${chartLabel}: Age ${chartRange.ageMinMa.toFixed(1)}-${chartRange.ageMaxMa.toFixed(1)} Ma | Depth ${chartRange.depthMinM.toFixed(0)}-${chartRange.depthMaxM.toFixed(0)} m`
    : ''

  return (
    <div className="status-bar">
      <span className="status-bar__depth">
        {displayDepth !== null ? `${depthType} ${displayDepth.toFixed(1)} m` : ''}
      </span>
      <span className="status-bar__center">
        {chartRangeLabel && <span>{chartRangeLabel}</span>}
        {isComputing && <span className="status-bar__computing">Computing…</span>}
      </span>
      <span className="status-bar__right">
        <QcWarningsIndicator />
        {isDirty && <span className="status-bar__dirty">●</span>}
        {projectName ?? ''}
      </span>
    </div>
  )
}
