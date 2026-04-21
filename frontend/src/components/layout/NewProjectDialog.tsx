import { useState } from 'react'

import { useProjectStore } from '@/stores'

import { getLastProjectRoot, pickFolder } from './pathMemory'

interface NewProjectDialogProps {
  onSwitchToOpen: () => void
  onClose?: () => void
}

export function NewProjectDialog({ onSwitchToOpen, onClose }: NewProjectDialogProps) {
  const createProject = useProjectStore((state) => state.createProject)

  const [name, setName] = useState('')
  const [path, setPath] = useState(() => getLastProjectRoot())
  const [overwrite, setOverwrite] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const lastProjectRoot = getLastProjectRoot()

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
      await createProject(nextName, nextPath, overwrite)
      onClose?.()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to create project')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBrowse = async () => {
    setError(null)
    try {
      const picked = await pickFolder(path || lastProjectRoot)
      if (picked) {
        setPath(picked)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to open folder picker')
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
          <div className="project-dialog__field-row">
            <input
              type="text"
              value={path}
              onChange={(event) => setPath(event.target.value)}
              placeholder="D:\\projects"
            />
            <div className="project-dialog__path-actions">
              <button type="button" className="project-dialog__path-action" disabled={!lastProjectRoot} onClick={() => setPath(lastProjectRoot)}>
                Use last folder
              </button>
              <button type="button" className="project-dialog__path-action" onClick={() => void handleBrowse()}>
                Browse...
              </button>
            </div>
          </div>
        </label>

        <p className="project-dialog__hint">The app will create a <code>.subsidence</code> bundle inside the selected directory.</p>

        <label className="project-dialog__checkbox">
          <input
            type="checkbox"
            checked={overwrite}
            onChange={(event) => setOverwrite(event.target.checked)}
          />
          <span>Overwrite existing project bundle if it already exists</span>
        </label>

        {error && <p className="project-dialog__error">{error}</p>}

        <div className="project-dialog__actions">
          {onClose && (
            <button type="button" className="project-dialog__button" onClick={onClose}>
              Cancel
            </button>
          )}
          <button type="submit" className="project-dialog__button project-dialog__button--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create project'}
          </button>
        </div>
      </form>
    </section>
  )
}
