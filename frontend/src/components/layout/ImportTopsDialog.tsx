import { useState } from 'react'

interface WellOption {
  well_id: string
  well_name: string
}

interface ImportTopsDialogProps {
  wells: WellOption[]
  onClose: () => void
  onSuccess: (wellId: string) => Promise<void> | void
}

interface ImportTopsResponse {
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

export function ImportTopsDialog({ wells, onClose, onSuccess }: ImportTopsDialogProps) {
  const [wellId, setWellId] = useState(wells[0]?.well_id ?? '')
  const [csvPath, setCsvPath] = useState('')
  const [depthRef, setDepthRef] = useState<'MD' | 'TVD' | 'TVDSS'>('MD')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextPath = csvPath.trim()
    if (!wellId) {
      setError('Select a well first')
      return
    }
    if (!nextPath) {
      setError('CSV path is required')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const response = await fetch('/api/projects/import-tops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ well_id: wellId, csv_path: nextPath, depth_ref: depthRef }),
      })
      if (!response.ok) {
        throw new Error(await readError(response, `Failed to import tops (${response.status})`))
      }

      const payload = (await response.json()) as ImportTopsResponse
      await onSuccess(payload.well_id)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to import tops')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="project-dialog" aria-labelledby="import-tops-title">
      <header className="project-dialog__header">
        <div>
          <p className="project-dialog__eyebrow">Phase 3</p>
          <h2 id="import-tops-title" className="project-dialog__title">Load Tops</h2>
        </div>
        <button type="button" className="project-dialog__link" onClick={onClose}>
          Close
        </button>
      </header>

      <form className="project-dialog__body" onSubmit={handleSubmit}>
        <label className="project-dialog__field">
          <span>Well</span>
          <select value={wellId} onChange={(event) => setWellId(event.target.value)}>
            {wells.map((well) => (
              <option key={well.well_id} value={well.well_id}>{well.well_name}</option>
            ))}
          </select>
        </label>

        <label className="project-dialog__field">
          <span>Tops CSV path</span>
          <input
            type="text"
            value={csvPath}
            onChange={(event) => setCsvPath(event.target.value)}
            placeholder="D:\\data\\tops.csv"
            autoFocus
          />
        </label>

        <label className="project-dialog__field">
          <span>Depth reference</span>
          <select value={depthRef} onChange={(event) => setDepthRef(event.target.value as 'MD' | 'TVD' | 'TVDSS')}>
            <option value="MD">MD</option>
            <option value="TVD">TVD</option>
            <option value="TVDSS">TVDSS</option>
          </select>
        </label>

        {error && <p className="project-dialog__error">{error}</p>}

        <div className="project-dialog__actions">
          <button type="button" className="project-dialog__button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="project-dialog__button project-dialog__button--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Importing…' : 'Load tops'}
          </button>
        </div>
      </form>
    </section>
  )
}
