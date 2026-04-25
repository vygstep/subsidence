import type { ImportWizardShellProps } from './types'

export function ImportWizardShell({
  preset,
  titleId,
  steps = [{ id: 'select-file', label: 'Select file', status: 'active' }],
  error,
  isSubmitting,
  canSubmit = true,
  onClose,
  onSubmit,
  children,
}: ImportWizardShellProps) {
  return (
    <section className="project-dialog" aria-labelledby={titleId}>
      <header className="project-dialog__header">
        <div>
          <p className="project-dialog__eyebrow">{preset.eyebrow}</p>
          <h2 id={titleId} className="project-dialog__title">{preset.title}</h2>
        </div>
        <button type="button" className="project-dialog__link" onClick={onClose}>
          Close
        </button>
      </header>

      <form className="project-dialog__body" onSubmit={onSubmit}>
        <div className="project-dialog__hint" aria-label="Import steps">
          {steps.map((step, index) => (
            <span key={step.id}>
              {index > 0 ? ' / ' : null}
              {step.label}
            </span>
          ))}
        </div>

        {children}

        {error && <p className="project-dialog__error">{error}</p>}

        <div className="project-dialog__actions">
          <button type="button" className="project-dialog__button" disabled={isSubmitting} onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="project-dialog__button project-dialog__button--primary"
            disabled={isSubmitting || !canSubmit}
          >
            {isSubmitting ? preset.busyLabel : preset.submitLabel}
          </button>
        </div>
      </form>
    </section>
  )
}
