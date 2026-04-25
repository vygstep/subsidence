import type { UnitDimensionSummary } from '@/types'

export function MeasurementUnitsRootSettings({ dimensions }: { dimensions: UnitDimensionSummary[] }) {
  const totalUnits = dimensions.reduce((sum, dimension) => sum + dimension.unit_count, 0)
  const totalAliases = dimensions.reduce((sum, dimension) => sum + dimension.alias_count, 0)

  return (
    <div className="template-panel">
      <div className="template-panel__group">
        <div className="template-panel__label">Measurement Units</div>
        <div className="template-panel__value">{dimensions.length}</div>
      </div>
      <div className="template-panel__group">
        <div className="template-panel__label">Units</div>
        <div className="template-panel__value">{totalUnits}</div>
      </div>
      <div className="template-panel__group">
        <div className="template-panel__label">Aliases</div>
        <div className="template-panel__value">{totalAliases}</div>
      </div>
      <div className="dm-table-wrapper">
        <table className="dm-table">
          <thead>
            <tr>
              <th>Dimension</th>
              <th>Engine Unit</th>
              <th>Units</th>
              <th>Aliases</th>
              <th>Kind</th>
            </tr>
          </thead>
          <tbody>
            {dimensions.map((dimension) => (
              <tr key={dimension.code} className={dimension.is_builtin ? 'dm-table__row--builtin' : ''}>
                <td>{dimension.display_name}</td>
                <td>{dimension.engine_unit_code}</td>
                <td>{dimension.unit_count}</td>
                <td>{dimension.alias_count}</td>
                <td>{dimension.is_builtin ? 'Built-in' : 'User'}</td>
              </tr>
            ))}
            {dimensions.length === 0 ? (
              <tr className="dm-table__empty-row">
                <td colSpan={5}>No measurement units loaded.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
