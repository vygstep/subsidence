import { useComputedStore } from '@/stores'
import { SubsidenceCanvas } from './SubsidenceCanvas'
import { SubsidenceControls } from './SubsidenceControls'

export function SubsidencePanel() {
  const isComputing = useComputedStore((s) => s.isComputing)
  const computeError = useComputedStore((s) => s.computeError)
  const subsidenceCurves = useComputedStore((s) => s.subsidenceCurves)
  const hasData = subsidenceCurves.length > 0

  return (
    <div className="subsidence-panel">
      {isComputing && (
        <div className="subsidence-panel__overlay">Computing...</div>
      )}
      {computeError && !isComputing && (
        <div className="subsidence-panel__error">{computeError}</div>
      )}
      <SubsidenceControls />
      <div className="subsidence-panel__content">
        <SubsidenceCanvas />
        {!hasData && !isComputing && !computeError && (
          <div className="subsidence-panel__empty">No data — formation ages required</div>
        )}
      </div>
    </div>
  )
}
