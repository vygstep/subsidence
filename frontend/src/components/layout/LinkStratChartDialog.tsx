import { useEffect, useState } from 'react'

import type { StratUnitOption } from '@/types'

interface LinkStratChartDialogProps {
  formationName: string
  currentUnitId?: number | null
  onClose: () => void
  onSelect: (stratUnitId: number | null) => Promise<void> | void
}

async function fetchStratUnits(query: string): Promise<StratUnitOption[]> {
  const params = new URLSearchParams()
  if (query.trim()) {
    params.set('q', query.trim())
  }
  const response = await fetch(`/api/strat-units?${params.toString()}`)
  if (!response.ok) {
    throw new Error(`Failed to load strat chart options (${response.status})`)
  }
  return (await response.json()) as StratUnitOption[]
}

export function LinkStratChartDialog({
  formationName,
  currentUnitId,
  onClose,
  onSelect,
}: LinkStratChartDialogProps) {
  const [query, setQuery] = useState(formationName)
  const [options, setOptions] = useState<StratUnitOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    void fetchStratUnits(query)
      .then((rows) => {
        if (!cancelled) {
          setOptions(rows)
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Unknown error')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [query])

  return (
    <div className="project-dialog">
      <header className="project-dialog__header">
        <div>
          <p className="project-dialog__eyebrow">Stratigraphy</p>
          <h2 className="project-dialog__title">Link to strat chart</h2>
        </div>
        <button type="button" className="project-dialog__link" onClick={onClose}>
          Close
        </button>
      </header>

      <div className="project-dialog__body">
        <label className="project-dialog__field">
          <span>Search strat chart</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Type a unit name" />
        </label>

        {error ? <p className="project-dialog__error">{error}</p> : null}

        <div className="project-dialog__section">
          <div className="project-dialog__section-header">
            <h3>Matches</h3>
            <span>{isLoading ? 'Loading…' : `${options.length} found`}</span>
          </div>

          <div className="project-dialog__recent-list">
            <button
              type="button"
              className="project-dialog__recent-item"
              onClick={() => void onSelect(null)}
            >
              <span className="project-dialog__recent-name">Unlink from strat chart</span>
              <span className="project-dialog__recent-path">Clear the current optional mapping.</span>
            </button>

            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                className="project-dialog__recent-item"
                onClick={() => void onSelect(option.id)}
              >
                <span className="project-dialog__recent-name">
                  {option.name}
                  {option.id === currentUnitId ? ' · linked' : ''}
                </span>
                <span className="project-dialog__recent-path">
                  {option.rank ?? 'rank unset'}
                </span>
                <span className="project-dialog__recent-time">{option.color_hex ?? 'no color'}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
