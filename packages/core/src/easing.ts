import { clamp } from './math'

export type Easing = (t: number) => number

const pow = Math.pow

export const easings = {
  linear: (t: number) => t,
  quadIn: (t: number) => t * t,
  quadOut: (t: number) => 1 - (1 - t) * (1 - t),
  quadInOut: (t: number) => (t < 0.5 ? 2 * t * t : 1 - pow(-2 * t + 2, 2) / 2),
  cubicIn: (t: number) => t * t * t,
  cubicOut: (t: number) => 1 - pow(1 - t, 3),
  cubicInOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - pow(-2 * t + 2, 3) / 2),
  expoIn: (t: number) => (t === 0 ? 0 : pow(2, 10 * t - 10)),
  expoOut: (t: number) => (t === 1 ? 1 : 1 - pow(2, -10 * t)),
  sineInOut: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  backOut: (t: number) => 1 + 2.70158 * pow(t - 1, 3) + 1.70158 * pow(t - 1, 2),
  elasticOut: (t: number) =>
    t === 0 || t === 1 ? t : pow(2, -10 * t) * Math.sin(((t * 10 - 0.75) * (2 * Math.PI)) / 3) + 1,
} satisfies Record<string, Easing>

export type EasingName = keyof typeof easings

/**
 * A cubic-bezier easing, the same curve CSS uses. Newton-Raphson with a
 * bisection fallback; deterministic and good to ~1e-6.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Easing {
  const A = (a: number, b: number) => 1 - 3 * b + 3 * a
  const B = (a: number, b: number) => 3 * b - 6 * a
  const C = (a: number) => 3 * a
  const calc = (t: number, a: number, b: number) => ((A(a, b) * t + B(a, b)) * t + C(a)) * t
  const slope = (t: number, a: number, b: number) =>
    3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a)

  return (input: number) => {
    const x = clamp(input, 0, 1)
    if (x1 === y1 && x2 === y2) return x
    let t = x
    for (let i = 0; i < 8; i++) {
      const err = calc(t, x1, x2) - x
      if (Math.abs(err) < 1e-6) return calc(t, y1, y2)
      const d = slope(t, x1, x2)
      if (Math.abs(d) < 1e-6) break
      t -= err / d
    }
    let lo = 0
    let hi = 1
    t = x
    for (let i = 0; i < 24 && Math.abs(calc(t, x1, x2) - x) > 1e-6; i++) {
      if (calc(t, x1, x2) < x) lo = t
      else hi = t
      t = (lo + hi) / 2
    }
    return calc(t, y1, y2)
  }
}
