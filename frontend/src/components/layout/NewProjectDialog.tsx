import { useState } from 'react'

import { useProjectStore } from '@/stores'

interface NewProjectDialogProps {
  onSwitchToOpen: () => void
}

export function NewProjectDialog({ onSwitchToOpen }: NewProjectDialogProps) {
  const createProject = useProjectStore((state) => state.createProject)

  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextName = name.trim()
    const nextPath = path.trim()

    if (!nextName) {
      setError('Project name is required')
      return
    }

    if (!nextPath) {
      setError('Project location is required')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await createProject(nextName, nextPath)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to create project')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="project-dialog" aria-labelledby="project-new-title">
      <header className="project-dialog__header">
        <div>
          <p className="project-dialog__eyebrow">Phase 3</p>
          <h2 id="project-new-title" className="project-dialog__title">New Project</h2>
        </div>
        <button type="button" className="project-dialog__link" onClick={onSwitchToOpen}>
          Open existing
        </button>
      </header>

      <form className="project-dialog__body" onSubmit={handleSubmit}>
        <label className="project-dialog__field">
          <span>Project name</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Example Basin Study"
            autoFocus
          />
        </label>

        <label className="project-dialog__field">
          <span>Location</span>
          <input
            type="text"
            value={path}
            onChange={(event) => setPath(event.target.value)}
            placeholder="D:\\projects"
          />
        </label>

        <p className="project-dialog__hint">The app will create a <code>.subsidence</code> bundle inside the selected directory.</p>

        {error && <p className="project-dialog__error">{error}</p>}

        <div className="project-dialog__actions">
          <button type="submit" className="project-dialog__button project-dialog__button--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Creating?' : 'Create project'}
          </button>
        </div>
      </form>
    </section>
  )
}
