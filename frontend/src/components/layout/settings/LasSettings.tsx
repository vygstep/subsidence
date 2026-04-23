import type { Well } from '@/types'
import { CurveBrowser } from '../CurveBrowser'

interface LasSettingsProps {
  well: Well
  curveCount: number
  visibleCurveCount: number
  minDepth: number
  maxDepth: number
}

export function LasSettings({ well, curveCount, visibleCurveCount, minDepth, maxDepth }: LasSettingsProps) {
  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Object</div>
        <div className="template-panel__value">Logs</div>
      </div>
      <div className="tree-leaf"><span>Source</span><span>{well.source_las_path ?? 'mixed / unset'}</span></div>
      <div className="tree-leaf"><span>Curves</span><span>{curveCount}</span></div>
      <div className="tree-leaf"><span>Visible</span><span>{visibleCurveCount}</span></div>
      <div className="tree-leaf"><span>Depth range</span><span>{minDepth.toFixed(1)} - {maxDepth.toFixed(1)}</span></div>
      <div className="template-panel__group" style={{ marginTop: 8 }}>
        <div className="template-panel__label">Add to viewer</div>
      </div>
      <CurveBrowser />
    </div>
  )
}
