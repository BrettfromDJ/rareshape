import { TAU, clamp, lerp } from './math'

export interface Vec2 {
  x: number
  y: number
}

export const vec = (x: number, y: number): Vec2 => ({ x, y })
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y })
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y })
export const scale = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k })
export const length = (a: Vec2): number => Math.hypot(a.x, a.y)
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y)
export const lerpVec = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
})

export const rotate = (p: Vec2, radians: number, origin: Vec2 = { x: 0, y: 0 }): Vec2 => {
  const c = Math.cos(radians)
  const s = Math.sin(radians)
  const dx = p.x - origin.x
  const dy = p.y - origin.y
  return { x: origin.x + dx * c - dy * s, y: origin.y + dx * s + dy * c }
}

export const polar = (radius: number, radians: number, origin: Vec2 = { x: 0, y: 0 }): Vec2 => ({
  x: origin.x + Math.cos(radians) * radius,
  y: origin.y + Math.sin(radians) * radius,
})

/** Points of a regular polygon, first point at -90°. */
export function polygon(sides: number, radius: number, center: Vec2 = { x: 0, y: 0 }): Vec2[] {
  const n = Math.max(3, Math.round(sides))
  return Array.from({ length: n }, (_, i) => polar(radius, (i / n) * TAU - Math.PI / 2, center))
}

/** An SVG path `d` from points. */
export function pathFrom(points: readonly Vec2[], close = true): string {
  if (points.length === 0) return ''
  const [first, ...rest] = points as [Vec2, ...Vec2[]]
  const d = [`M${n(first.x)} ${n(first.y)}`, ...rest.map((p) => `L${n(p.x)} ${n(p.y)}`)]
  if (close) d.push('Z')
  return d.join('')
}

/** Numbers in output are trimmed — it is the difference between a 40KB and a 12KB SVG. */
export const n = (v: number, decimals = 3): string =>
  Number.parseFloat(v.toFixed(decimals)).toString()

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Fit `aspect` (w/h) inside a box, centred. */
export function fitRect(box: Rect, aspect: number): Rect {
  const boxAspect = box.width / box.height
  const width = boxAspect > aspect ? box.height * aspect : box.width
  const height = boxAspect > aspect ? box.height : box.width / aspect
  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
  }
}

/** Parse "16:9" into 16/9. Falls back to 1. */
export function parseAspect(aspect: string): number {
  const [w, h] = aspect.split(':').map(Number)
  return w && h ? w / h : 1
}

/** A grid of cell rects, row-major. */
export function grid(cols: number, rows: number, box: Rect, gap = 0): Rect[] {
  const c = Math.max(1, Math.round(cols))
  const r = Math.max(1, Math.round(rows))
  const cw = (box.width - gap * (c - 1)) / c
  const ch = (box.height - gap * (r - 1)) / r
  const out: Rect[] = []
  for (let j = 0; j < r; j++) {
    for (let i = 0; i < c; i++) {
      out.push({ x: box.x + i * (cw + gap), y: box.y + j * (ch + gap), width: cw, height: ch })
    }
  }
  return out
}

export const clamp01 = (v: number): number => clamp(v, 0, 1)
