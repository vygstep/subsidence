import { useNotificationStore } from '@/stores'

export function QcWarningsIndicator() {
  const qcWarnings = useNotificationStore((state) => state.qcWarnings)
  const isQcPanelOpen = useNotificationStore((state) => state.isQcPanelOpen)
  const toggleQcPanel = useNotificationStore((state) => state.toggleQcPanel)
  const clearQcWarnings = useNotificationStore((state) => state.clearQcWarnings)

  if (qcWarnings.length === 0) return null

  return (
    <span className="qc-indicator">
      {isQcPanelOpen && (
        <div className="qc-indicator__panel">
          <div className="qc-indicator__panel-header">
            <span>QC warnings ({qcWarnings.length})</span>
            <button type="button" className="qc-indicator__dismiss" onClick={clearQcWarnings}>
              Clear
            </button>
          </div>
          <ul className="qc-indicator__list">
            {qcWarnings.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}
      <button
        type="button"
        className="qc-indicator__badge"
        onClick={toggleQcPanel}
        title={`${qcWarnings.length} QC warning${qcWarnings.length > 1 ? 's' : ''}`}
      >
        !
      </button>
    </span>
  )
}
