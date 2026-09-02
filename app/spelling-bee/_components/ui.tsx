'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { teamColor } from '../_lib/defaults'
import type { Team } from '../_lib/types'

// ---------------------------------------------------------------------------
// Dialog: a focus-trapped modal. Escape closes, focus returns on unmount.
// ---------------------------------------------------------------------------

export function Dialog({
  title,
  children,
  onClose,
  wide = false,
  tone = 'plain',
}: {
  title: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
  tone?: 'plain' | 'danger'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const node = ref.current
    const focusables = () =>
      Array.from(
        node?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      )
    const first = focusables().find((el) => el.dataset.autofocus === 'true') ?? focusables()[0]
    first?.focus()

    const onKey = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === 'Escape') {
        keyEvent.stopPropagation()
        onClose()
        return
      }
      if (keyEvent.key !== 'Tab') return
      const items = focusables()
      if (!items.length) return
      const head = items[0] as HTMLElement
      const tail = items[items.length - 1] as HTMLElement
      if (keyEvent.shiftKey && document.activeElement === head) {
        keyEvent.preventDefault()
        tail.focus()
      } else if (!keyEvent.shiftKey && document.activeElement === tail) {
        keyEvent.preventDefault()
        head.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      previous?.focus()
    }
  }, [onClose])

  return (
    <div className="bee-scrim" onMouseDown={(mouseEvent) => mouseEvent.target === mouseEvent.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`bee-card bee-dialog bee-anim-pop ${wide ? 'bee-dialog-wide' : ''}`}
        style={tone === 'danger' ? { borderColor: 'var(--bee-red)' } : undefined}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 id={titleId} className="bee-display text-3xl md:text-4xl">
            {title}
          </h2>
          <button type="button" className="bee-btn bee-btn-sm bee-btn-ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Confirm({
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
  danger = false,
}: {
  title: string
  body: ReactNode
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
  danger?: boolean
}) {
  return (
    <Dialog title={title} onClose={onClose} tone={danger ? 'danger' : 'plain'}>
      <div className="text-lg text-[var(--bee-cream)] mb-6">{body}</div>
      <div className="flex flex-wrap gap-3 justify-end">
        <button type="button" className="bee-btn bee-btn-ghost" onClick={onClose} data-autofocus="true">
          Cancel
        </button>
        <button
          type="button"
          className={`bee-btn ${danger ? 'bee-btn-red' : 'bee-btn-gold'}`}
          onClick={() => {
            onConfirm()
            onClose()
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Team bits
// ---------------------------------------------------------------------------

export function TeamSwatch({ team, size = 'md' }: { team: Team; size?: 'sm' | 'md' | 'lg' }) {
  const color = teamColor(team.color)
  const px = size === 'sm' ? 14 : size === 'lg' ? 28 : 20
  return (
    <span
      aria-hidden="true"
      className="inline-block flex-none rounded-md border-2 border-[var(--bee-ink)]"
      style={{ width: px, height: px, background: color.bg }}
    />
  )
}

export function TeamChip({ team, className = '' }: { team: Team; className?: string }) {
  const color = teamColor(team.color)
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border-2 border-[var(--bee-ink)] px-3 py-1 bee-display text-lg ${className}`}
      style={{ background: color.bg, color: color.fg }}
    >
      {team.name}
    </span>
  )
}

/** The Double Word token, drawn as a coin. */
export function Token({ available, size = 'md', label = true }: { available: boolean; size?: 'sm' | 'md' | 'lg'; label?: boolean }) {
  const px = size === 'sm' ? 26 : size === 'lg' ? 64 : 36
  return (
    <span className="inline-flex items-center gap-2" title={available ? 'Double Word token available' : 'Double Word token used'}>
      <span
        aria-hidden="true"
        className="inline-grid place-items-center rounded-full border-[3px] bee-display"
        style={{
          width: px,
          height: px,
          fontSize: px * 0.5,
          background: available ? 'var(--bee-gold)' : 'transparent',
          borderColor: available ? 'var(--bee-ink)' : 'var(--bee-dim)',
          color: available ? 'var(--bee-ink)' : 'var(--bee-dim)',
          boxShadow: available ? `0 ${Math.max(2, px / 12)}px 0 var(--bee-ink)` : 'none',
          textDecoration: available ? 'none' : 'line-through',
        }}
      >
        2×
      </span>
      {label && (
        <span className="bee-label" style={{ fontSize: size === 'sm' ? '0.75rem' : undefined }}>
          {available ? 'Token' : 'Used'}
        </span>
      )}
    </span>
  )
}

export function Pill({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'gold' | 'red' | 'green' | 'teal' }) {
  const bg =
    tone === 'gold' ? 'var(--bee-gold)' : tone === 'red' ? 'var(--bee-red)' : tone === 'green' ? 'var(--bee-green)' : tone === 'teal' ? 'var(--bee-teal)' : 'var(--bee-ink)'
  const fg = tone === 'plain' ? 'var(--bee-cream)' : 'var(--bee-ink)'
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 bee-display text-base tracking-wider" style={{ background: bg, color: fg }}>
      {children}
    </span>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="bee-kbd">{children}</kbd>
}

export function Toast({ message, tone = 'plain' }: { message: string; tone?: 'plain' | 'danger' }) {
  return (
    <div
      role="status"
      className="bee-card-flat bee-anim-rise fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] px-5 py-3 text-base font-medium"
      style={tone === 'danger' ? { borderColor: 'var(--bee-red)' } : undefined}
    >
      {message}
    </div>
  )
}
