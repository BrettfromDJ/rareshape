/**
 * The param store. Framework-free on purpose: the React kit and the vanilla
 * eject shell both drive this, which is what stops the two from drifting.
 *
 * Holds params, undo/redo history, presets, randomize and reset, and knows how
 * to encode itself for the URL.
 */
import { groundColor, harmonyPalette, lineColor, makeRng, rgbToHsv, parseColor } from '@rareshape/core'
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

/**
 * A fresh, unpredictable number for each press of randomize.
 *
 * Determinism belongs to *rendering* — the same params must always produce the
 * same pixels — not to the button that picks the params. Deriving the roll from
 * the current state made every session replay the identical chain of results.
 * The state that comes out is still captured in the URL, so any result stays
 * reproducible and shareable.
 */
function entropy(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    return crypto.getRandomValues(new Uint32Array(1))[0] as number
  }
  return Math.floor(Math.random() * 0xffffffff)
}

export interface Store<S extends ParamSchema = ParamSchema> {
  get(): ParamsOf<S>
  set<K extends keyof S & string>(name: K, value: ParamsOf<S>[K], options?: { history?: boolean }): void
  patch(values: Partial<ParamsOf<S>>, options?: { history?: boolean }): void
  replace(values: ParamsOf<S>, options?: { history?: boolean }): void
  randomize(): void
  /** Re-rolls only the colour and palette params, leaving the geometry alone. */
  randomizeColours(): void
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
      const rng = makeRng(entropy())
      const next = { ...params } as Record<string, unknown>
      for (const [name, def] of Object.entries(tool.params)) {
        // `seed` always moves; everything else honours `randomize: false`.
        if (def.type !== 'seed' && def.randomize === false) continue
        next[name] = randomValue(def, rng)
      }
      commit(next as ParamsOf<S>, true, null)
    },

    randomizeColours() {
      const colourNames = Object.entries(tool.params).filter(
        ([, def]) => (def.type === 'color' || def.type === 'palette') && def.randomize !== false,
      )
      if (colourNames.length === 0) return

      const rng = makeRng(entropy())

      const scheme = harmonyPalette(rng, 6)
      const hue = rgbToHsv(parseColor(scheme[0] as string)).h
      const next = { ...params } as Record<string, unknown>

      // Grounds first: a line colour is only quiet relative to its ground.
      let ground: string | null = null
      for (const [name, def] of colourNames) {
        if (def.type === 'color' && def.role === 'ground') {
          ground = groundColor(rng, hue)
          next[name] = ground
        }
      }

      let inkIndex = 0
      for (const [name, def] of colourNames) {
        if (def.type === 'palette') {
          const length = (params as Record<string, string[]>)[name]?.length ?? 3
          next[name] = harmonyPalette(rng, Math.max(1, length))
        } else if (def.type === 'color' && def.role === 'line') {
          next[name] = lineColor(rng, hue, ground ?? '#ffffff')
        } else if (def.type === 'color' && def.role !== 'ground') {
          next[name] = scheme[inkIndex++ % scheme.length] as string
        }
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
