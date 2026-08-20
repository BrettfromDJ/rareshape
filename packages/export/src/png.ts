import { assertLive, filenameFor, type ExportRequest, type ExportResult } from './types'
import { createFrameRenderer } from './render-frame'

/**
 * PNG at 1×, 2× or 4×. Transparency is real: nothing is painted behind the
 * frame unless the request asks for a background.
 */
export async function exportPng(request: ExportRequest): Promise<ExportResult> {
  const { tool, module: renderModule, params, width, height, scale, seed, signal } = request
  assertLive(signal)

  const renderer = createFrameRenderer({
    module: renderModule,
    params,
    width,
    height,
    scale,
    seed,
    // Passed through as-is: undefined means the tool's own background.
    background: request.background,
  })

  try {
    await renderer.draw(request.t ?? 0)
    request.onProgress?.(0.9)
    assertLive(signal)

    const blob = await new Promise<Blob | null>((resolve) =>
      renderer.canvas.toBlob((result) => resolve(result), 'image/png'),
    )
    if (!blob) throw new Error('PNG encoding failed')

    request.onProgress?.(1)
    return {
      blob,
      filename: filenameFor(tool.meta.slug, 'png', width * scale, height * scale, scale),
      size: blob.size,
    }
  } finally {
    renderer.dispose()
  }
}
