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

/** Writes the current state into the URL without adding history entries. */
export function useUrlSync(slug: string, encoded: string, enabled = true): void {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const current = url.searchParams.get('p') ?? ''
    if (current === encoded) return
    if (encoded) url.searchParams.set('p', encoded)
    else url.searchParams.delete('p')
    window.history.replaceState(null, '', url.toString())
  }, [slug, encoded, enabled])
}
