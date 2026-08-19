/**
 * Param types. Every type here has exactly one control, one URL encoding, one
 * randomiser and one coercion rule — see the table in TOOL_SPEC.md §3.
 * Adding a type means adding all four, in this file and in packages/kit.
 */
import type { Rng } from '@rareshape/core'
import { clamp, clean, round } from '@rareshape/core'

export type ParamType =
  | 'number'
  | 'int'
  | 'range'
  | 'boolean'
  | 'select'
  | 'color'
  | 'palette'
  | 'angle'
  | 'point'
  | 'text'
  | 'seed'
  | 'curve'

export interface Point {
  x: number
  y: number
}
export type Span = [number, number]
export type Curve = [number, number, number, number]

export interface Common<T> {
  label: string
  default: T
  /** Groups become labelled sections in the rail, in first-seen order. */
  group?: string
  hint?: string
  /** Freeze the URL key. Do this once a tool has been shared publicly. */
  key?: string
  /** `false` pins the param through randomize. */
  randomize?: boolean
  /** Hide the control when this returns false. Never affects rendering. */
  when?: (params: Record<string, unknown>) => boolean
}

export interface NumberDef extends Common<number> {
  type: 'number'
  min: number
  max: number
  step?: number
  unit?: string
}
export interface IntDef extends Common<number> {
  type: 'int'
  min: number
  max: number
  step?: number
  unit?: string
}
export interface RangeDef extends Common<Span> {
  type: 'range'
  min: number
  max: number
  step?: number
  unit?: string
}
export interface BooleanDef extends Common<boolean> {
  type: 'boolean'
}
export interface SelectOption<V extends string = string> {
  value: V
  label?: string
}
export interface SelectDef<V extends string = string> extends Common<V> {
  type: 'select'
  options: readonly SelectOption<V>[]
}
export interface ColorDef extends Common<string> {
  type: 'color'
  /** Allow an alpha channel in the picker and in the value. */
  alpha?: boolean
}
export interface PaletteDef extends Common<string[]> {
  type: 'palette'
  min?: number
  max?: number
}
export interface AngleDef extends Common<number> {
  type: 'angle'
  step?: number
}
export interface PointDef extends Common<Point> {
  type: 'point'
}
export interface TextDef extends Common<string> {
  type: 'text'
  maxLength?: number
  placeholder?: string
}
export interface SeedDef extends Common<number> {
  type: 'seed'
}
export interface CurveDef extends Common<Curve> {
  type: 'curve'
}

export type ParamDef =
  | NumberDef
  | IntDef
  | RangeDef
  | BooleanDef
  | SelectDef<string>
  | ColorDef
  | PaletteDef
  | AngleDef
  | PointDef
  | TextDef
  | SeedDef
  | CurveDef

export type ParamSchema = Record<string, ParamDef>

/** The value type a def produces. Inferred from `default`. */
export type ValueOf<D> = D extends Common<infer T> ? T : never

export type ParamsOf<S extends ParamSchema> = { [K in keyof S]: ValueOf<S[K]> }

/* -------------------------------------------------------------------------- */
/* Factories — the only way a tool declares a param.                          */
/* -------------------------------------------------------------------------- */

export const p = {
  number: (o: Omit<NumberDef, 'type'>): NumberDef => ({ type: 'number', ...o }),
  int: (o: Omit<IntDef, 'type'>): IntDef => ({ type: 'int', step: 1, ...o }),
  range: (o: Omit<RangeDef, 'type'>): RangeDef => ({ type: 'range', ...o }),
  boolean: (o: Omit<BooleanDef, 'type'>): BooleanDef => ({ type: 'boolean', ...o }),
  select: <const V extends string>(
    o: Omit<SelectDef<V>, 'type'>,
  ): SelectDef<V> => ({ type: 'select', ...o }),
  color: (o: Omit<ColorDef, 'type'>): ColorDef => ({ type: 'color', ...o }),
  palette: (o: Omit<PaletteDef, 'type'>): PaletteDef => ({ type: 'palette', ...o }),
  angle: (o: Omit<AngleDef, 'type'>): AngleDef => ({ type: 'angle', ...o }),
  point: (o: Omit<PointDef, 'type'>): PointDef => ({ type: 'point', ...o }),
  text: (o: Omit<TextDef, 'type'>): TextDef => ({ type: 'text', ...o }),
  seed: (o: Omit<SeedDef, 'type'>): SeedDef => ({ type: 'seed', ...o }),
  curve: (o: Omit<CurveDef, 'type'>): CurveDef => ({ type: 'curve', ...o }),
}

/* -------------------------------------------------------------------------- */
/* Runtime ops — coerce, randomize, compare. One entry per type.              */
/* -------------------------------------------------------------------------- */

const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i

const randomHex = (rng: Rng, alpha: boolean): string => {
  const c = () => Math.floor(rng() * 256).toString(16).padStart(2, '0')
  return `#${c()}${c()}${c()}${alpha ? c() : ''}`
}

