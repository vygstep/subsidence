import { useCallback, useEffect, useRef, useState } from 'react'

import type {
  LasPreviewResponse,
  TabularParserSettings,
  TabularPreviewResponse,
} from './types'

const DEFAULT_TABULAR_SETTINGS: TabularParserSettings = {
  delimiter: 'auto',
  headerRow: 0,
}

interface UseImportPreviewResult {
  isLoading: boolean
  error: string | null
  tabularPreview: TabularPreviewResponse | null
  lasPreview: LasPreviewResponse | null
  parserSettings: TabularParserSettings
  updateParserSettings: (patch: Partial<TabularParserSettings>) => void
}

export function useImportPreview(
  mode: 'tabular' | 'las',
  filePath: string,
  isActive: boolean,
): UseImportPreviewResult {
  const [parserSettings, setParserSettings] = useState<TabularParserSettings>(DEFAULT_TABULAR_SETTINGS)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tabularPreview, setTabularPreview] = useState<TabularPreviewResponse | null>(null)
  const [lasPreview, setLasPreview] = useState<LasPreviewResponse | null>(null)

  const cancelRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!isActive || !filePath.trim()) return

    const controller = new AbortController()
    cancelRef.current?.abort()
    cancelRef.current = controller

    setIsLoading(true)
    setError(null)

    const run = async () => {
      try {
        if (mode === 'tabular') {
          const response = await fetch('/api/import-preview/tabular', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file_path: filePath.trim(),
              delimiter: parserSettings.delimiter,
              header_row: parserSettings.headerRow,
            }),
            signal: controller.signal,
          })
          if (!response.ok) {
            throw new Error(`Preview failed (${response.status})`)
          }
          const data = (await response.json()) as TabularPreviewResponse
          setTabularPreview(data)
        } else {
          const response = await fetch('/api/import-preview/las', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_path: filePath.trim() }),
            signal: controller.signal,
          })
          if (!response.ok) {
            throw new Error(`Preview failed (${response.status})`)
          }
          const data = (await response.json()) as LasPreviewResponse
          setLasPreview(data)
        }
      } catch (cause) {
        if ((cause as { name?: string }).name === 'AbortError') return
        setError(cause instanceof Error ? cause.message : 'Preview failed')
      } finally {
        setIsLoading(false)
      }
    }

    void run()
    return () => { controller.abort() }
  }, [isActive, filePath, mode, parserSettings.delimiter, parserSettings.headerRow])

  const updateParserSettings = useCallback((patch: Partial<TabularParserSettings>) => {
    setParserSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  return { isLoading, error, tabularPreview, lasPreview, parserSettings, updateParserSettings }
}
