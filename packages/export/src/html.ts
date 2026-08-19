import type { ExportRequest, ExportResult } from './types'

/** Implemented in phase 4, alongside packages/eject. */
export async function exportHtml(request: ExportRequest): Promise<ExportResult> {
  throw new Error(`HTML export for ${request.tool.meta.slug} lands with packages/eject`)
}
