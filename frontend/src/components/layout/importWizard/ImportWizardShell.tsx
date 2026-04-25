import type { ImportWizardShellProps } from './types'

export function ImportWizardShell({
  preset,
  titleId,
  steps = [{ id: 'select-file', label: 'Select file', status: 'active' }],
  currentStepIndex = 0,
  error,
  isSubmitting,
  canSubmit = true,
  canAdvance = true,
  validationMessages = [],
  onClose,
  onSubmit,
  onStepChange,
  children,
}: ImportWizardShellProps) {
  const finalStepIndex = steps.length - 1
  const isFinalStep = currentStepIndex >= finalStepIndex

  const goBack = () => {
    if (!onStepChange || currentStepIndex <= 0) return
    onStepChange(currentStepIndex - 1)
  }

  const goNext = () => {
    if (!onStepChange || isFinalStep || !canAdvance) return
    onStepChange(currentStepIndex + 1)
  }

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
        <div className="project-dialog__steps" aria-label="Import steps">
          {steps.map((step) => (
            <span key={step.id} className={`project-dialog__step project-dialog__step--${step.status ?? 'blocked'}`}>
              {step.label}
            </span>
          ))}
        </div>

        {children}

        {validationMessages.length > 0 ? (
          <div className="project-dialog__validation" aria-label="Validation summary">
            {validationMessages.map((message) => (
              <span key={message}>{message}</span>
            ))}
          </div>
        ) : null}

        {error && <p className="project-dialog__error">{error}</p>}

        <div className="project-dialog__actions">
          <button type="button" className="project-dialog__button" disabled={isSubmitting} onClick={onClose}>
            Cancel
          </button>
          {currentStepIndex > 0 ? (
            <button type="button" className="project-dialog__button" disabled={isSubmitting} onClick={goBack}>
              Back
            </button>
          ) : null}
          {isFinalStep ? (
            <button
              type="submit"
              className="project-dialog__button project-dialog__button--primary"
              disabled={isSubmitting || !canSubmit}
            >
              {isSubmitting ? preset.busyLabel : preset.submitLabel}
            </button>
          ) : (
            <button
              type="button"
              className="project-dialog__button project-dialog__button--primary"
              disabled={isSubmitting || !canAdvance}
              onClick={goNext}
            >
              Next
            </button>
          )}
        </div>
      </form>
    </section>
  )
}
