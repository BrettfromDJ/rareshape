'use client'

import { useEffect, useState } from 'react'
import type { ParamSchema, ParamsOf, RenderModule, Tool } from '@rareshape/schema'
import { createFrameRenderer, isMp4Supported, runExport, type ExportFormat } from '@rareshape/export'
import { allTools } from '@/lib/registry'
import { loaders } from '@/registry.generated'

export interface LabExportRequest {
  slug: string
  format: ExportFormat
  width: number
  height: number
  scale?: number
  duration?: number
  fps?: number
  t?: number
  background?: string | null
  params?: Record<string, unknown>
  /** Lets CI's Chromium fall back to an open codec — see mp4.ts. */
  allowFallbackCodec?: boolean
  /** Import map override for HTML export. */
  htmlImports?: Record<string, string>
  bitrate?: number
}

export interface LabApi {
  tools: { slug: string; name: string; engine: string; animated: boolean; aspect: string }[]
  /** Runs the real export pipeline and returns the file as base64. */
  export(request: LabExportRequest): Promise<{ filename: string; size: number; base64: string }>
  /** Whether this browser can actually encode the locked H.264 profile. */
  mp4Supported(): Promise<boolean>
  /** Cover-crops a PNG (base64) to a box. Used for OG images and thumbnails. */
  crop(request: {
    base64: string
    width: number
    height: number
    type?: 'image/png' | 'image/jpeg'
    quality?: number
  }): Promise<string>
  /** Mean absolute pixel difference between two frames, 0..255. */
  diffFrames(request: {
    slug: string
    a: number
    b: number
    width: number
    height: number
  }): Promise<number>
  /** Renders one frame and returns a hash of the raw pixels. */
  hashFrame(request: {
    slug: string
    t: number
    width: number
    height: number
    seed?: number
    params?: Record<string, unknown>
  }): Promise<string>
}

declare global {
  interface Window {
    rareshapeLab?: LabApi
  }
}

async function load(slug: string): Promise<{ tool: Tool; module: RenderModule }> {
  const loader = loaders[slug]
  if (!loader) throw new Error(`Unknown tool "${slug}"`)
  const [toolModule, renderModule] = await Promise.all([loader.tool(), loader.render()])
  const tool = (toolModule as { tool?: Tool }).tool
  if (!tool) throw new Error(`tools/${slug}/tool.ts must export \`tool\``)
  return { tool, module: renderModule as RenderModule }
}

/** Defaults with an override patch on top, in the shape the pipeline expects. */
const mergeParams = (tool: Tool, patch: Record<string, unknown> = {}): ParamsOf<ParamSchema> =>
  ({ ...tool.defaults, ...patch }) as ParamsOf<ParamSchema>

const seedOf = (tool: Tool, params: Record<string, unknown>): number => {
  const entry = Object.entries(tool.params).find(([, def]) => def.type === 'seed')
  const value = entry ? params[entry[0]] : undefined
  return typeof value === 'number' ? value : 1
}

async function toBase64(blob: Blob): Promise<string> {
  const buffer = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < buffer.length; i += chunk) {
    binary += String.fromCharCode(...buffer.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/** FNV-1a over the pixel buffer. Cheap, and enough to catch a stray random. */
function hashBytes(bytes: Uint8ClampedArray): string {
  let h = 2166136261
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i] as number
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

export function Lab() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const api: LabApi = {
      tools: allTools.map((tool) => ({
        slug: tool.slug,
        name: tool.name,
        engine: tool.engine,
        animated: tool.animated,
        aspect: tool.aspect,
      })),

      async export(request) {
        const { tool, module } = await load(request.slug)
        const params = mergeParams(tool, request.params)
        const result = await runExport({
          tool,
          module,
          params,
          format: request.format,
          width: request.width,
          height: request.height,
          scale: request.scale ?? 1,
          duration: request.duration ?? tool.meta.duration,
          fps: request.fps ?? tool.meta.fps,
          t: request.t ?? 0,
          background: request.background,
          seed: seedOf(tool, params),
          allowFallbackCodec: request.allowFallbackCodec === true,
          htmlImports: request.htmlImports,
          ...(request.bitrate ? { bitrate: request.bitrate } : {}),
        })
        return {
          filename: result.filename,
          size: result.size,
          base64: await toBase64(result.blob),
        }
      },

      mp4Supported: () => isMp4Supported(),

      async crop(request) {
        const image = new Image()
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve()
          image.onerror = () => reject(new Error('Could not read the poster'))
          image.src = `data:image/png;base64,${request.base64}`
        })
        const canvas = document.createElement('canvas')
        canvas.width = request.width
        canvas.height = request.height
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('No 2D context')
        const scale = Math.max(request.width / image.width, request.height / image.height)
        const w = image.width * scale
        const h = image.height * scale
        ctx.drawImage(image, (request.width - w) / 2, (request.height - h) / 2, w, h)
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((result) => resolve(result), request.type ?? 'image/png', request.quality),
        )
        if (!blob) throw new Error('Image encoding failed')
        return toBase64(blob)
      },

      async diffFrames(request) {
        const { tool, module } = await load(request.slug)
        const params = mergeParams(tool)
        const renderer = createFrameRenderer({
          module,
          params,
          width: request.width,
          height: request.height,
          scale: 1,
          seed: seedOf(tool, params),
          background: '#0a0a0a',
        })
        try {
          const ctx = renderer.canvas.getContext('2d', { willReadFrequently: true })
          if (!ctx) throw new Error('No 2D context')
          const w = renderer.canvas.width
          const h = renderer.canvas.height
          await renderer.draw(request.a)
          const first = ctx.getImageData(0, 0, w, h).data
          await renderer.draw(request.b)
          const second = ctx.getImageData(0, 0, w, h).data
          let sum = 0
          for (let i = 0; i < first.length; i++) {
            sum += Math.abs((first[i] as number) - (second[i] as number))
          }
          return sum / first.length
        } finally {
          renderer.dispose()
        }
      },

      async hashFrame(request) {
        const { tool, module } = await load(request.slug)
        const params = mergeParams(tool, request.params)
        const renderer = createFrameRenderer({
          module,
          params,
          width: request.width,
          height: request.height,
          scale: 1,
          seed: request.seed ?? seedOf(tool, params),
          background: '#0a0a0a',
        })
        try {
          await renderer.draw(request.t)
          const ctx = renderer.canvas.getContext('2d', { willReadFrequently: true })
          if (!ctx) throw new Error('No 2D context')
          const { data } = ctx.getImageData(0, 0, renderer.canvas.width, renderer.canvas.height)
          return hashBytes(data)
        } finally {
          renderer.dispose()
        }
      },
    }

    window.rareshapeLab = api
    // Readiness is only a visual cue; drivers wait on window.rareshapeLab.
    const id = window.setTimeout(() => setReady(true), 0)
    return () => {
      window.clearTimeout(id)
      delete window.rareshapeLab
    }
  }, [])

  return (
    <div className="px-[var(--gutter)] py-10">
      <h1 className="meta text-[var(--text)]" data-lab-ready={ready ? 'yes' : 'no'}>
        Lab {ready ? 'ready' : 'loading'}
      </h1>
      <p className="meta mt-2">
        Headless driver for previews and the determinism test. Nothing to see here.
      </p>
    </div>
  )
}
