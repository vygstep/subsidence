import { useState } from 'react'

interface WellOption {
  well_id: string
  well_name: string
}

interface ImportLasDialogProps {
  wells: WellOption[]
  onClose: () => void
  onSuccess: (wellId: string) => Promise<void> | void
}

interface ImportLasResponse {
  well_id: string
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: string }
    if (payload.detail) {
      return payload.detail
    }
  } catch {
    // Ignore non-JSON errors.
  }
  return fallback
}

export function ImportLasDialog({ wells, onClose, onSuccess }: ImportLasDialogProps) {
  const [wellId, setWellId] = useState('')
  const [lasPath, setLasPath] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextPath = lasPath.trim()
    if (!nextPath) {
      setError('LAS path is required')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const response = await fetch('/api/projects/import-las', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          las_path: nextPath,
          well_id: wellId || null,
        }),
      })
      if (!response.ok) {
        throw new Error(await readError(response, `Failed to import LAS (${response.status})`))
      }

      const payload = (await response.json()) as ImportLasResponse
      await onSuccess(payload.well_id)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to import LAS')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="project-dialog" aria-labelledby="import-las-title">
      <header className="project-dialog__header">
        <div>
          <p className="project-dialog__eyebrow">Phase 3</p>
          <h2 id="import-las-title" className="project-dialog__title">Load LAS</h2>
        </div>
        <button type="button" className="project-dialog__link" onClick={onClose}>
          Close
        </button>
      </header>

      <form className="project-dialog__body" onSubmit={handleSubmit}>
        <label className="project-dialog__field">
          <span>Target well</span>
          <select value={wellId} onChange={(event) => setWellId(event.target.value)}>
            <option value="">Create from LAS header/defaults</option>
            {wells.map((well) => (
              <option key={well.well_id} value={well.well_id}>{well.well_name}</option>
            ))}
          </select>
        </label>

        <label className="project-dialog__field">
          <span>LAS file path</span>
          <input
            type="text"
            value={lasPath}
            onChange={(event) => setLasPath(event.target.value)}
            placeholder="D:\\data\\well.las"
            autoFocus
          />
        </label>

        {error && <p className="project-dialog__error">{error}</p>}

        <div className="project-dialog__actions">
          <button type="button" className="project-dialog__button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="project-dialog__button project-dialog__button--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Importing...' : 'Load LAS'}
          </button>
        </div>
      </form>
    </section>
  )
}
