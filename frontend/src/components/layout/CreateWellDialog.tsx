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
  const [x, setX] = useState('0')
  const [y, setY] = useState('0')
  const [kb, setKb] = useState('10')
  const [td, setTd] = useState('')
  const [crs, setCrs] = useState('unset')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextName = name.trim()
    if (!nextName) {
      setError('Well name is required')
      return
    }

    const parsedX = Number(x)
    const parsedY = Number(y)
    const parsedKb = Number(kb)
    const parsedTd = td.trim() ? Number(td) : null
    if (Number.isNaN(parsedX) || Number.isNaN(parsedY) || Number.isNaN(parsedKb) || (parsedTd !== null && Number.isNaN(parsedTd))) {
      setError('Well metadata must contain valid numeric values')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const response = await fetch('/api/projects/wells', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nextName,
          x: parsedX,
          y: parsedY,
          kb: parsedKb,
          td: parsedTd,
          crs: crs.trim() || 'unset',
        }),
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

        <div className="project-dialog__grid">
          <label className="project-dialog__field">
            <span>Project X</span>
            <input type="number" value={x} onChange={(event) => setX(event.target.value)} />
          </label>
          <label className="project-dialog__field">
            <span>Project Y</span>
            <input type="number" value={y} onChange={(event) => setY(event.target.value)} />
          </label>
          <label className="project-dialog__field">
            <span>KB</span>
            <input type="number" value={kb} onChange={(event) => setKb(event.target.value)} />
          </label>
          <label className="project-dialog__field">
            <span>TD</span>
            <input type="number" value={td} onChange={(event) => setTd(event.target.value)} placeholder="Optional" />
          </label>
        </div>

        <label className="project-dialog__field">
          <span>CRS</span>
          <input type="text" value={crs} onChange={(event) => setCrs(event.target.value)} placeholder="unset" />
        </label>

        {error && <p className="project-dialog__error">{error}</p>}

        <div className="project-dialog__actions">
          <button type="button" className="project-dialog__button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="project-dialog__button project-dialog__button--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create well'}
          </button>
        </div>
      </form>
    </section>
  )
}
