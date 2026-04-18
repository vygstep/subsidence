import { useEffect, useState } from 'react'

import { useProjectStore } from '@/stores'

interface FileOpenDialogProps {
  onSwitchToNew: () => void
}

function formatTimestamp(value: string): string | null {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  return parsed.toLocaleString()
}

export function FileOpenDialog({ onSwitchToNew }: FileOpenDialogProps) {
  const recentProjects = useProjectStore((state) => state.recentProjects)
  const loadRecentProjects = useProjectStore((state) => state.loadRecentProjects)
  const openProject = useProjectStore((state) => state.openProject)

  const [path, setPath] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false

    const hydrate = async () => {
      try {
        await loadRecentProjects()
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Failed to load recent projects')
        }
      }
    }

    void hydrate()
    return () => {
      cancelled = true
    }
  }, [loadRecentProjects])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextPath = path.trim()
    if (!nextPath) {
      setError('Project path is required')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await openProject(nextPath)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to open project')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="project-dialog" aria-labelledby="project-open-title">
      <header className="project-dialog__header">
        <div>
          <p className="project-dialog__eyebrow">Phase 3</p>
          <h2 id="project-open-title" className="project-dialog__title">Open Project</h2>
        </div>
        <button type="button" className="project-dialog__link" onClick={onSwitchToNew}>
          New project
        </button>
      </header>

      <form className="project-dialog__body" onSubmit={handleSubmit}>
        <label className="project-dialog__field">
          <span>Project bundle path</span>
          <input
            type="text"
            value={path}
            onChange={(event) => setPath(event.target.value)}
            placeholder="D:\\projects\\example.subsidence"
            autoFocus
          />
        </label>

        <div className="project-dialog__section">
          <div className="project-dialog__section-header">
            <h3>Recent projects</h3>
            <span>{recentProjects.length}</span>
          </div>
          {recentProjects.length === 0 ? (
            <p className="project-dialog__empty">No recent projects yet.</p>
          ) : (
            <div className="project-dialog__recent-list">
              {recentProjects.map((project) => (
                <button
                  key={project.path}
                  type="button"
                  className="project-dialog__recent-item"
                  onClick={() => {
                    setPath(project.path)
                    setError(null)
                  }}
                >
                  <span className="project-dialog__recent-name">{project.name}</span>
                  <span className="project-dialog__recent-path">{project.path}</span>
                  {formatTimestamp(project.lastOpened) && (
                    <span className="project-dialog__recent-time">{formatTimestamp(project.lastOpened)}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <p className="project-dialog__error">{error}</p>}

        <div className="project-dialog__actions">
          <button type="submit" className="project-dialog__button project-dialog__button--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Opening?' : 'Open project'}
          </button>
        </div>
      </form>
    </section>
  )
}
