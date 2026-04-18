import { useState } from 'react'

interface CreateWellDialogProps {
  onClose: () => void
  onSuccess: (wellId: string) => Promise<void> | void
}

interface CreateWellResponse {
  well_id: string
  well_name: string
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

export function CreateWellDialog({ onClose, onSuccess }: CreateWellDialogProps) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextName = name.trim()
    if (!nextName) {
      setError('Well name is required')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const response = await fetch('/api/projects/wells', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nextName }),
      })
      if (!response.ok) {
        throw new Error(await readError(response, `Failed to create well (${response.status})`))
      }

      const payload = (await response.json()) as CreateWellResponse
      await onSuccess(payload.well_id)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to create well')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="project-dialog" aria-labelledby="create-well-title">
      <header className="project-dialog__header">
        <div>
          <p className="project-dialog__eyebrow">Phase 3</p>
          <h2 id="create-well-title" className="project-dialog__title">Create Well</h2>
        </div>
        <button type="button" className="project-dialog__link" onClick={onClose}>
          Close
        </button>
      </header>

      <form className="project-dialog__body" onSubmit={handleSubmit}>
        <label className="project-dialog__field">
          <span>Well name</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Pleshet 01"
            autoFocus
          />
        </label>

        {error && <p className="project-dialog__error">{error}</p>}

        <div className="project-dialog__actions">
          <button type="button" className="project-dialog__button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="project-dialog__button project-dialog__button--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Creating…' : 'Create well'}
          </button>
        </div>
      </form>
    </section>
  )
}
