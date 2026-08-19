'use client'

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import type { ParamSchema, ParamsOf, Store, Tool } from '@rareshape/schema'
import { createStore } from '@rareshape/schema'

/** Binds the framework-free store to React without cloning state per render. */
export function useToolStore<S extends ParamSchema>(
  tool: Tool<S>,
  encoded: string | null,
): { store: Store<S>; params: ParamsOf<S> } {
  const store = useMemo(() => createStore(tool, { encoded }), [tool, encoded])

  const subscribe = useCallback(
    (onChange: () => void) => store.subscribe(() => onChange()),
    [store],
  )
  const getSnapshot = useCallback(() => store.get(), [store])

  const params = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  return { store, params }
}

/**
 * Writes the current state into the URL without adding history entries.
 * `extras` carries the state that is not a param — the stage aspect — so a
 * copied link reproduces what the sender was actually looking at.
 */
export function useUrlSync(
  slug: string,
  encoded: string,
  extras: Record<string, string> = {},
): void {
  const extrasKey = JSON.stringify(extras)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const entries = Object.entries(JSON.parse(extrasKey) as Record<string, string>)

    const unchanged =
      (url.searchParams.get('p') ?? '') === encoded &&
      entries.every(([key, value]) => (url.searchParams.get(key) ?? '') === value)
    if (unchanged) return

    if (encoded) url.searchParams.set('p', encoded)
    else url.searchParams.delete('p')
    for (const [key, value] of entries) {
      if (value) url.searchParams.set(key, value)
      else url.searchParams.delete(key)
    }
    window.history.replaceState(null, '', url.toString())
  }, [slug, encoded, extrasKey])
}
