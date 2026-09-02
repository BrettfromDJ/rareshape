'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { TimerState } from './types'

export interface ShortcutMap {
  [combo: string]: (() => void) | undefined
}

const isTypingTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/**
 * Host shortcuts. Keys are `r`, `space`, `mod+z`. A field with focus never
 * triggers one, and an open dialog disables them all.
 */
export function useShortcuts(map: ShortcutMap, enabled = true): void {
  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (keyEvent: KeyboardEvent) => {
      if (isTypingTarget(keyEvent.target)) return
      if (keyEvent.altKey) return
      const key = keyEvent.key === ' ' ? 'space' : keyEvent.key.toLowerCase()
      const combo = (keyEvent.metaKey || keyEvent.ctrlKey ? 'mod+' : '') + (keyEvent.shiftKey ? 'shift+' : '') + key
      const handler = map[combo] ?? (keyEvent.shiftKey ? map[key] : undefined)
      if (!handler) return
      keyEvent.preventDefault()
      handler()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [map, enabled])
}

const noop = () => () => {}

/** True once the component has mounted in the browser; false during server render and hydration. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  )
}

/**
 * Milliseconds left on a timer, ticking while it runs. The timer stores an
 * end time rather than a countdown, so any window computes the same value.
 */
export function useTimerRemaining(timer: TimerState): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!timer.running) return
    const id = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(id)
  }, [timer.running, timer.endsAt])
  if (!timer.running || !timer.endsAt) return timer.remainingMs
  // `now` can be a tick stale right after a start, so the value is clamped to the duration.
  return Math.min(timer.durationMs, Math.max(0, timer.endsAt - now))
}

/** Re-renders with a new key whenever `value` changes, for one-shot animations. */
export function useBump(value: unknown): number {
  const previous = useRef(value)
  const [bump, setBump] = useState(0)
  useEffect(() => {
    if (previous.current !== value) {
      previous.current = value
      setBump((n) => n + 1)
    }
  }, [value])
  return bump
}
