import { useEffect, useState } from 'react'

import { useWellDataStore } from '@/stores'
import type { LithologySetDetail, LithologySetSummary } from '@/types'

function formatOrDash(value: number | null, digits: number): string {
  return value === null ? '-' : value.toFixed(digits)
}

export function LithologySetSettings({ lithologySet }: { lithologySet: LithologySetSummary }) {
  const fetchLithologySet = useWellDataStore((state) => state.fetchLithologySet)
  const [detail, setDetail] = useState<LithologySetDetail | null>(null)

  useEffect(() => {
    let cancelled = false
    setDetail(null)
    void fetchLithologySet(lithologySet.id).then((next) => {
      if (!cancelled) {
        setDetail(next)
      }
    })
    return () => {
      cancelled = true
    }
  }, [fetchLithologySet, lithologySet.id])

  const resolved = detail ?? { ...lithologySet, entries: [] }

  return (
    <div className={`template-panel ${resolved.is_builtin ? 'template-panel--muted' : ''}`}>
      <div className="template-panel__group">
        <div className="template-panel__label">Lithology Set</div>
        <div className="template-panel__value">{resolved.name}</div>
      </div>
      <div className="template-table-wrapper">
        <table className="template-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Color</th>
              <th>Pattern</th>
              <th>Compaction preset</th>
              <th>Density</th>
              <th>Phi0</th>
              <th>C</th>
            </tr>
          </thead>
          <tbody>
            {resolved.entries.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.lithology_code}</td>
                <td>{entry.display_name}</td>
                <td>
                  <span className="template-color-chip" style={{ backgroundColor: entry.color_hex }} />
                  {entry.color_hex}
                </td>
                <td>{entry.pattern_id ?? 'Solid fill'}</td>
                <td>{entry.compaction_preset_label ?? '-'}</td>
                <td>{formatOrDash(entry.density, 0)}</td>
                <td>{formatOrDash(entry.porosity_surface, 2)}</td>
                <td>{formatOrDash(entry.compaction_coeff, 3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sidebar-panel__empty">
        {resolved.is_builtin
          ? 'Default Lithologies is read-only.'
          : 'User lithology-set editing will be enabled in the next templates step.'}
      </p>
    </div>
  )
}
