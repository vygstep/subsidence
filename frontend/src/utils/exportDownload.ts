function filenameFromContentDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback
  const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1])
    } catch {
      return utfMatch[1]
    }
  }
  const match = /filename="?([^";]+)"?/i.exec(header)
  return match?.[1] ?? fallback
}

export async function downloadResponse(response: Response, fallbackFilename: string): Promise<string> {
  if (!response.ok) {
    let detail = `Export failed (${response.status})`
    try {
      const payload = (await response.json()) as { detail?: string }
      detail = payload.detail ?? detail
    } catch {
      // keep generic error
    }
    throw new Error(detail)
  }

  const blob = await response.blob()
  const filename = filenameFromContentDisposition(response.headers.get('content-disposition'), fallbackFilename)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
  return filename
}

export async function downloadUrl(url: string, fallbackFilename: string): Promise<string> {
  const response = await fetch(url)
  return downloadResponse(response, fallbackFilename)
}
