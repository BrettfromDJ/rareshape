/**
 * The param store. Framework-free on purpose: the React kit and the vanilla
 * eject shell both drive this, which is what stops the two from drifting.
 *
 * Holds params, undo/redo history, presets, randomize and reset, and knows how
 * to encode itself for the URL.
 */
import {
  distinctPalette,
  groundColor,
  lineColor,
  makeRng,
  parseColor,
  rgbToHsv,
  type Rng,
} from '@rareshape/core'
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
  /** `keepColors` pins the scheme so only the geometry moves. */
  randomize(options?: { keepColors?: boolean }): void
  /** Re-rolls only the color and palette params, leaving the geometry alone. */
  randomizeColors(): void
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

/**
 * Rolls every color in a schema as one scheme: a ground, a palette whose
 * members are all visibly different from each other and from that ground, and
 * hairlines that stay quiet against it.
 *
 * Both randomize buttons go through here. Rolling each color independently —
 * which is what the main button used to do — regularly produced two bands a
 * few percent apart, and flat artwork in two such colors reads as one block.
 */
function rollColors(
  schema: ParamSchema,
  params: Record<string, unknown>,
  rng: Rng,
): Record<string, unknown> {
  const colorParams = Object.entries(schema).filter(
    ([, def]) => (def.type === 'color' || def.type === 'palette') && def.randomize !== false,
  )
  if (colorParams.length === 0) return {}

  const next: Record<string, unknown> = {}

  // The ground first: everything else has to stay clear of it.
  const seedHue = rng.float(0, 360)
  let ground: string | null = null
  for (const [name, def] of colorParams) {
    if (def.type === 'color' && def.role === 'ground') {
      ground = groundColor(rng, seedHue)
      next[name] = ground
    }
  }

  const avoid = ground ? [ground] : []
  // One scheme for the whole tool, so separate color params relate to each
  // other instead of each being its own accident.
  const scheme = distinctPalette(rng, 6, avoid)
  const hue = rgbToHsv(parseColor(scheme[0] as string)).h

  let inkIndex = 0
  for (const [name, def] of colorParams) {
    if (def.type === 'palette') {
      const current = (params[name] as string[] | undefined)?.length
      const count = Math.max(def.min ?? 2, Math.min(def.max ?? 5, current ?? 4))
      next[name] = distinctPalette(rng, count, avoid)
    } else if (def.type === 'color' && def.role === 'line') {
      next[name] = lineColor(rng, hue, ground ?? '#ffffff')
    } else if (def.type === 'color' && def.role !== 'ground') {
      next[name] = scheme[inkIndex++ % scheme.length] as string
    }
  }

  return next
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

    randomize(options) {
      const rng = makeRng(entropy())
      const next = { ...params } as Record<string, unknown>
      for (const [name, def] of Object.entries(tool.params)) {
        // `seed` always moves; everything else honours `randomize: false`.
        if (def.type !== 'seed' && def.randomize === false) continue
        // Colors are rolled together below, as one scheme.
        if (def.type === 'color' || def.type === 'palette') continue
        next[name] = randomValue(def, rng)
      }
      // A scheme somebody has settled on is worth more than a new one, so it
      // can be pinned and only the geometry re-rolled.
      if (!options?.keepColors) Object.assign(next, rollColors(tool.params, next, rng))
      commit(next as ParamsOf<S>, true, null)
    },

    randomizeColors() {
      const scheme = rollColors(tool.params, params as Record<string, unknown>, makeRng(entropy()))
      if (Object.keys(scheme).length === 0) return
      commit({ ...params, ...scheme } as ParamsOf<S>, true, null)
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
