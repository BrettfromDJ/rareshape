/**
 * The param store. Framework-free on purpose: the React kit and the vanilla
 * eject shell both drive this, which is what stops the two from drifting.
 *
 * Holds params, undo/redo history, presets, randomize and reset, and knows how
 * to encode itself for the URL.
 */
import { makeRng } from '@rareshape/core'
import type { ParamSchema, ParamsOf } from './params'
import { cloneValue, coerce, randomValue, sameValue } from './params'
import type { Preset, Tool } from './define'
import { decodeParams, encodeParams } from './url'

export interface StoreOptions {
  /** Encoded `?p=` value to start from. */
  encoded?: string | null
  /** Merge changes made within this many ms into one history entry (drags). */
  coalesceMs?: number
  /** Depth of the undo stack. */
  historyLimit?: number
}

export type Unsubscribe = () => void

export interface Store<S extends ParamSchema = ParamSchema> {
  get(): ParamsOf<S>
  set<K extends keyof S & string>(name: K, value: ParamsOf<S>[K], options?: { history?: boolean }): void
  patch(values: Partial<ParamsOf<S>>, options?: { history?: boolean }): void
  replace(values: ParamsOf<S>, options?: { history?: boolean }): void
  randomize(): void
  reset(): void
  loadPreset(name: string): void
  presets(): Preset<S>[]
  undo(): boolean
  redo(): boolean
  canUndo(): boolean
  canRedo(): boolean
  /** Compact `?p=` value for the current state. Empty when everything is default. */
  encoded(): string
  isDefault(): boolean
  subscribe(listener: (params: ParamsOf<S>) => void): Unsubscribe
}

export function createStore<S extends ParamSchema>(
  tool: Tool<S>,
  options: StoreOptions = {},
): Store<S> {
  const { coalesceMs = 400, historyLimit = 100 } = options

  let params = decodeParams(
    tool.params,
    tool.keys,
    tool.defaults as Record<string, unknown>,
    options.encoded ?? null,
  ) as ParamsOf<S>

  const past: ParamsOf<S>[] = []
  const future: ParamsOf<S>[] = []
  const listeners = new Set<(params: ParamsOf<S>) => void>()

  let lastTouch = 0
  let lastKey: string | null = null

  /** Params are replaced, never mutated, so the reference is a valid identity
   *  for change detection — React's useSyncExternalStore relies on that. */
  const snapshot = (): ParamsOf<S> => params

  const emit = () => {
    for (const listener of listeners) listener(params)
  }

  const pushHistory = (key: string | null) => {
    const now = Date.now()
    const coalesce = key !== null && key === lastKey && now - lastTouch < coalesceMs
    lastTouch = now
    lastKey = key
    if (coalesce) return
    past.push(snapshot())
    if (past.length > historyLimit) past.shift()
    future.length = 0
  }

  const commit = (next: ParamsOf<S>, history: boolean, key: string | null) => {
    if (sameValue(next, params)) return
    if (history) pushHistory(key)
    else {
      lastKey = null
    }
    params = next
    emit()
  }

  return {
    get: snapshot,

    set(name, value, opts) {
      const def = tool.params[name]
      if (!def) return
      const clean = coerce(def, value) as ParamsOf<S>[typeof name]
      commit({ ...params, [name]: clean }, opts?.history ?? true, name)
    },

    patch(values, opts) {
      const next = { ...params }
      for (const [name, value] of Object.entries(values)) {
        const def = tool.params[name]
        if (!def) continue
        ;(next as Record<string, unknown>)[name] = coerce(def, value)
      }
      commit(next, opts?.history ?? true, null)
    },

    replace(values, opts) {
      commit({ ...values }, opts?.history ?? true, null)
    },

    randomize() {
      // Seed the randomiser from the current seed param so a randomize is
      // itself reproducible, then let it walk forward.
      const seedName = Object.keys(tool.params).find((k) => tool.params[k]?.type === 'seed')
      const currentSeed = seedName ? Number((params as Record<string, unknown>)[seedName]) : 0
      const rng = makeRng((currentSeed || 1) * 2654435761)
      const next = { ...params } as Record<string, unknown>
      for (const [name, def] of Object.entries(tool.params)) {
        // `seed` always moves; everything else honours `randomize: false`.
        if (def.type !== 'seed' && def.randomize === false) continue
        next[name] = randomValue(def, rng)
      }
      commit(next as ParamsOf<S>, true, null)
    },

    reset() {
      commit(
        Object.fromEntries(
          Object.entries(tool.defaults as Record<string, unknown>).map(([k, v]) => [k, cloneValue(v)]),
        ) as ParamsOf<S>,
        true,
        null,
      )
    },

    loadPreset(name) {
      const preset = tool.presets.find((entry) => entry.name === name)
      if (!preset) return
      const next = {
        ...(tool.defaults as Record<string, unknown>),
      } as Record<string, unknown>
      for (const [key, value] of Object.entries(preset.params)) {
        const def = tool.params[key]
        if (def) next[key] = coerce(def, value)
      }
      commit(next as ParamsOf<S>, true, null)
    },

    presets: () => tool.presets,

    undo() {
      const previous = past.pop()
      if (!previous) return false
      future.push(snapshot())
      params = previous
      lastKey = null
      emit()
      return true
    },

    redo() {
      const next = future.pop()
      if (!next) return false
      past.push(snapshot())
      params = next
      lastKey = null
      emit()
      return true
    },

    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,

    encoded: () =>
      encodeParams(
        tool.params,
        tool.keys,
        tool.defaults as Record<string, unknown>,
        params as Record<string, unknown>,
      ),

    isDefault: () => sameValue(params, tool.defaults),

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
