import { useEffect, useState } from 'react'

import { useWellDataStore } from '@/stores'
import type { UnitDimensionDetail, UnitDimensionSummary } from '@/types'

function formatFactor(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toPrecision(10).replace(/0+$/, '').replace(/\.$/, '')
}

export function UnitDimensionSettings({ dimension }: { dimension: UnitDimensionSummary }) {
  const fetchUnitDimension = useWellDataStore((state) => state.fetchUnitDimension)
  const [detail, setDetail] = useState<UnitDimensionDetail | null>(null)

  useEffect(() => {
    let cancelled = false
    setDetail(null)
    void fetchUnitDimension(dimension.code).then((next) => {
      if (!cancelled) {
        setDetail(next)
      }
    })
    return () => {
      cancelled = true
    }
  }, [dimension.code, fetchUnitDimension])

  const resolved = detail ?? { ...dimension, units: [] }

  return (
    <div className="template-panel template-panel--muted">
      <div className="template-panel__group">
        <div className="template-panel__label">Unit Dimension</div>
        <div className="template-panel__value">{resolved.display_name}</div>
      </div>
      <div className="template-panel__group">
        <div className="template-panel__label">Engine Unit</div>
        <div className="template-panel__value">{resolved.engine_unit_code}</div>
      </div>
      <div className="dm-table-wrapper">
        <table className="dm-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Symbol</th>
              <th>Name</th>
              <th>Factor</th>
              <th>Offset</th>
              <th>Aliases</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {resolved.units.map((unit) => (
              <tr key={unit.code} className={unit.is_builtin ? 'dm-table__row--builtin' : ''}>
                <td>{unit.code}</td>
                <td>{unit.symbol}</td>
                <td>{unit.display_name}</td>
                <td>{formatFactor(unit.to_engine_factor)}</td>
                <td>{formatFactor(unit.to_engine_offset)}</td>
                <td>{unit.aliases.map((alias) => alias.alias).join(', ')}</td>
                <td>{unit.is_active ? 'Yes' : 'No'}</td>
              </tr>
            ))}
            {resolved.units.length === 0 ? (
              <tr className="dm-table__empty-row">
                <td colSpan={7}>No units loaded for this dimension.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
