/**
 * Seeded RNG. The only source of randomness a tool is allowed to use.
 * sfc32 seeded through splitmix32 — small, fast, and identical across engines,
 * which is what makes the determinism test meaningful.
 */
export interface Rng {
  /** [0,1) */
  (): number
  float(min: number, max: number): number
  int(min: number, max: number): number
  bool(probability?: number): boolean
  pick<T>(items: readonly T[]): T
  /** Fisher-Yates on a copy. */
  shuffle<T>(items: readonly T[]): T[]
  /** Approximately normal, mean 0, sd 1. */
  gaussian(): number
  /** A fresh independent stream, derived from this one. */
  fork(): Rng
}

function splitmix32(seed: number): () => number {
  let a = seed | 0
  return () => {
    a = (a + 0x9e3779b9) | 0
    let t = a ^ (a >>> 16)
    t = Math.imul(t, 0x21f0aaad)
    t = t ^ (t >>> 15)
    t = Math.imul(t, 0x735a2d97)
    return ((t = t ^ (t >>> 15)) >>> 0) / 4294967296
  }
}

export function makeRng(seed: number): Rng {
  const init = splitmix32(Math.trunc(seed) || 1)
  let a = (init() * 4294967296) | 0
  let b = (init() * 4294967296) | 0
  let c = (init() * 4294967296) | 0
  let d = (init() * 4294967296) | 0

  const next = (): number => {
    const t = (((a + b) | 0) + d) | 0
    d = (d + 1) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    c = (c + t) | 0
    return (t >>> 0) / 4294967296
  }

  const rng = next as Rng
  rng.float = (min, max) => min + next() * (max - min)
  rng.int = (min, max) => Math.floor(min + next() * (max - min + 1))
  rng.bool = (p = 0.5) => next() < p
  rng.pick = <T,>(items: readonly T[]): T => {
    if (items.length === 0) throw new Error('rng.pick: empty list')
    return items[Math.floor(next() * items.length)] as T
  }
  rng.shuffle = <T,>(items: readonly T[]): T[] => {
    const out = [...items]
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1))
      const tmp = out[i] as T
      out[i] = out[j] as T
      out[j] = tmp
    }
    return out
  }
  rng.gaussian = () => {
    // Box-Muller, guarding the log against 0.
    const u = 1 - next()
    const v = next()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  rng.fork = () => makeRng((next() * 4294967296) | 0)
  return rng
}

/** Stable 32-bit hash of a string — handy for deriving seeds from text. */
export function hashString(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
