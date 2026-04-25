import type { TabularDelimiter, TabularParserSettings, TabularPreviewResponse } from './types'

const DELIMITER_LABELS: Record<TabularDelimiter, string> = {
  auto: 'Auto-detect',
  ',': 'Comma',
  '\t': 'Tab',
  ';': 'Semicolon',
}

interface TabularPreviewPaneProps {
  isLoading: boolean
  error: string | null
  preview: TabularPreviewResponse | null
  settings: TabularParserSettings
  onSettingsChange: (patch: Partial<TabularParserSettings>) => void
}

export function TabularPreviewPane({
  isLoading,
  error,
  preview,
  settings,
  onSettingsChange,
}: TabularPreviewPaneProps) {
  return (
    <div className="import-preview">
      <div className="import-preview__controls">
        <label className="project-dialog__field project-dialog__field--inline">
          <span>Delimiter</span>
          <select
            value={settings.delimiter}
            onChange={(e) => onSettingsChange({ delimiter: e.target.value as TabularDelimiter })}
          >
            {(Object.keys(DELIMITER_LABELS) as TabularDelimiter[]).map((key) => (
              <option key={key} value={key}>{DELIMITER_LABELS[key]}</option>
            ))}
          </select>
        </label>

        <label className="project-dialog__field project-dialog__field--inline">
          <span>Header row</span>
          <input
            type="number"
            min={0}
            value={settings.headerRow}
            onChange={(e) => onSettingsChange({ headerRow: Math.max(0, Number(e.target.value)) })}
          />
        </label>

        {preview && (
          <span className="import-preview__meta">
            {preview.total_rows} rows · {preview.columns.length} columns
            {settings.delimiter === 'auto' && ` · detected: ${DELIMITER_LABELS[preview.detected_delimiter as TabularDelimiter] ?? preview.detected_delimiter}`}
          </span>
        )}
      </div>

      {isLoading && <p className="import-preview__status">Loading preview…</p>}

      {error && !isLoading && (
        <p className="project-dialog__error">{error}</p>
      )}

      {!isLoading && preview && preview.warnings.length > 0 && (
        <div className="project-dialog__validation" aria-label="Preview warnings">
          {preview.warnings.map((w) => <span key={w}>{w}</span>)}
        </div>
      )}

      {!isLoading && preview && preview.columns.length > 0 && (
        <div className="import-preview__table-wrap">
          <table className="import-preview__table">
            <thead>
              <tr>
                {preview.columns.map((col, i) => (
                  <th key={i}>{col || <em>empty</em>}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row, ri) => (
                <tr key={ri}>
                  {preview.columns.map((_, ci) => (
                    <td key={ci}>{row[ci] ?? ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && !error && preview && preview.columns.length === 0 && (
        <p className="import-preview__status">No columns detected.</p>
      )}
    </div>
  )
}
