'use client'

import { useCallback, useEffect, useRef, type ReactNode } from 'react'

/** A labelled control row. Every control in the rail sits in one of these. */
export function Field({
  label,
  value,
  hint,
  children,
  htmlFor,
}: {
  label: string
  value?: ReactNode
  hint?: string
  children: ReactNode
  htmlFor?: string
}) {
  return (
    <div className="px-4 py-3 rule border-b">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <label htmlFor={htmlFor} className="meta text-[var(--dim)]">
          {label}
        </label>
        {value !== undefined && (
          <span className="font-mono text-[var(--text-xs)] text-[var(--text)] tabular-nums">
            {value}
          </span>
        )}
      </div>
      {children}
      {hint && <p className="meta normal-case tracking-normal mt-2 text-[var(--faint)]">{hint}</p>}
    </div>
  )
}

/** A bare numeric input in the mono register. */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  id,
  ariaLabel,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  id?: string
  ariaLabel?: string
}) {
  return (
    <input
      id={id}
      type="number"
      aria-label={ariaLabel}
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const next = Number(e.target.value)
        if (Number.isFinite(next)) onChange(next)
      }}
      className="w-full bg-[var(--bg)] rule border px-2 py-1 font-mono text-[var(--text-xs)] text-[var(--text)] tabular-nums focus:border-[var(--faint)] outline-none"
    />
  )
}

export function TextInput({
  value,
  onChange,
  placeholder,
  maxLength,
  id,
  mono = false,
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
  id?: string
  mono?: boolean
  ariaLabel?: string
}) {
  return (
    <input
      id={id}
      type="text"
      aria-label={ariaLabel}
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
      className={
        'w-full bg-[var(--bg)] rule border px-2 py-1 text-[var(--text-xs)] text-[var(--text)] placeholder:text-[var(--faint)] focus:border-[var(--faint)] outline-none ' +
        (mono ? 'font-mono' : '')
      }
    />
  )
}

export function Button({
  children,
  onClick,
  title,
  disabled,
  active,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  title?: string
  disabled?: boolean
  active?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={
        'rule border px-2 py-1 meta transition-colors ' +
        (disabled
          ? 'text-[var(--faint)] cursor-not-allowed '
          : 'hover:text-[var(--text)] hover:border-[var(--faint)] ') +
        (active ? 'text-[var(--text)] border-[var(--faint)] ' : '') +
        className
      }
    >
      {children}
    </button>
  )
}

/**
 * Pointer dragging on an element, normalised to 0..1 within its own box.
 * Shared by the sliders, the dial, the 2D pad and the curve editor.
 */
export interface DragBind {
  ref: React.RefObject<HTMLDivElement | null>
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
}

export function useDrag(onMove: (x: number, y: number, event: PointerEvent) => void): DragBind {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const handler = useRef(onMove)

  useEffect(() => {
    handler.current = onMove
  }, [onMove])

  const emit = useCallback((event: PointerEvent | React.PointerEvent) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = rect.width === 0 ? 0 : (event.clientX - rect.left) / rect.width
    const y = rect.height === 0 ? 0 : (event.clientY - rect.top) / rect.height
    handler.current(Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y)), event as PointerEvent)
  }, [])

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (dragging.current) emit(event)
    }
    const up = () => {
      dragging.current = false
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [emit])

  return {
    ref,
    onPointerDown: (event) => {
      dragging.current = true
      emit(event)
    },
  }
}
