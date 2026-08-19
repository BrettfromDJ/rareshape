'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { clamp, parseAspect } from '@rareshape/core'
import type { RenderModule } from '@rareshape/schema'
import { Surface } from './Surface'

export interface StageView {
  zoom: number
  x: number
  y: number
}

const IDENTITY: StageView = { zoom: 1, x: 0, y: 0 }

/**
 * The stage: fits the tool's aspect into the available space, tracks DPR,
 * handles pan and zoom, and shows a checkerboard behind transparent output.
 * It owns no tool state — it is handed params and a frame position.
 */
export function Stage<P>({
  module: renderModule,
  params,
  t,
  seed,
  aspect,
  checker = true,
  onSize,
}: {
  module: RenderModule<P> | null
  params: P
  t: number
  seed: number
  aspect: string
  checker?: boolean
  onSize?: (size: { width: number; height: number }) => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ width: 0, height: 0 })
  const [view, setView] = useState<StageView>(IDENTITY)
  const [dpr, setDpr] = useState(1)
  const panning = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const { width, height } = entry.contentRect
      setBox({ width, height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const update = () => setDpr(window.devicePixelRatio || 1)
    update()
    const media = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  // Fit the aspect box inside the container, with a margin.
  const ratio = parseAspect(aspect)
  const available = { width: Math.max(0, box.width - 32), height: Math.max(0, box.height - 32) }
  const frame =
    available.width / (available.height || 1) > ratio
      ? { width: (available.height || 0) * ratio, height: available.height }
      : { width: available.width, height: available.width / ratio }

  const width = Math.max(1, Math.round(frame.width))
  const height = Math.max(1, Math.round(frame.height))

  useEffect(() => {
    onSize?.({ width, height })
  }, [width, height, onSize])

  const onWheel = useCallback((event: React.WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey && Math.abs(event.deltaY) < 2) return
    event.preventDefault()
    setView((current) => ({
      ...current,
      zoom: clamp(current.zoom * Math.exp(-event.deltaY / 400), 0.25, 8),
    }))
  }, [])

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0 && event.button !== 1) return
    panning.current = { x: event.clientX - view.x, y: event.clientY - view.y }
    ;(event.target as Element).setPointerCapture?.(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent) => {
    const start = panning.current
    if (!start) return
    setView((current) => ({ ...current, x: event.clientX - start.x, y: event.clientY - start.y }))
  }

  const endPan = () => {
    panning.current = null
  }

  const zoomed = view.zoom !== 1 || view.x !== 0 || view.y !== 0

  return (
    <div
      ref={boxRef}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerLeave={endPan}
      className="relative flex-1 min-h-0 overflow-hidden grid place-items-center touch-none"
    >
      <div
        style={{
          width,
          height,
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
          transformOrigin: 'center',
        }}
        className={'relative rule border ' + (checker ? 'rs-checker' : '')}
      >
        <Surface
          module={renderModule}
          params={params}
          t={t}
          seed={seed}
          width={width}
          height={height}
          dpr={Math.min(4, dpr * Math.max(1, view.zoom))}
        />
      </div>

      <div className="absolute left-3 bottom-3 flex items-center gap-3 pointer-events-none">
        <span className="meta tabular-nums">
          {width}×{height}
        </span>
        {zoomed && <span className="meta tabular-nums">{Math.round(view.zoom * 100)}%</span>}
      </div>

      {zoomed && (
        <button
          type="button"
          onClick={() => setView(IDENTITY)}
          className="absolute right-3 bottom-3 rule border px-2 py-1 meta bg-[var(--bg)] hover:text-[var(--text)]"
        >
          Reset view
        </button>
      )}
    </div>
  )
}
