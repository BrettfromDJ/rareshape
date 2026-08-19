import { filenameFor, type ExportRequest, type ExportResult } from './types'

/** Implemented in phase 4, alongside packages/eject. */
export async function exportHtml(_request: ExportRequest): Promise<ExportResult> {
  throw new Error('HTML export lands with packages/eject')
}

export { filenameFor }
