import type { MultiFileImportItem, MultiFileImportSummary } from './multiFileQueue'

interface MultiFileCurrentFileProps {
  currentIndex: number
  total: number
  path: string
}

interface MultiFileSummaryProps {
  queue: MultiFileImportItem[]
  summary: MultiFileImportSummary
}

export function MultiFileCurrentFile({ currentIndex, total, path }: MultiFileCurrentFileProps) {
  return (
    <div className="import-preview__status">
      File {currentIndex + 1} of {total}: {path}
    </div>
  )
}

export function MultiFileSummary({ queue, summary }: MultiFileSummaryProps) {
  return (
    <div className="import-preview">
      <p className="import-preview__status">
        Imported {summary.imported} of {summary.total} files.
        {summary.failed > 0 ? ` Failed: ${summary.failed}.` : ''}
        {summary.skipped > 0 ? ` Skipped: ${summary.skipped}.` : ''}
      </p>
      <div className="import-preview__table-wrap">
        <table className="import-preview__table">
          <thead>
            <tr>
              <th>File</th>
              <th>Status</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((item) => (
              <tr key={item.path}>
                <td>{item.path}</td>
                <td>{item.status}</td>
                <td>{item.message ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
