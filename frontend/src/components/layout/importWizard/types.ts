import type { FormEvent, ReactNode } from 'react'

export type ImportWizardDataType = 'logs' | 'tops' | 'unconformities' | 'deviation' | 'strat-chart'
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

export type TabularDelimiter = 'auto' | ',' | '\t' | ';'

export interface TabularParserSettings {
  delimiter: TabularDelimiter
  headerRow: number
}

export interface TabularPreviewResponse {
  columns: string[]
  rows: string[][]
  detected_delimiter: string
  header_row: number
  total_rows: number | null
  warnings: string[]
}

export interface LasPreviewCurve {
  mnemonic: string
  unit: string
  description: string | null
}

export interface LasPreviewResponse {
  well_name: string | null
  well_id: string | null
  depth_unit: string | null
  curves: LasPreviewCurve[]
  start_depth: number | null
  stop_depth: number | null
  step: number | null
  null_value: number | null
  warnings: string[]
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
