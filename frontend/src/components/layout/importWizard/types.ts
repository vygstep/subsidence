import type { FormEvent, ReactNode } from 'react'

export type ImportWizardDataType = 'logs' | 'tops' | 'deviation' | 'strat-chart'
export type ImportWizardPreviewMode = 'las' | 'tabular'
export type ImportWizardTargetWellPolicy = 'optional' | 'required' | 'none'

export interface ImportWizardPreset {
  id: ImportWizardDataType
  title: string
  eyebrow: string
  submitLabel: string
  busyLabel: string
  previewMode: ImportWizardPreviewMode
  targetWellPolicy: ImportWizardTargetWellPolicy
  acceptedFileFilters: [string, string][]
  executeOperation: string
  executeEndpoint: string
  resultWellField?: string
}

export interface ImportWizardStep {
  id: string
  label: string
  status?: 'active' | 'done' | 'blocked'
}

export interface ImportWizardWellOption {
  well_id: string
  well_name: string
}

export interface ImportWizardShellProps {
  preset: ImportWizardPreset
  titleId: string
  steps?: ImportWizardStep[]
  currentStepIndex?: number
  error: string | null
  isSubmitting: boolean
  canSubmit?: boolean
  canAdvance?: boolean
  validationMessages?: string[]
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onStepChange?: (stepIndex: number) => void
  children: ReactNode
}
