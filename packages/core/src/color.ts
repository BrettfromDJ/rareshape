import { clamp, lerp, mod } from './math'
import type { Rng } from './rng'

export interface Rgba {
  r: number // 0..255
  g: number
  b: number
  a: number // 0..1
}

const hex2 = (n: number) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0')

export function parseColor(input: string): Rgba {
  const s = input.trim()
  if (s.startsWith('#')) {
    const h = s.slice(1)
    const expand = (c: string) => parseInt(c + c, 16)
    if (h.length === 3 || h.length === 4) {
      return {
        r: expand(h[0] as string),
        g: expand(h[1] as string),
        b: expand(h[2] as string),
        a: h.length === 4 ? expand(h[3] as string) / 255 : 1,
      }
    }
    if (h.length === 6 || h.length === 8) {
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
      }
    }
  }
  const m = s.match(/^rgba?\(([^)]+)\)$/i)
  if (m) {
    const parts = (m[1] as string).split(/[,\s/]+/).filter(Boolean).map(Number)
    return { r: parts[0] ?? 0, g: parts[1] ?? 0, b: parts[2] ?? 0, a: parts[3] ?? 1 }
  }
  return { r: 0, g: 0, b: 0, a: 1 }
}

export function toHex(c: Rgba, withAlphaChannel = c.a < 1): string {
  return `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}${withAlphaChannel ? hex2(c.a * 255) : ''}`
}

export function toCss(c: Rgba): string {
  return c.a >= 1
    ? `rgb(${Math.round(c.r)} ${Math.round(c.g)} ${Math.round(c.b)})`
    : `rgb(${Math.round(c.r)} ${Math.round(c.g)} ${Math.round(c.b)} / ${Number(c.a.toFixed(3))})`
}

/** Alpha applied on top of an existing color string. */
export function withAlpha(color: string, alpha: number): string {
  const c = parseColor(color)
  return toCss({ ...c, a: clamp(c.a * alpha, 0, 1) })
}

export function mix(a: string, b: string, t: number): string {
  const x = parseColor(a)
  const y = parseColor(b)
  return toCss({
    r: lerp(x.r, y.r, t),
    g: lerp(x.g, y.g, t),
    b: lerp(x.b, y.b, t),
    a: lerp(x.a, y.a, t),
  })
}

export interface Hsl {
  h: number // 0..360
  s: number // 0..1
  l: number // 0..1
  a: number
}

export function rgbToHsl({ r, g, b, a }: Rgba): Hsl {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l, a }
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
  else if (max === gn) h = ((bn - rn) / d + 2) / 6
  else h = ((rn - gn) / d + 4) / 6
  return { h: h * 360, s, l, a }
}

