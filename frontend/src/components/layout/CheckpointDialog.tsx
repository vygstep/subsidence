import { useEffect, useMemo, useState } from 'react'

import type { Checkpoint, CheckpointStatistics } from '@/stores/projectStore'

const RESTORE_WARNING = 'Reverting will replace the current project state. Unsaved/current changes can be lost. If you want to preserve the current state, create a checkpoint first.'

interface CheckpointDialogProps {
  mode: 'create' | 'restore'
  currentStatistics: CheckpointStatistics
  createCheckpoint: (name?: string, description?: string) => Promise<Checkpoint>
  listCheckpoints: () => Promise<Checkpoint[]>
  restoreCheckpoint: (checkpointId: number) => Promise<Checkpoint>
  onClose: () => void
}

function formatDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown date'
  return date.toLocaleString()
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = value
  let index = 0
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index += 1
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function compactWellNames(names: string[]): string {
  if (names.length === 0) return 'None'
  if (names.length <= 6) return names.join(', ')
  return `${names.slice(0, 6).join(', ')} +${names.length - 6} more`
}

function StatisticsSummary({ statistics }: { statistics: CheckpointStatistics | null }) {
  if (!statistics) {
    return <p className="project-dialog__empty">No statistics were recorded for this checkpoint.</p>
  }

  return (
    <div className="checkpoint-summary">
      <div className="checkpoint-summary__row">
        <span className="checkpoint-summary__label">Project</span>
        <span className="checkpoint-summary__value">{statistics.project_name ?? '-'}</span>
      </div>
      <div className="checkpoint-summary__row">
        <span className="checkpoint-summary__label">Wells</span>
        <span className="checkpoint-summary__value">{statistics.well_count} ({compactWellNames(statistics.well_names)})</span>
      </div>
      <div className="checkpoint-summary__row">
        <span className="checkpoint-summary__label">Log curves</span>
        <span className="checkpoint-summary__value">{statistics.log_curve_count}</span>
      </div>
      <div className="checkpoint-summary__row">
        <span className="checkpoint-summary__label">Top picks</span>
        <span className="checkpoint-summary__value">{statistics.top_pick_count}</span>
      </div>
      <div className="checkpoint-summary__row">
        <span className="checkpoint-summary__label">TopSets</span>
        <span className="checkpoint-summary__value">{statistics.top_set_count}</span>
      </div>
      <div className="checkpoint-summary__row">
        <span className="checkpoint-summary__label">StratCharts</span>
        <span className="checkpoint-summary__value">{statistics.strat_chart_count}</span>
      </div>
      <div className="checkpoint-summary__row">
        <span className="checkpoint-summary__label">Sea level curves</span>
        <span className="checkpoint-summary__value">{statistics.sea_level_curve_count}</span>
      </div>
      <div className="checkpoint-summary__row">
        <span className="checkpoint-summary__label">Deviation surveys</span>
        <span className="checkpoint-summary__value">{statistics.deviation_survey_count}</span>
      </div>
    </div>
  )
}

