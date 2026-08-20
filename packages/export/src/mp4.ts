import { ArrayBufferTarget, Muxer } from 'mp4-muxer'
import { assertLive, filenameFor, type ExportRequest, type ExportResult } from './types'
import { createFrameRenderer } from './render-frame'

/**
 * MP4 through WebCodecs. Frames are stepped as `t = i / frameCount` and handed
 * to the encoder one at a time — never MediaRecorder, never realtime capture,
 * so a slow machine produces the same file as a fast one and the loop point is
 * seamless by construction.
 *
 * Absent rather than broken where WebCodecs is missing: see `canExportMp4`.
 */
export function canExportMp4(): boolean {
  return typeof window !== 'undefined' && typeof window.VideoEncoder === 'function'
}

/** H.264 High profile, level 4.2 — the locked codec string. */
const CODEC = 'avc1.4D402A'

/**
 * Some Chromium builds ship WebCodecs without an H.264 encoder, so the
 * constructor being present is not enough. This is the check the export sheet
 * runs at mount: if it comes back false, MP4 is not offered at all.
 */
export async function isMp4Supported(width = 1280, height = 720): Promise<boolean> {
  if (!canExportMp4()) return false
  try {
    await pickConfig(even(width), even(height), 30, false)
    return true
  } catch {
    return false
  }
}

/**
 * Build-time only. The preview generator runs in whatever Chromium CI has, and
 * open-source builds carry no H.264 encoder; it may therefore ask for an open
 * codec in the same MP4 container. The export sheet never does this — for users
 * MP4 means H.264, and GIF is the fallback.
 */
const FALLBACK_CODECS: Array<{ codec: string; muxer: 'avc' | 'vp9' | 'av1' }> = [
  { codec: CODEC, muxer: 'avc' },
  { codec: 'vp09.00.10.08', muxer: 'vp9' },
  { codec: 'av01.0.04M.08', muxer: 'av1' },
]

/**
 * Picks a codec and returns the exact config that was verified, hardware hint
 * included — probing a config you are not going to use is how you end up with
 * `isConfigSupported` saying yes and `configure` throwing.
 */
async function pickConfig(
  width: number,
  height: number,
  fps: number,
  allowFallback: boolean,
  requestedBitrate?: number,
): Promise<{ config: VideoEncoderConfig; muxer: 'avc' | 'vp9' | 'av1' }> {
  const candidates = allowFallback ? FALLBACK_CODECS : FALLBACK_CODECS.slice(0, 1)
  const bitrate = requestedBitrate ?? bitrateFor(width, height, fps)

  for (const candidate of candidates) {
    for (const hardware of ['prefer-hardware', undefined] as const) {
      const config: VideoEncoderConfig = {
        codec: candidate.codec,
        width,
        height,
        framerate: fps,
        bitrate,
        latencyMode: 'quality',
        ...(hardware ? { hardwareAcceleration: hardware } : {}),
      }
      try {
        const support = await VideoEncoder.isConfigSupported(config)
        if (support.supported) return { config, muxer: candidate.muxer }
      } catch {
        /* try the next combination */
      }
    }
  }

  throw new Error('This browser cannot encode H.264 video')
}

export async function exportMp4(request: ExportRequest): Promise<ExportResult> {
  if (!canExportMp4()) throw new Error('This browser has no WebCodecs video encoder')

  const { tool, module: renderModule, params, width, height, scale, seed, signal } = request
  const duration = request.duration ?? tool.meta.duration
  const fps = request.fps ?? tool.meta.fps
  const frameCount = Math.max(1, Math.round(duration * fps))

  // H.264 wants even dimensions.
  const pixelWidth = even(width * scale)
  const pixelHeight = even(height * scale)

  const renderer = createFrameRenderer({
    module: renderModule,
    params,
    width: pixelWidth / scale,
    height: pixelHeight / scale,
    scale,
    seed,
    // Video has no alpha channel; painting the ground avoids black fringing.
    background: request.background === null ? '#0a0a0a' : request.background,
  })

  const chosen = await pickConfig(
    pixelWidth,
    pixelHeight,
    fps,
    request.allowFallbackCodec === true,
    request.bitrate,
  )

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: chosen.muxer, width: pixelWidth, height: pixelHeight, frameRate: fps },
    fastStart: 'in-memory',
  })

  let encoderError: unknown = null
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (cause) => {
      encoderError = cause
    },
  })

  encoder.configure(chosen.config)

  const microsecondsPerFrame = 1_000_000 / fps
  const keyframeInterval = Math.max(1, Math.round(fps * 2)) // every 2s

  try {
    for (let i = 0; i < frameCount; i++) {
      assertLive(signal)
      if (encoderError) throw encoderError

      await renderer.draw(i / frameCount)

      const frame = new VideoFrame(renderer.canvas, {
        timestamp: Math.round(i * microsecondsPerFrame),
        duration: Math.round(microsecondsPerFrame),
      })
      encoder.encode(frame, { keyFrame: i % keyframeInterval === 0 })
      frame.close()

      // Keep the encoder queue short so memory stays flat on long exports.
      if (encoder.encodeQueueSize > 8) {
        await new Promise<void>((resolve) => {
          encoder.addEventListener('dequeue', () => resolve(), { once: true })
        })
      }
      request.onProgress?.((i + 1) / frameCount)
    }

    // Flush before muxing, or the tail of the video is simply missing.
    await encoder.flush()
    if (encoderError) throw encoderError
    muxer.finalize()

    const { buffer } = muxer.target
    const blob = new Blob([buffer], { type: 'video/mp4' })
    return {
      blob,
      filename: filenameFor(tool.meta.slug, 'mp4', pixelWidth, pixelHeight, scale),
      size: blob.size,
    }
  } finally {
    if (encoder.state !== 'closed') encoder.close()
    renderer.dispose()
  }
}

const even = (v: number) => Math.max(2, Math.round(v / 2) * 2)

/** Enough for flat vector output at this size without bloating the file. */
function bitrateFor(width: number, height: number, fps: number): number {
  const pixels = width * height
  return Math.round(Math.min(40_000_000, Math.max(2_000_000, pixels * fps * 0.12)))
}
