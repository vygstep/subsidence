import type { ColumnMapping, FieldDefinition } from './mapping'

interface MappingPaneProps {
  columns: string[]
  fields: FieldDefinition[]
  mapping: ColumnMapping
  validationErrors: string[]
  onMappingChange: (fieldId: string, column: string | null) => void
}

export function MappingPane({ columns, fields, mapping, validationErrors, onMappingChange }: MappingPaneProps) {
  return (
    <div className="import-mapping">
      {validationErrors.length > 0 && (
        <div className="project-dialog__validation" aria-label="Mapping validation">
          {validationErrors.map((e) => <span key={e}>{e}</span>)}
        </div>
      )}

      <table className="import-mapping__table">
        <thead>
          <tr>
            <th>Field</th>
            <th>Source column</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => {
            const value = mapping[field.id] ?? ''
            const isMapped = !!mapping[field.id]
            return (
              <tr key={field.id}>
                <td className="import-mapping__label">
                  {field.label}
                </td>
                <td>
                  <select
                    value={value}
                    onChange={(e) => onMappingChange(field.id, e.target.value || null)}
                  >
                    <option value="">— not mapped —</option>
                    {columns.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </td>
                <td className="import-mapping__status">
                  {field.required ? (
                    isMapped
                      ? <span className="import-mapping__status--ok">✓</span>
                      : <span className="import-mapping__status--missing">required</span>
                  ) : (
                    <span className="import-mapping__status--optional">optional</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
