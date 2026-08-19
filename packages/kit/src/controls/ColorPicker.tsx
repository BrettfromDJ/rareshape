'use client'

import { useEffect, useRef, useState } from 'react'
import { clamp, hsvToRgb, parseColor, rgbToHsv, toHex } from '@rareshape/core'
import { TextInput, useDrag } from '../primitives'

/**
 * The colour picker: a saturation/value field you drag through, a hue strip and
 * an optional alpha strip. It replaces the browser's native colour dialog,
 * which opens an OS window over the artwork and hides the thing being coloured.
 *
 * It expands inside the rail rather than floating, because the rail scrolls and
 * a floating panel would be clipped by it.
 */
export function ColorPicker({
  value,
  onChange,
  alpha = false,
  onClose,
  label,
}: {
  value: string
  onChange: (value: string) => void
  alpha?: boolean
  onClose?: () => void
  label: string
}) {
  const hsv = rgbToHsv(parseColor(value))
  // Black and white have no hue, so dragging into a corner would otherwise
  // reset the hue strip to red. The last chromatic hue is remembered instead.
  const [heldHue, setHeldHue] = useState(hsv.h)
  const chromatic = hsv.v > 0.001 && hsv.s > 0.001
  const hue = chromatic ? hsv.h : heldHue

  const emit = (next: { h?: number; s?: number; v?: number; a?: number }) => {
    if (next.h !== undefined) setHeldHue(next.h)
    onChange(
      toHex(
        hsvToRgb({
          h: next.h ?? hue,
          s: next.s ?? hsv.s,
          v: next.v ?? hsv.v,
          a: next.a ?? hsv.a,
        }),
        alpha,
      ),
    )
  }

  const { ref: fieldRef, onPointerDown: onFieldDown } = useDrag((x, y) =>
    emit({ s: x, v: 1 - y }),
  )
  const { ref: hueRef, onPointerDown: onHueDown } = useDrag((x) => emit({ h: x * 360 }))
  const { ref: alphaRef, onPointerDown: onAlphaDown } = useDrag((x) => emit({ a: x }))

  const nudge = (dx: number, dy: number) =>
    emit({ s: clamp(hsv.s + dx, 0, 1), v: clamp(hsv.v + dy, 0, 1) })

  return (
    <div className="mt-2 rule border bg-[var(--bg)] p-2 space-y-2">
      <div
        ref={fieldRef}
        onPointerDown={onFieldDown}
        role="application"
        tabIndex={0}
        aria-label={`${label} saturation and brightness`}
        onKeyDown={(event) => {
          const s = event.shiftKey ? 0.1 : 0.02
          if (event.key === 'ArrowLeft') nudge(-s, 0)
          else if (event.key === 'ArrowRight') nudge(s, 0)
          else if (event.key === 'ArrowUp') nudge(0, s)
          else if (event.key === 'ArrowDown') nudge(0, -s)
          else if (event.key === 'Escape') onClose?.()
          else return
          event.preventDefault()
        }}
        className="relative w-full h-28 touch-none cursor-crosshair"
        style={{ background: `hsl(${hue} 100% 50%)` }}
      >
        <span
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to right, #fff, transparent)' }}
        />
        <span
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, #000, transparent)' }}
        />
        <span
          className="absolute w-3 h-3 -ml-1.5 -mt-1.5 border border-white outline outline-1 outline-black/60 pointer-events-none"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
        />
      </div>

      <div
        ref={hueRef}
        onPointerDown={onHueDown}
        role="slider"
        tabIndex={0}
        aria-label={`${label} hue`}
        aria-valuenow={Math.round(hue)}
        aria-valuemin={0}
        aria-valuemax={360}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 10 : 2
          if (event.key === 'ArrowLeft') emit({ h: hue - step })
          else if (event.key === 'ArrowRight') emit({ h: hue + step })
          else return
          event.preventDefault()
        }}
        className="relative h-3 touch-none cursor-ew-resize"
        style={{
          background:
            'linear-gradient(to right, #f00, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00)',
        }}
      >
        <span
          className="absolute top-0 bottom-0 w-1 -ml-0.5 bg-white outline outline-1 outline-black/60 pointer-events-none"
          style={{ left: `${(hue / 360) * 100}%` }}
        />
      </div>

      {alpha && (
        <div
          ref={alphaRef}
          onPointerDown={onAlphaDown}
          role="slider"
          tabIndex={0}
          aria-label={`${label} opacity`}
          aria-valuenow={Math.round(hsv.a * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          onKeyDown={(event) => {
            const step = event.shiftKey ? 0.1 : 0.02
            if (event.key === 'ArrowLeft') emit({ a: clamp(hsv.a - step, 0, 1) })
            else if (event.key === 'ArrowRight') emit({ a: clamp(hsv.a + step, 0, 1) })
            else return
            event.preventDefault()
          }}
          className="relative h-3 touch-none cursor-ew-resize rs-checker"
        >
          <span
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to right, transparent, ${toHex({ ...parseColor(value), a: 1 }, false)})`,
            }}
          />
          <span
            className="absolute top-0 bottom-0 w-1 -ml-0.5 bg-white outline outline-1 outline-black/60 pointer-events-none"
            style={{ left: `${hsv.a * 100}%` }}
          />
        </div>
      )}

      <TextInput
        value={value}
        mono
        ariaLabel={`${label} hex`}
        onChange={(next) => onChange(next.startsWith('#') ? next : `#${next}`)}
      />
    </div>
  )
}

/** A swatch that opens the picker below it. */
export function Swatch({
  value,
  open,
  onToggle,
  label,
  size = 'md',
}: {
  value: string
  open: boolean
  onToggle: () => void
  label: string
  size?: 'md' | 'sm'
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={label}
      className={
        'relative shrink-0 rule border rs-checker transition-colors ' +
        (size === 'sm' ? 'w-6 h-6 ' : 'w-6 h-6 ') +
        (open ? 'border-[var(--text)]' : 'hover:border-[var(--faint)]')
      }
    >
      <span className="absolute inset-0" style={{ background: value }} />
    </button>
  )
}

/** Closes the picker on Escape, wherever focus happens to be. */
export function useEscape(active: boolean, onEscape: () => void): void {
  const handler = useRef(onEscape)
  useEffect(() => {
    handler.current = onEscape
  }, [onEscape])

  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handler.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active])
}

export function useOpenState(): [boolean, () => void, () => void] {
  const [open, setOpen] = useState(false)
  return [open, () => setOpen((value) => !value), () => setOpen(false)]
}
