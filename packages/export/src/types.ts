import type { Frame } from '@rareshape/core'
import type { RenderModule, Tool, ParamSchema, ParamsOf } from '@rareshape/schema'

export type ExportFormat = 'png' | 'svg' | 'svg-animated' | 'gif' | 'mp4' | 'html'

export interface ExportRequest<S extends ParamSchema = ParamSchema> {
  tool: Tool<S>
  module: RenderModule<ParamsOf<S>>
  params: ParamsOf<S>
  format: ExportFormat
  /** Logical size before `scale`. */
  width: number
  height: number
  /** 1, 2 or 4. */
  scale: number
  /** Seconds. Falls back to the tool's own loop length. */
  duration?: number
  fps?: number
  /** Static formats sample here. Animated formats step from 0. */
  t?: number
  /** Paint this behind the frame. Omit for true transparency. */
  background?: string | null
  seed: number
  /** Overrides the computed bitrate. Used by the preview builder's budget. */
  bitrate?: number
  /** Build tooling only — see the note in mp4.ts. */
  allowFallbackCodec?: boolean
  /** Where the HTML exporter fetches the prebuilt standalone bundle from. */
  htmlBase?: string
  /** Link written into an exported HTML file's header. */
  htmlSource?: string
  /** Import map override for the exported HTML — used to self-host Three.js. */
  htmlImports?: Record<string, string>
  signal?: AbortSignal
  onProgress?: (fraction: number) => void
}

export interface ExportResult {
  blob: Blob
  filename: string
  /** Bytes, for the size readout in the sheet. */
  size: number
}

export type FrameFor<S extends ParamSchema> = Frame<ParamsOf<S>>

export class ExportCancelled extends Error {
  constructor() {
    super('Export cancelled')
    this.name = 'ExportCancelled'
  }
}

export function assertLive(signal?: AbortSignal): void {
  if (signal?.aborted) throw new ExportCancelled()
}

/** `grid-1600x1200@2x.png` — descriptive without being chatty. */
export function filenameFor(
  slug: string,
  extension: string,
  width: number,
  height: number,
  scale: number,
): string {
  const clean = slug.replace(/^_+/, '')
  const suffix = scale === 1 ? '' : `@${scale}x`
  return `${clean}-${Math.round(width)}x${Math.round(height)}${suffix}.${extension}`
}
