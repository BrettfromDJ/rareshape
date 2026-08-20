import { applyPalette, GIFEncoder, quantize } from 'gifenc'
import { assertLive, filenameFor, type ExportRequest, type ExportResult } from './types'
import { createFrameRenderer } from './render-frame'

/**
 * GIF, the universal fallback: it works in every browser, including the ones
 * with no WebCodecs. Frames are stepped deterministically, exactly as MP4 does.
 */
export async function exportGif(request: ExportRequest): Promise<ExportResult> {
  const { tool, module: renderModule, params, width, height, scale, seed, signal } = request

  const duration = request.duration ?? tool.meta.duration
  // GIF delays are centiseconds, so anything above 50fps is a lie.
  const fps = Math.min(request.fps ?? tool.meta.fps, 50)
  const frameCount = tool.meta.animated ? Math.max(1, Math.round(duration * fps)) : 1
  const delay = Math.max(2, Math.round(100 / fps)) * 10

  const renderer = createFrameRenderer({
    module: renderModule,
    params,
    width,
    height,
    scale,
    seed,
    // GIF alpha is one bit; a flat ground beats a hard fringe. The tool's own
    // background is used when there is one, and only a request for real
    // transparency falls back to the flat ground.
    background: request.background === null ? '#0a0a0a' : request.background,
  })

  const ctx = renderer.canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('No 2D context available')

  const encoder = GIFEncoder()
  const pixelWidth = renderer.canvas.width
  const pixelHeight = renderer.canvas.height

  try {
    for (let i = 0; i < frameCount; i++) {
      assertLive(signal)
      await renderer.draw(tool.meta.animated ? i / frameCount : (request.t ?? 0))
      const { data } = ctx.getImageData(0, 0, pixelWidth, pixelHeight)
      const palette = quantize(data, 256, { format: 'rgb444' })
      const index = applyPalette(data, palette, 'rgb444')
      encoder.writeFrame(index, pixelWidth, pixelHeight, {
        palette,
        delay,
        repeat: 0,
        first: i === 0,
      })
      request.onProgress?.((i + 1) / frameCount)
      // Yield so the progress bar in the sheet actually moves.
      if (i % 4 === 3) await new Promise((resolve) => setTimeout(resolve, 0))
    }

    encoder.finish()
    const bytes = encoder.bytes()
    const blob = new Blob([bytes as unknown as BlobPart], { type: 'image/gif' })
    return {
      blob,
      filename: filenameFor(tool.meta.slug, 'gif', pixelWidth, pixelHeight, scale),
      size: blob.size,
    }
  } finally {
    renderer.dispose()
  }
}
