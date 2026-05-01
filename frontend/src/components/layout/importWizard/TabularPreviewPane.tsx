import type { FieldDefinition, ColumnMapping } from './mapping'
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
  depthColumn?: string | null
  fields?: FieldDefinition[]
  mapping?: ColumnMapping
  onMappingChange?: (fieldId: string, colName: string | null) => void
}

export function TabularPreviewPane({
  isLoading,
  error,
  preview,
  settings,
  onSettingsChange,
  depthColumn,
  fields,
  mapping,
  onMappingChange,
}: TabularPreviewPaneProps) {
  const depthColIndex = depthColumn != null && preview ? preview.columns.indexOf(depthColumn) : -1
  const showMapping = fields != null && mapping != null && onMappingChange != null && preview != null
  const missingRequired = showMapping ? fields.filter((f) => f.required && !mapping[f.id]) : []

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
              {showMapping && (
                <tr className="import-preview__mapping-row">
                  {preview.columns.map((col, colIdx) => {
                    const assignedFieldId = Object.entries(mapping).find(([, v]) => v === col)?.[0] ?? ''
                    return (
                      <th key={colIdx}>
                        <select
                          value={assignedFieldId}
                          onChange={(e) => {
                            const nextFieldId = e.target.value
                            const prevFieldId = Object.entries(mapping).find(([, v]) => v === col)?.[0]
                            if (prevFieldId) onMappingChange(prevFieldId, null)
                            if (nextFieldId) onMappingChange(nextFieldId, col)
                          }}
                        >
                          <option value="">—</option>
                          {fields.map((f) => (
                            <option
                              key={f.id}
                              value={f.id}
                              disabled={!!mapping[f.id] && mapping[f.id] !== col}
                            >
                              {f.label}{f.required ? ' *' : ''}
                            </option>
                          ))}
                        </select>
                      </th>
                    )
                  })}
                </tr>
              )}
              <tr>
                {preview.columns.map((col, i) => (
                  <th key={i} className={i === depthColIndex ? 'import-preview__col--depth' : undefined}>{col || <em>empty</em>}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row, ri) => (
                <tr key={ri}>
                  {preview.columns.map((_, ci) => (
                    <td key={ci} className={ci === depthColIndex ? 'import-preview__col--depth' : undefined}>{row[ci] ?? ''}</td>
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

      {showMapping && missingRequired.length > 0 && (
        <div className="project-dialog__validation" aria-label="Mapping validation">
          {missingRequired.map((f) => <span key={f.id}>Required: {f.label}</span>)}
        </div>
      )}
    </div>
  )
}
