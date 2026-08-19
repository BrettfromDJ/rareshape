'use client'

import { useEffect } from 'react'

export interface ShortcutMap {
  [combo: string]: () => void
}

const isTypingTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/**
 * Global shortcuts. Keys are `z`, `shift+z`, `mod+k` (⌘ or Ctrl), `space`.
 * Typing in a field never triggers one.
 */
export function useShortcuts(map: ShortcutMap, enabled = true): void {
  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return
      const key = event.key === ' ' ? 'space' : event.key.toLowerCase()
      const combo =
        (event.metaKey || event.ctrlKey ? 'mod+' : '') + (event.shiftKey ? 'shift+' : '') + key
      const handler = map[combo]
      if (!handler) return
      event.preventDefault()
      handler()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [map, enabled])
}

/** The list shown in the tool page's shortcut hint. Mirrors TOOL_SPEC.md §8. */
export const SHORTCUT_HINTS: Array<[string, string]> = [
  ['R', 'Randomize'],
  ['Z', 'Undo'],
  ['⇧Z', 'Redo'],
  ['Space', 'Play / pause'],
  ['E', 'Export'],
  ['C', 'Copy link'],
  ['0', 'Reset'],
  ['[ ]', 'Presets'],
]