export function hslToRgb({ h, s, l, a }: Hsl): Rgba {
  const hn = mod(h, 360) / 360
  if (s === 0) {
    const v = l * 255
    return { r: v, g: v, b: v, a }
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const channel = (t: number) => {
    const tn = mod(t, 1)
    if (tn < 1 / 6) return p + (q - p) * 6 * tn
    if (tn < 1 / 2) return q
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6
    return p
  }
  return { r: channel(hn + 1 / 3) * 255, g: channel(hn) * 255, b: channel(hn - 1 / 3) * 255, a }
}

/** Rotate hue, keeping saturation and lightness. */
export function shiftHue(color: string, degrees: number): string {
  const hsl = rgbToHsl(parseColor(color))
  return toCss(hslToRgb({ ...hsl, h: hsl.h + degrees }))
}

/** Sample a palette continuously, wrapping. */
export function samplePalette(palette: readonly string[], t: number): string {
  if (palette.length === 0) return '#000000'
  if (palette.length === 1) return palette[0] as string
  const x = mod(t, 1) * palette.length
  const i = Math.floor(x)
  return mix(palette[i % palette.length] as string, palette[(i + 1) % palette.length] as string, x - i)
}

/** Relative luminance, for picking readable ink over a given ground. */
export function luminance(color: string): number {
  const { r, g, b } = parseColor(color)
  const f = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/* -------------------------------------------------------------------------- */
/* HSV — what a colour picker's saturation/value square is built on.           */
/* -------------------------------------------------------------------------- */

export interface Hsv {
  h: number // 0..360
  s: number // 0..1
  v: number // 0..1
  a: number
}

export function rgbToHsv({ r, g, b, a }: Rgba): Hsv {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
    else if (max === gn) h = ((bn - rn) / d + 2) / 6
    else h = ((rn - gn) / d + 4) / 6
  }
  return { h: h * 360, s: max === 0 ? 0 : d / max, v: max, a }
}

export function hsvToRgb({ h, s, v, a }: Hsv): Rgba {
  const hn = mod(h, 360) / 60
  const i = Math.floor(hn)
  const f = hn - i
  const p = v * (1 - s)
  const q = v * (1 - s * f)
  const t = v * (1 - s * (1 - f))
  const table: Array<[number, number, number]> = [
    [v, t, p],
    [q, v, p],
    [p, v, t],
    [p, q, v],
    [t, p, v],
    [v, p, q],
  ]
  const [r, g, b] = table[i % 6] as [number, number, number]
  return { r: r * 255, g: g * 255, b: b * 255, a }
}

/* -------------------------------------------------------------------------- */
/* Palette generation                                                          */
/* -------------------------------------------------------------------------- */

export type Harmony = 'analogous' | 'complementary' | 'triad' | 'split' | 'mono'

const HARMONY_OFFSETS: Record<Harmony, number[]> = {
  analogous: [0, 24, -22, 46, -44, 68],
  complementary: [0, 180, 12, 192, -14, 168],
  triad: [0, 120, 240, 18, 138, 258],
  split: [0, 150, 210, 20, 168, 192],
  mono: [0, 0, 0, 0, 0, 0],
}

/**
 * A palette that hangs together: one hue family, varied in saturation and
 * value, with the odd near-neutral for punch. Random hex values look muddy
 * together; this is the difference between a randomize button worth pressing
 * and one nobody presses twice.
 */
export function harmonyPalette(rng: Rng, count: number, harmony?: Harmony): string[] {
  const scheme: Harmony =
    harmony ?? rng.pick(['analogous', 'complementary', 'triad', 'split', 'mono'] as const)
  const offsets = HARMONY_OFFSETS[scheme]
  const baseHue = rng.float(0, 360)
  const baseSaturation = rng.float(0.45, 0.95)

  // One neutral in a palette of three or more keeps it from turning to soup.
  const neutralAt = count >= 3 && rng.bool(0.7) ? rng.int(1, count - 1) : -1

  return Array.from({ length: count }, (_, i) => {
    if (i === neutralAt) {
      const dark = rng.bool()
      return toHex(hsvToRgb({ h: baseHue, s: 0.05, v: dark ? rng.float(0.06, 0.14) : rng.float(0.94, 1), a: 1 }), false)
    }
    const hue = baseHue + (offsets[i % offsets.length] ?? 0) + rng.float(-6, 6)
    const saturation =
      scheme === 'mono' ? baseSaturation * rng.float(0.25, 1) : baseSaturation * rng.float(0.7, 1.05)
    const value = 0.45 + ((i * 0.37) % 1) * 0.5 + rng.float(-0.08, 0.08)
    return toHex(
      hsvToRgb({ h: hue, s: Math.min(1, saturation), v: Math.min(1, Math.max(0.12, value)), a: 1 }),
      false,
    )
  })
}

/** A page colour: nearly neutral, tinted towards the palette, light or dark. */
export function groundColor(rng: Rng, hue: number): string {
  const dark = rng.bool(0.25)
  return toHex(
    hsvToRgb({
      h: hue + rng.float(-20, 20),
      s: rng.float(0.02, 0.1),
      v: dark ? rng.float(0.06, 0.13) : rng.float(0.9, 0.99),
      a: 1,
    }),
    false,
  )
}

/** A hairline colour that sits quietly on a given ground. */
export function lineColor(rng: Rng, hue: number, ground: string): string {
  const light = luminance(ground) > 0.4
  return toHex(
    hsvToRgb({
      h: hue + rng.float(-30, 30),
      s: rng.float(0.1, 0.35),
      v: light ? rng.float(0.62, 0.85) : rng.float(0.28, 0.45),
      a: 1,
    }),
    false,
  )
}
