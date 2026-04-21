import { useComputedStore } from '@/stores'

export function SubsidencePanel() {
  const isComputing = useComputedStore((s) => s.isComputing)
  const computeError = useComputedStore((s) => s.computeError)
  const subsidenceCurves = useComputedStore((s) => s.subsidenceCurves)

  return (
    <div className="subsidence-panel">
      {isComputing && (
        <div className="subsidence-panel__overlay">Computing…</div>
      )}
      {computeError && (
        <div className="subsidence-panel__error">{computeError}</div>
      )}
      {!isComputing && subsidenceCurves.length === 0 && !computeError && (
        <div className="subsidence-panel__empty">No data — formation ages required</div>
      )}
      {subsidenceCurves.length > 0 && (
        <div className="subsidence-panel__content">
          {/* SubsidenceCanvas added in Step 5 */}
        </div>
      )}
    </div>
  )
}
