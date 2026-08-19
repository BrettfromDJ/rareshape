import type { Rng } from './rng'
import { makeRng } from './rng'
import { TAU } from './math'

/**
 * Seeded 2D/3D simplex-style gradient noise built on a permutation table that
 * comes from the tool's own RNG — so noise is deterministic per seed, with no
 * global state anywhere.
 */
export interface Noise {
  noise2(x: number, y: number): number // -1..1
  noise3(x: number, y: number, z: number): number
  /** Fractal sum. */
  fbm2(x: number, y: number, octaves?: number, lacunarity?: number, gain?: number): number
  /** Noise sampled around a circle, so it loops seamlessly over t in 0..1. */
  loop2(t: number, y: number, radius?: number): number
}

const GRAD3: ReadonlyArray<readonly [number, number, number]> = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
]

export function makeNoise(seedOrRng: number | Rng): Noise {
  const rng = typeof seedOrRng === 'number' ? makeRng(seedOrRng) : seedOrRng
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = p[i] as number
    p[i] = p[j] as number
    p[j] = tmp
  }
  const perm = new Uint8Array(512)
  const permMod12 = new Uint8Array(512)
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255] as number
    permMod12[i] = (perm[i] as number) % 12
  }

  const F2 = 0.5 * (Math.sqrt(3) - 1)
  const G2 = (3 - Math.sqrt(3)) / 6
  const F3 = 1 / 3
  const G3 = 1 / 6

  const dot2 = (g: readonly [number, number, number], x: number, y: number) => g[0] * x + g[1] * y
  const dot3 = (g: readonly [number, number, number], x: number, y: number, z: number) =>
    g[0] * x + g[1] * y + g[2] * z

  const noise2 = (xin: number, yin: number): number => {
    const s = (xin + yin) * F2
    const i = Math.floor(xin + s)
    const j = Math.floor(yin + s)
    const t = (i + j) * G2
    const x0 = xin - (i - t)
    const y0 = yin - (j - t)
    const i1 = x0 > y0 ? 1 : 0
    const j1 = x0 > y0 ? 0 : 1
    const x1 = x0 - i1 + G2
    const y1 = y0 - j1 + G2
    const x2 = x0 - 1 + 2 * G2
    const y2 = y0 - 1 + 2 * G2
    const ii = i & 255
    const jj = j & 255
    let n = 0
    const corner = (x: number, y: number, gi: number) => {
      let tt = 0.5 - x * x - y * y
      if (tt < 0) return 0
      tt *= tt
      return tt * tt * dot2(GRAD3[gi] as readonly [number, number, number], x, y)
    }
    n += corner(x0, y0, permMod12[ii + (perm[jj] as number)] as number)
    n += corner(x1, y1, permMod12[ii + i1 + (perm[jj + j1] as number)] as number)
    n += corner(x2, y2, permMod12[ii + 1 + (perm[jj + 1] as number)] as number)
    return 70 * n
  }

  const noise3 = (xin: number, yin: number, zin: number): number => {
    const s = (xin + yin + zin) * F3
    const i = Math.floor(xin + s)
    const j = Math.floor(yin + s)
    const k = Math.floor(zin + s)
    const t = (i + j + k) * G3
    const x0 = xin - (i - t)
    const y0 = yin - (j - t)
    const z0 = zin - (k - t)
    let i1: number, j1: number, k1: number, i2: number, j2: number, k2: number
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0 }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1 }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1 }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1 }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1 }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0 }
    }
    const ii = i & 255
    const jj = j & 255
    const kk = k & 255
    const corner = (x: number, y: number, z: number, gi: number) => {
      let tt = 0.6 - x * x - y * y - z * z
      if (tt < 0) return 0
      tt *= tt
      return tt * tt * dot3(GRAD3[gi] as readonly [number, number, number], x, y, z)
    }
    let n = 0
    n += corner(x0, y0, z0, permMod12[ii + (perm[jj + (perm[kk] as number)] as number)] as number)
    n += corner(x0 - i1 + G3, y0 - j1 + G3, z0 - k1 + G3,
      permMod12[ii + i1 + (perm[jj + j1 + (perm[kk + k1] as number)] as number)] as number)
    n += corner(x0 - i2 + 2 * G3, y0 - j2 + 2 * G3, z0 - k2 + 2 * G3,
      permMod12[ii + i2 + (perm[jj + j2 + (perm[kk + k2] as number)] as number)] as number)
    n += corner(x0 - 1 + 3 * G3, y0 - 1 + 3 * G3, z0 - 1 + 3 * G3,
      permMod12[ii + 1 + (perm[jj + 1 + (perm[kk + 1] as number)] as number)] as number)
    return 32 * n
  }

  return {
    noise2,
    noise3,
    fbm2(x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
      let amp = 1
      let freq = 1
      let sum = 0
      let norm = 0
      for (let o = 0; o < octaves; o++) {
        sum += amp * noise2(x * freq, y * freq)
        norm += amp
        amp *= gain
        freq *= lacunarity
      }
      return norm === 0 ? 0 : sum / norm
    },
    loop2(t, y, radius = 1) {
      // Walking a circle in the noise field returns to where it started.
      return noise3(Math.cos(t * TAU) * radius, Math.sin(t * TAU) * radius, y)
    },
  }
}
