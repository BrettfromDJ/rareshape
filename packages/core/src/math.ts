export const TAU = Math.PI * 2

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export const inverseLerp = (a: number, b: number, v: number): number =>
  a === b ? 0 : (v - a) / (b - a)

export const remap = (v: number, a1: number, b1: number, a2: number, b2: number): number =>
  lerp(a2, b2, inverseLerp(a1, b1, v))

/** Always-positive modulo. */
export const mod = (a: number, n: number): number => ((a % n) + n) % n

/** Wrap into [0,1). Loop positions run through this. */
export const wrap01 = (t: number): number => mod(t, 1)

export const smoothstep = (t: number): number => {
  const x = clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}

export const round = (v: number, step: number): number =>
  step > 0 ? Math.round(v / step) * step : v

/** Round for display and for the URL: kills 0.30000000000000004. */
export const clean = (v: number, decimals = 6): number =>
  Number.parseFloat(v.toFixed(decimals))

/** A seamless 0..1 -> 0..1 ping-pong. */
export const pingPong = (t: number): number => {
  const x = mod(t, 1)
  return x < 0.5 ? x * 2 : 2 - x * 2
}

/** Phase offset that stays in the loop: sin over one full cycle of t. */
export const loopSin = (t: number, phase = 0): number => Math.sin((wrap01(t) + phase) * TAU)
export const loopCos = (t: number, phase = 0): number => Math.cos((wrap01(t) + phase) * TAU)
