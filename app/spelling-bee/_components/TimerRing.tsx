'use client'

import { formatClock } from '../_lib/format'
import { useTimerRemaining } from '../_lib/hooks'
import type { TimerState } from '../_lib/types'

/** The countdown, as a ring. Colour changes come with a label so nobody relies on hue. */
export function TimerRing({ timer, size = 180, enabled = true }: { timer: TimerState; size?: number; enabled?: boolean }) {
  const remaining = useTimerRemaining(timer)
  const fraction = timer.durationMs > 0 ? remaining / timer.durationMs : 0
  const radius = 45
  const circumference = 2 * Math.PI * radius
  const seconds = Math.ceil(remaining / 1000)
  const tone = !enabled ? 'idle' : seconds <= 5 ? 'danger' : seconds <= 10 ? 'warn' : 'ok'
  const label = !enabled ? 'No clock' : timer.expired || remaining === 0 ? "Time's up" : timer.running ? 'Counting' : 'Paused'

  return (
    <div
      className={`relative inline-grid place-items-center ${tone === 'danger' && timer.running ? 'bee-anim-pulse' : ''}`}
      style={{ width: size, height: size }}
      role="timer"
      aria-live={timer.running ? 'off' : 'polite'}
      aria-label={enabled ? `${seconds} seconds ${label.toLowerCase()}` : 'Timer off'}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} className="bee-ring" aria-hidden="true">
        <circle className="bee-ring-track" cx="50" cy="50" r={radius} />
        <circle
          className="bee-ring-fill"
          data-tone={tone === 'ok' ? undefined : tone}
          cx="50"
          cy="50"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={enabled ? circumference * (1 - fraction) : circumference}
          style={tone === 'idle' ? { stroke: 'var(--bee-faint)' } : undefined}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="bee-score" style={{ fontSize: size * 0.36, color: tone === 'danger' ? 'var(--bee-red-soft)' : 'var(--bee-cream)' }}>
            {enabled ? formatClock(remaining) : '—'}
          </div>
          <div className="bee-label" style={{ fontSize: Math.max(11, size * 0.075) }}>
            {label}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * The countdown as a fill behind whatever it wraps: the surface starts in
 * the team's colour and pales from the right as time drains, with the
 * seconds counting down at the end. Read from across a room.
 */
export function TimerFill({
  timer,
  enabled = true,
  bg,
  fg,
  size = 'md',
  className = '',
  style,
  children,
}: {
  timer: TimerState
  enabled?: boolean
  bg: string
  fg: string
  size?: 'md' | 'lg'
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  const remaining = useTimerRemaining(timer)
  const fraction = enabled && timer.durationMs > 0 ? remaining / timer.durationMs : 1
  const seconds = Math.ceil(remaining / 1000)
  const danger = enabled && timer.running && seconds <= 5
  const label = !enabled ? '' : timer.expired || remaining === 0 ? "Time's up" : timer.running ? 'Counting' : 'Paused'

  return (
    <div
      className={`relative ${className}`}
      style={{ background: bg, color: fg, ...style }}
      role={enabled ? 'timer' : undefined}
      aria-live={enabled && !timer.running ? 'polite' : 'off'}
      aria-label={enabled ? `${seconds} seconds ${label.toLowerCase()}` : undefined}
    >
      {enabled && (
        <div aria-hidden="true" className="absolute inset-0 overflow-hidden rounded-[inherit]">
          <div
            className="absolute inset-y-0 right-0"
            style={{ width: `${Math.min(100, Math.max(0, (1 - fraction) * 100))}%`, background: 'rgba(255, 245, 220, 0.74)', transition: 'width 120ms linear' }}
          />
        </div>
      )}
      <div className="relative flex items-center gap-4 md:gap-6">
        <div className="min-w-0 flex-1">{children}</div>
        {enabled && (
          <div className={`text-right flex-none ${danger ? 'bee-anim-pulse' : ''}`}>
            <div className={`bee-score ${size === 'lg' ? 'text-[clamp(4rem,10vw,10rem)]' : 'text-[clamp(3rem,7vw,7rem)]'}`}>{formatClock(remaining)}</div>
            <div className="bee-label" style={{ color: 'inherit', opacity: 0.7 }}>
              {label}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