export function CheckpointDialog({
  mode,
  currentStatistics,
  createCheckpoint,
  listCheckpoints,
  restoreCheckpoint,
  onClose,
}: CheckpointDialogProps) {
  const [comment, setComment] = useState('')
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(mode === 'restore')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const createdAt = useMemo(() => new Date(), [])

  useEffect(() => {
    if (mode !== 'restore') return
    let cancelled = false
    setIsLoading(true)
    setError(null)
    listCheckpoints()
      .then((items) => {
        if (cancelled) return
        setCheckpoints(items)
        setSelectedId(items[0]?.id ?? null)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setError(cause instanceof Error ? cause.message : 'Failed to load checkpoints.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [listCheckpoints, mode])

  const selectedCheckpoint = checkpoints.find((checkpoint) => checkpoint.id === selectedId) ?? null

  async function handleCreate(): Promise<void> {
    setIsSubmitting(true)
    setError(null)
    try {
      await createCheckpoint(undefined, comment.trim())
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to create checkpoint.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRestore(): Promise<void> {
    if (!selectedCheckpoint) return
    if (!window.confirm(RESTORE_WARNING)) return
    setIsSubmitting(true)
    setError(null)
    try {
      await restoreCheckpoint(selectedCheckpoint.id)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to restore checkpoint.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (mode === 'create') {
    return (
      <div className="project-dialog">
        <header className="project-dialog__header">
          <div>
            <p className="project-dialog__eyebrow">Project checkpoint</p>
            <h2 className="project-dialog__title">Create checkpoint</h2>
          </div>
        </header>
        <div className="project-dialog__body">
          <label className="project-dialog__field">
            Date
            <input type="text" value={formatDate(createdAt)} readOnly />
          </label>
          <label className="project-dialog__field">
            User comment
            <textarea rows={3} value={comment} onChange={(event) => setComment(event.target.value)} />
          </label>
          <section className="project-dialog__section">
            <div className="project-dialog__section-header">
              <h3>Project statistics</h3>
            </div>
            <StatisticsSummary statistics={currentStatistics} />
          </section>
          {error ? <p className="project-dialog__error">{error}</p> : null}
          <div className="project-dialog__actions">
            <button type="button" className="project-dialog__button" onClick={onClose} disabled={isSubmitting}>Cancel</button>
            <button type="button" className="project-dialog__button project-dialog__button--primary" onClick={() => void handleCreate()} disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create checkpoint'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="project-dialog">
      <header className="project-dialog__header">
        <div>
          <p className="project-dialog__eyebrow">Project checkpoint</p>
          <h2 className="project-dialog__title">Revert from checkpoint</h2>
        </div>
      </header>
      <div className="project-dialog__body">
        {isLoading ? (
          <p className="project-dialog__empty">Loading checkpoints...</p>
        ) : checkpoints.length === 0 ? (
          <p className="project-dialog__empty">No checkpoints available.</p>
        ) : (
          <div className="checkpoint-restore-layout">
            <div className="project-dialog__recent-list checkpoint-restore-layout__list">
              {checkpoints.map((checkpoint) => (
                <button
                  key={checkpoint.id}
                  type="button"
                  className={`project-dialog__recent-item ${checkpoint.id === selectedId ? 'project-dialog__recent-item--active' : ''}`}
                  onClick={() => setSelectedId(checkpoint.id)}
                >
                  <span className="project-dialog__recent-name">{checkpoint.name}</span>
                  <span className="project-dialog__recent-path">{checkpoint.description || 'No user comment'}</span>
                  <span className="project-dialog__recent-time">{formatDate(checkpoint.timestamp)} | {formatBytes(checkpoint.byte_size)}</span>
                </button>
              ))}
            </div>
            <section className="checkpoint-preview">
              <div className="project-dialog__section-header">
                <h3>Selected checkpoint</h3>
              </div>
              {selectedCheckpoint ? (
                <>
                  <p className="checkpoint-preview__comment">{selectedCheckpoint.description || 'No user comment'}</p>
                  <p className="project-dialog__hint">
                    {formatDate(selectedCheckpoint.timestamp)} | app {selectedCheckpoint.app_version} | schema {selectedCheckpoint.schema_version}
                  </p>
                  <StatisticsSummary statistics={selectedCheckpoint.statistics} />
                </>
              ) : (
                <p className="project-dialog__empty">Select a checkpoint to preview.</p>
              )}
            </section>
          </div>
        )}
        {error ? <p className="project-dialog__error">{error}</p> : null}
        <div className="project-dialog__actions">
          <button type="button" className="project-dialog__button" onClick={onClose} disabled={isSubmitting}>Cancel</button>
          <button
            type="button"
            className="project-dialog__button project-dialog__button--primary"
            onClick={() => void handleRestore()}
            disabled={!selectedCheckpoint || isSubmitting}
          >
            {isSubmitting ? 'Reverting...' : 'Revert'}
          </button>
        </div>
      </div>
    </div>
  )
}