/** Bring an arbitrary value into a param's domain. Used on every URL decode. */
export function coerce(def: ParamDef, value: unknown): unknown {
  switch (def.type) {
    case 'number': {
      const v = Number(value)
      if (!Number.isFinite(v)) return def.default
      return clean(clamp(def.step ? round(v, def.step) : v, def.min, def.max))
    }
    case 'int': {
      const v = Number(value)
      if (!Number.isFinite(v)) return def.default
      return clamp(Math.round(round(v, def.step ?? 1)), def.min, def.max)
    }
    case 'angle': {
      const v = Number(value)
      if (!Number.isFinite(v)) return def.default
      return clean(def.step ? round(v, def.step) : v)
    }
    case 'seed': {
      const v = Number(value)
      return Number.isFinite(v) ? Math.abs(Math.trunc(v)) % 1_000_000 : def.default
    }
    case 'range': {
      if (!Array.isArray(value) || value.length !== 2) return def.default
      const lo = Number(value[0])
      const hi = Number(value[1])
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) return def.default
      const a = clamp(def.step ? round(lo, def.step) : lo, def.min, def.max)
      const b = clamp(def.step ? round(hi, def.step) : hi, def.min, def.max)
      return [clean(Math.min(a, b)), clean(Math.max(a, b))] as Span
    }
    case 'boolean':
      return typeof value === 'boolean' ? value : value === 1 || value === '1' || value === 'true'
    case 'select':
      return def.options.some((o) => o.value === value) ? value : def.default
    case 'color': {
      const s = String(value)
      const withHash = s.startsWith('#') ? s : `#${s}`
      return HEX.test(withHash) ? withHash.toLowerCase() : def.default
    }
    case 'palette': {
      if (!Array.isArray(value)) return def.default
      const colors = value
        .map((c) => coerce({ type: 'color', label: '', default: '#000000' }, c) as string)
        .slice(0, def.max ?? 16)
      return colors.length >= (def.min ?? 1) ? colors : def.default
    }
    case 'point': {
      const arr = Array.isArray(value) ? value : null
      const obj = !arr && typeof value === 'object' && value ? (value as Point) : null
      const x = Number(arr ? arr[0] : obj?.x)
      const y = Number(arr ? arr[1] : obj?.y)
      if (!Number.isFinite(x) || !Number.isFinite(y)) return def.default
      return { x: clean(clamp(x, 0, 1)), y: clean(clamp(y, 0, 1)) }
    }
    case 'text': {
      const s = String(value ?? '')
      return def.maxLength ? s.slice(0, def.maxLength) : s
    }
    case 'curve': {
      if (!Array.isArray(value) || value.length !== 4) return def.default
      const nums = value.map(Number)
      if (nums.some((v) => !Number.isFinite(v))) return def.default
      return [
        clean(clamp(nums[0] as number, 0, 1)),
        clean(nums[1] as number),
        clean(clamp(nums[2] as number, 0, 1)),
        clean(nums[3] as number),
      ] as Curve
    }
  }
}

export function randomValue(def: ParamDef, rng: Rng): unknown {
  switch (def.type) {
    case 'number':
      return coerce(def, rng.float(def.min, def.max))
    case 'int':
      return coerce(def, rng.int(def.min, def.max))
    case 'angle':
      return coerce(def, rng.float(0, 360))
    case 'seed':
      return rng.int(0, 999_999)
    case 'range': {
      const a = rng.float(def.min, def.max)
      const b = rng.float(def.min, def.max)
      return coerce(def, [Math.min(a, b), Math.max(a, b)])
    }
    case 'boolean':
      return rng.bool()
    case 'select':
      return def.options.length ? rng.pick(def.options).value : def.default
    case 'color':
      return randomHex(rng, def.alpha === true)
    case 'palette': {
      const count = def.default.length || rng.int(def.min ?? 2, def.max ?? 5)
      return Array.from({ length: count }, () => randomHex(rng, false))
    }
    case 'point':
      return { x: clean(rng()), y: clean(rng()) }
    case 'text':
      // Text is content, not noise — randomize leaves it alone.
      return def.default
    case 'curve':
      return [clean(rng()), clean(rng.float(-0.4, 1.4)), clean(rng()), clean(rng.float(-0.4, 1.4))] as Curve
  }
}

export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => sameValue(v, b[i]))
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a as object)
    const kb = Object.keys(b as object)
    return (
      ka.length === kb.length &&
      ka.every((k) => sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
    )
  }
  return false
}

export function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cloneValue) as unknown as T
  if (value && typeof value === 'object') return { ...(value as object) } as T
  return value
}

/** Params whose control is currently visible, honouring `when`. */
export function isVisible(def: ParamDef, params: Record<string, unknown>): boolean {
  return def.when ? def.when(params) : true
}
