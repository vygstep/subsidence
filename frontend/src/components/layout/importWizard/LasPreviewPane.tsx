import type { LasPreviewResponse } from './types'

interface LasPreviewPaneProps {
  isLoading: boolean
  error: string | null
  preview: LasPreviewResponse | null
  curveTypes?: Record<string, 'continuous' | 'discrete'>
  onCurveTypeChange?: (mnemonic: string, type: 'continuous' | 'discrete') => void
}

export function LasPreviewPane({ isLoading, error, preview, curveTypes, onCurveTypeChange }: LasPreviewPaneProps) {
  const showTypeColumn = curveTypes !== undefined && onCurveTypeChange !== undefined

  return (
    <div className="import-preview">
      {isLoading && <p className="import-preview__status">Reading LAS file…</p>}

      {error && !isLoading && (
        <p className="project-dialog__error">{error}</p>
      )}

      {!isLoading && preview && preview.warnings.length > 0 && (
        <div className="project-dialog__validation" aria-label="Preview warnings">
          {preview.warnings.map((w) => <span key={w}>{w}</span>)}
        </div>
      )}

      {!isLoading && preview && (
        <>
          <div className="import-preview__las-meta">
            <div className="import-preview__las-meta-row">
              <span className="import-preview__las-meta-label">Well</span>
              <span>{preview.well_name ?? '—'}</span>
            </div>
            {preview.well_id && (
              <div className="import-preview__las-meta-row">
                <span className="import-preview__las-meta-label">UWI</span>
                <span>{preview.well_id}</span>
              </div>
            )}
            <div className="import-preview__las-meta-row">
              <span className="import-preview__las-meta-label">Depth unit</span>
              <span>{preview.depth_unit ?? '—'}</span>
            </div>
            {preview.start_depth !== null && (
              <div className="import-preview__las-meta-row">
                <span className="import-preview__las-meta-label">Depth range</span>
                <span>
                  {preview.start_depth} – {preview.stop_depth}
                  {preview.step !== null ? ` (step ${preview.step})` : ''}
                </span>
              </div>
            )}
            {preview.null_value !== null && (
              <div className="import-preview__las-meta-row">
                <span className="import-preview__las-meta-label">Null value</span>
                <span>{preview.null_value}</span>
              </div>
            )}
          </div>

          {preview.curves.length > 0 && (
            <div className="import-preview__table-wrap">
              <table className="import-preview__table">
                <thead>
                  <tr>
                    <th>Mnemonic</th>
                    <th>Unit</th>
                    <th>Description</th>
                    {showTypeColumn && <th>Type</th>}
                  </tr>
                </thead>
                <tbody>
                  {preview.curves.map((curve, idx) => (
                    <tr key={curve.mnemonic}>
                      <td>{curve.mnemonic}</td>
                      <td>{curve.unit || '—'}</td>
                      <td>{curve.description ?? ''}</td>
                      {showTypeColumn && (
                        <td>
                          {idx === 0 ? (
                            <span className="import-preview__depth-label">depth</span>
                          ) : (
                            <select
                              value={curveTypes![curve.mnemonic] ?? 'continuous'}
                              onChange={(e) => onCurveTypeChange!(curve.mnemonic, e.target.value as 'continuous' | 'discrete')}
                            >
                              <option value="continuous">continuous</option>
                              <option value="discrete">discrete</option>
                            </select>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {preview.curves.length === 0 && (
            <p className="import-preview__status">No curves found in LAS file.</p>
          )}
        </>
      )}
    </div>
  )
}
