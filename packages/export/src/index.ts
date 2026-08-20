import type { Tool } from '@rareshape/schema'
import { exportGif } from './gif'
import { canExportMp4, exportMp4 } from './mp4'
import { exportPng } from './png'
import { exportAnimatedSvg, exportSvg } from './svg'
import { exportHtml } from './html'
import type { ExportFormat, ExportRequest, ExportResult } from './types'

export * from './types'
export { createFrameRenderer, svgMarkup } from './render-frame'
export { canExportMp4, h264Candidates, isMp4Supported } from './mp4'
export { optimizeSvg } from './svgo'
export { buildHtmlDocument, THREE_CDN } from './html'

export async function runExport(request: ExportRequest): Promise<ExportResult> {
  switch (request.format) {
    case 'png':
      return exportPng(request)
    case 'svg':
      return exportSvg(request)
    case 'svg-animated':
      return exportAnimatedSvg(request)
    case 'gif':
      return exportGif(request)
    case 'mp4':
      return exportMp4(request)
    case 'html':
      return exportHtml(request)
  }
}

export interface FormatOption {
  format: ExportFormat
  label: string
  /** Formats that step frames show duration and fps in the sheet. */
  animated: boolean
}

/**
 * What this tool can produce in this browser. MP4 is dropped entirely where
 * WebCodecs is missing rather than offered and then failing.
 */
export function availableFormats(tool: Tool, mp4Supported = canExportMp4()): FormatOption[] {
  const out: FormatOption[] = [{ format: 'png', label: 'PNG', animated: false }]

  if (tool.meta.engine === 'svg') {
    out.push({ format: 'svg', label: 'SVG', animated: false })
    if (tool.meta.animated) {
      out.push({ format: 'svg-animated', label: 'SVG loop', animated: true })
    }
  }

  if (tool.meta.animated) {
    if (mp4Supported) out.push({ format: 'mp4', label: 'MP4', animated: true })
    out.push({ format: 'gif', label: 'GIF', animated: true })
  }

  out.push({ format: 'html', label: 'Standalone HTML', animated: false })
  return out
}

/** Hands the file to the browser. Revoked on the next tick, not left to leak. */
export function download(result: ExportResult): void {
  const url = URL.createObjectURL(result.blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = result.filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** `1.4 MB`, `212 KB` — the size readout in the sheet. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
