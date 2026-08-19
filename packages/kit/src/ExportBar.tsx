'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { parseAspect } from '@rareshape/core'
import type { ParamSchema, ParamsOf, RenderModule, Tool } from '@rareshape/schema'
import {
  availableFormats,
  download,
  formatBytes,
  runExport,
  type ExportFormat,
  type ExportResult,
} from '@rareshape/export'
import { useMp4Support } from './mp4-support'
import { Button } from './primitives'

const SCALES = [1, 2, 4] as const
const ASPECTS = ['1:1', '4:3', '3:2', '16:9', '9:16', '4:5'] as const

/**
 * The export sheet: format, size, aspect, duration, fps, progress, cancel.
 * It never captures the stage — every format re-renders offscreen, which is
 * what makes two runs of the same export produce identical files.
 */
export function ExportBar<S extends ParamSchema>({
  tool,
  module: renderModule,
  params,
  t,
  seed,
  aspect: stageAspect,
  open,
  onOpenChange,
}: {
  tool: Tool<S>
  module: RenderModule<ParamsOf<S>> | null
  params: ParamsOf<S>
  t: number
  seed: number
  /** What the stage is currently showing; the export follows it by default. */
  aspect: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  // Presence of VideoEncoder is not enough: some Chromium builds ship
  // WebCodecs with no H.264 encoder. MP4 appears only once the probe says yes.
  const mp4Ok = useMp4Support()

  const formats = useMemo(
    () => availableFormats(tool as unknown as Tool, mp4Ok),
    [tool, mp4Ok],
  )
  const [requestedFormat, setFormat] = useState<ExportFormat>('png')
  const [scale, setScale] = useState<number>(2)
  // Exporting a different shape from the one on screen is possible but never
  // the default: what you see is what comes out unless you say otherwise.
  const [aspectOverride, setAspect] = useState<string | null>(null)
  const [base, setBase] = useState(1200)
  const [duration, setDuration] = useState(tool.meta.duration)
  const [fps, setFps] = useState(tool.meta.fps)
  const [transparent, setTransparent] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [last, setLast] = useState<ExportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)

  // Derived, not stored: the format list changes when the MP4 probe lands, and
  // a selection that is no longer offered should fall back on the spot.
  const format = formats.some((entry) => entry.format === requestedFormat)
    ? requestedFormat
    : (formats[0]?.format ?? 'png')
  const option = formats.find((entry) => entry.format === format) ?? formats[0]
  const aspect = aspectOverride ?? stageAspect
  const ratio = parseAspect(aspect)
  const width = Math.round(ratio >= 1 ? base : base * ratio)
  const height = Math.round(ratio >= 1 ? base / ratio : base)

  const start = useCallback(async () => {
    if (!renderModule) return
    const controller = new AbortController()
    abort.current = controller
    setProgress(0)
    setError(null)
    setLast(null)
    try {
      const result = await runExport({
        tool: tool as unknown as Tool,
        module: renderModule as RenderModule,
        params: params as ParamsOf<ParamSchema>,
        format,
        width,
        height,
        scale: format === 'svg' || format === 'svg-animated' || format === 'html' ? 1 : scale,
        duration,
        fps,
        t,
        seed,
        background: transparent ? null : undefined,
        htmlSource: typeof window === 'undefined' ? undefined : window.location.href,
        htmlAspect: aspect,
        signal: controller.signal,
        onProgress: setProgress,
      })
      download(result)
      setLast(result)
    } catch (cause) {
      if ((cause as Error)?.name !== 'ExportCancelled') {
        setError(cause instanceof Error ? cause.message : String(cause))
      }
    } finally {
      setProgress(null)
      abort.current = null
    }
  }, [
    renderModule,
    tool,
    params,
    format,
    width,
    height,
    scale,
    duration,
    fps,
    t,
    seed,
    transparent,
    aspect,
  ])

  const running = progress !== null

  return (
    <>
      <Button onClick={() => onOpenChange(!open)} active={open} title="Export (E)">
        Export
      </Button>

      {open && (
        <div className="absolute bottom-11 right-0 w-[min(28rem,100vw)] bg-[var(--surface)] rule border z-30">
          <div className="rule border-b px-4 py-2 flex items-center justify-between">
            <span className="meta text-[var(--text)]">Export</span>
            <button type="button" onClick={() => onOpenChange(false)} className="meta hover:text-[var(--text)]">
              Close
            </button>
          </div>

          <Row label="Format">
            <div className="flex flex-wrap gap-1">
              {formats.map((entry) => (
                <Button
                  key={entry.format}
                  active={entry.format === format}
                  onClick={() => setFormat(entry.format)}
                >
                  {entry.label}
                </Button>
              ))}
            </div>
          </Row>

          {format !== 'html' && (
            <>
              <Row label="Aspect">
                <div className="flex flex-wrap gap-1">
                  {[...new Set([stageAspect, ...ASPECTS])].map((entry) => (
                    <Button
                      key={entry}
                      active={parseAspect(entry) === ratio}
                      onClick={() => setAspect(entry)}
                    >
                      {entry}
                    </Button>
                  ))}
                </div>
              </Row>

              <Row label="Size" value={`${width * (format.startsWith('svg') ? 1 : scale)} × ${height * (format.startsWith('svg') ? 1 : scale)}`}>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    aria-label="Base size"
                    className="rs-range flex-1"
                    min={400}
                    max={2400}
                    step={100}
                    value={base}
                    onChange={(event) => setBase(Number(event.target.value))}
                  />
                  {!format.startsWith('svg') && (
                    <div className="flex gap-1">
                      {SCALES.map((entry) => (
                        <Button key={entry} active={entry === scale} onClick={() => setScale(entry)}>
                          {entry}×
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </Row>
            </>
          )}

          {option?.animated && (
            <Row label="Loop" value={`${duration}s · ${fps}fps`}>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  aria-label="Duration in seconds"
                  className="rs-range flex-1"
                  min={1}
                  max={20}
                  step={0.5}
                  value={duration}
                  onChange={(event) => setDuration(Number(event.target.value))}
                />
                <div className="flex gap-1">
                  {[12, 24, 30, 60].map((entry) => (
                    <Button key={entry} active={entry === fps} onClick={() => setFps(entry)}>
                      {entry}
                    </Button>
                  ))}
                </div>
              </div>
            </Row>
          )}

          {(format === 'png' || format === 'svg') && (
            <Row label="Background">
              <Button active={transparent} onClick={() => setTransparent((value) => !value)}>
                {transparent ? 'Transparent' : 'Opaque'}
              </Button>
            </Row>
          )}

          <div className="px-4 py-3 flex items-center gap-3">
            {running ? (
              <>
                <div className="flex-1 h-px bg-[var(--line)] relative">
                  <div
                    className="absolute left-0 top-0 h-px bg-[var(--text)]"
                    style={{ width: `${Math.round((progress ?? 0) * 100)}%` }}
                  />
                </div>
                <span className="meta tabular-nums">{Math.round((progress ?? 0) * 100)}%</span>
                <Button onClick={() => abort.current?.abort()}>Cancel</Button>
              </>
            ) : (
              <>
                <Button onClick={() => void start()} className="text-[var(--text)]">
                  Export {option?.label}
                </Button>
                {last && (
                  <span className="meta">
                    {last.filename} · {formatBytes(last.size)}
                  </span>
                )}
                {error && <span className="meta text-[var(--text)]">{error}</span>}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function Row({
  label,
  value,
  children,
}: {
  label: string
  value?: string
  children: React.ReactNode
}) {
  return (
    <div className="px-4 py-3 rule border-b">
      <div className="flex items-baseline justify-between mb-2">
        <span className="meta">{label}</span>
        {value && <span className="font-mono text-[var(--text-xs)] tabular-nums">{value}</span>}
      </div>
      {children}
    </div>
  )
}
