import {
  TAU,
  luminance,
  n,
  pathFrom,
  rotate,
  type Frame,
  type SvgFrame,
  type Vec2,
} from '@rareshape/core'
import type { Params } from './tool'

/**
 * A solid here is one flat face plus the faces its edges sweep out when the
 * whole thing is dragged in a single screen direction. There is no camera and
 * no z-axis: `pitch` squashes the face vertically, which is all it takes to
 * read as a plane tipping away, and the body is a straight translation.
 *
 * Pure: no DOM, no clock, no Math.random. Motion comes from `frame.t` and all
 * of it is periodic over one loop, so t=1 lands exactly on t=0.
 */
export function render(frame: Frame<Params>): SvgFrame {
  const { params, width, height, rng } = frame
  const minSide = Math.min(width, height)
  const middle: Vec2 = { x: width / 2, y: height / 2 }

  const count = Math.max(1, params.count)
  // A nominal size only. Everything is laid out at this scale and then the
  // whole composition is measured and fitted to the frame, so `Size` means how
  // much of the frame the arrangement takes rather than how big one solid is.
  // Scaling each solid instead left a narrow fan of thin blades as a speck in
  // the middle of an empty frame — a composition nobody would keep, arrived at
  // by multiplying four reasonable-looking ranges together.
  const radius = minSide * 0.2

  const face = facePolygon(params.shape, params.ratio)
  const pitched = Math.cos((params.pitch * TAU) / 360)
  const turned = (params.turn * TAU) / 360

  // The body direction, in screen space. Everything is dragged the same way —
  // that shared direction is what makes a pile of unrelated shapes read as one
  // scene lit from one side.
  const lean = (params.lean * TAU) / 360
  const body: Vec2 = {
    x: Math.cos(lean) * params.depth * minSide,
    y: Math.sin(lean) * params.depth * minSide,
  }

  const noise = Array.from({ length: count }, () => ({
    x: rng.float(-1, 1),
    y: rng.float(-1, 1),
    turn: rng.float(-1, 1),
  }))

  const items = place(params, count, radius, minSide, middle, pitched, noise)

  // Painter's order. Which end of the pile is nearest depends on how the
  // solids are laid out, so each arrangement says so rather than being sorted
  // by one rule that would be wrong half the time.
  items.sort((a, b) => a.order - b.order)

  const palette = params.palette.length ? params.palette : ['#ff5500']
  // Whichever side tone is darker stands in for the far face, on the rare
  // occasion a deep enough body drags it out from behind everything else.
  const far = luminance(params.left) <= luminance(params.right) ? params.left : params.right
  const stroke =
    params.outline > 0
      ? ` stroke="${params.background}" stroke-width="${n(params.outline)}" stroke-linejoin="round"`
      : ''

  const parts: string[] = []

  const drawn = items.map((item) => {
    // Face into place: sized, spun in its own plane, tipped away, then turned
    // and moved as a whole.
    const points = face.map((point) => {
      // Where the arrangement's rotation happens decides what the scene is.
      // Turned before the tip, a solid lies in the same plane as every other
      // one — a ring on the ground. Turned after, it stands up and faces you,
      // pivoting on the picture surface — a fan of blades. Neither is more
      // correct; they are different scenes, so the arrangement picks.
      const inPlane = item.inPlane ? item.turn : 0
      const spun = rotate(point, turned + inPlane)
      const flat: Vec2 = { x: spun.x * item.scale * radius, y: spun.y * pitched * item.scale * radius }
      const placed = item.inPlane ? flat : rotate(flat, item.turn)
      return { x: placed.x + item.center.x, y: placed.y + item.center.y }
    })
    return { item, points, ink: inkOf(points, body) }
  })

  // Measure what was laid out, then scale it to the frame. Both ends of every
  // solid count: a body dragged a long way is part of the composition.
  let low: Vec2 = { x: Infinity, y: Infinity }
  let high: Vec2 = { x: -Infinity, y: -Infinity }
  let ink = 0
  for (const entry of drawn) {
    ink += entry.ink
    for (const point of entry.points) {
      for (const corner of [point, { x: point.x + body.x, y: point.y + body.y }]) {
        low = { x: Math.min(low.x, corner.x), y: Math.min(low.y, corner.y) }
        high = { x: Math.max(high.x, corner.x), y: Math.max(high.y, corner.y) }
      }
    }
  }

  // Fitted on the area the solids actually cover, not on their bounding box.
  // The box is a bad stand-in the moment an arrangement runs diagonally: nine
  // slabs stepping across the frame fill a box nearly all of which is empty,
  // and fitting that box shrank them to a thin line of confetti. So `Size` is
  // how much of the frame gets painted, overlaps not discounted, and an
  // arrangement is free to overflow — which is usually the better crop anyway.
  const fitted = Math.sqrt((params.size * width * height) / Math.max(1e-6, ink))
  const anchor: Vec2 = { x: (low.x + high.x) / 2, y: (low.y + high.y) / 2 }
  const fit = (point: Vec2): Vec2 => ({
    x: middle.x + (point.x - anchor.x) * fitted,
    y: middle.y + (point.y - anchor.y) * fitted,
  })
  const reach: Vec2 = { x: body.x * fitted, y: body.y * fitted }

  for (const entry of drawn) {
    const item = entry.item
    const lit = palette[item.index % palette.length] as string
    const points = entry.points.map(fit)

    const centroid = points.reduce(
      (sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }),
      { x: 0, y: 0 },
    )

    if (reach.x !== 0 || reach.y !== 0) {
      parts.push(
        `<path d="${pathFrom(points.map((point) => ({ x: point.x + reach.x, y: point.y + reach.y })))}" fill="${far}"${stroke}/>`,
      )

      const total = points.length
      const edges = points.map((a, edge) => {
        const b = points[(edge + 1) % total] as Vec2

        // Outward normal, found by pushing away from the centroid rather than
        // by assuming a winding direction — the shapes are built by hand and
        // one of them will eventually be wound the other way.
        let normal: Vec2 = { x: -(b.y - a.y), y: b.x - a.x }
        const midpoint = { x: (a.x + b.x) / 2 - centroid.x, y: (a.y + b.y) / 2 - centroid.y }
        if (normal.x * midpoint.x + normal.y * midpoint.y < 0) {
          normal = { x: -normal.x, y: -normal.y }
        }
        return {
          // Only the edges the body is dragged away from sweep a visible face.
          visible: normal.x * reach.x + normal.y * reach.y > 0,
          rightward: normal.x >= 0,
        }
      })

      /** One polygon around everything a stretch of edges sweeps. */
      const sweep = (run: readonly number[]): string => {
        const front = run.map((edge) => points[edge] as Vec2)
        front.push(points[((run[run.length - 1] as number) + 1) % total] as Vec2)
        return pathFrom([
          ...front,
          ...[...front].reverse().map((point) => ({ x: point.x + reach.x, y: point.y + reach.y })),
        ])
      }

      for (const run of visibleRuns(edges)) {
        // A face per edge leaves a hairline seam everywhere two of them meet —
        // on a disc that is forty-seven seams down the side of a cylinder. The
        // whole stretch is swept as one polygon instead.
        //
        // The two side tones still have to divide it. Rather than butt them up
        // against each other, which puts the same seam back on the boundary,
        // the whole sweep is laid down in one tone and the stretches belonging
        // to the other are painted over it.
        const rightward = run.filter((edge) => (edges[edge] as { rightward: boolean }).rightward)
        const base = rightward.length === run.length ? params.right : params.left
        parts.push(`<path d="${sweep(run)}" fill="${base}"${stroke}/>`)

        if (base === params.left) {
          for (const patch of runsWithin(run, (edge) => (edges[edge] as { rightward: boolean }).rightward)) {
            parts.push(`<path d="${sweep(patch)}" fill="${params.right}"${stroke}/>`)
          }
        }
      }
    }

    parts.push(`<path d="${pathFrom(points)}" fill="${lit}"${stroke}/>`)
  }

  return {
    background: params.background,
    body: parts.join(''),
  }
}

/**
 * Roughly how much a solid paints: its face, plus the faces its edges sweep.
 * Overlap between solids is not discounted — this is a fitting heuristic, not
 * a coverage measurement, and it only has to be proportional.
 */
function inkOf(points: readonly Vec2[], body: Vec2): number {
  const total = points.length
  let area = 0
  let swept = 0
  const centroid = points.reduce(
    (sum, point) => ({ x: sum.x + point.x / total, y: sum.y + point.y / total }),
    { x: 0, y: 0 },
  )

  for (let edge = 0; edge < total; edge++) {
    const a = points[edge] as Vec2
    const b = points[(edge + 1) % total] as Vec2
    area += a.x * b.y - b.x * a.y

    let normal: Vec2 = { x: -(b.y - a.y), y: b.x - a.x }
    const midpoint = { x: (a.x + b.x) / 2 - centroid.x, y: (a.y + b.y) / 2 - centroid.y }
    if (normal.x * midpoint.x + normal.y * midpoint.y < 0) {
      normal = { x: -normal.x, y: -normal.y }
    }
    if (normal.x * body.x + normal.y * body.y > 0) {
      swept += Math.abs((b.x - a.x) * body.y - (b.y - a.y) * body.x)
    }
  }

  return Math.abs(area) / 2 + swept
}

/**
 * The stretches of consecutive edges that sweep a visible face, walking the
 * outline as the loop it is. A convex shape gives exactly one; a chevron folded
 * back on itself can give two.
 */
function visibleRuns(edges: readonly { visible: boolean }[]): number[][] {
  const total = edges.length
  const lit = edges.map((edge) => edge.visible)
  if (!lit.some(Boolean)) return []
  // Nothing hidden anywhere means the outline never breaks, so any edge will
  // do as the place to cut it open.
  if (lit.every(Boolean)) return [Array.from({ length: total }, (_, i) => i)]

  const anchor = lit.findIndex((on, i) => on && !lit[(i - 1 + total) % total])
  const runs: number[][] = []
  let current: number[] = []
  for (let step = 0; step < total; step++) {
    const edge = (anchor + step) % total
    if (lit[edge]) current.push(edge)
    else if (current.length) {
      runs.push(current)
      current = []
    }
  }
  if (current.length) runs.push(current)
  return runs
}

/** The same, within an already-contiguous run: no wrapping to worry about. */
function runsWithin(run: readonly number[], match: (edge: number) => boolean): number[][] {
  const runs: number[][] = []
  let current: number[] = []
  for (const edge of run) {
    if (match(edge)) current.push(edge)
    else if (current.length) {
      runs.push(current)
      current = []
    }
  }
  if (current.length) runs.push(current)
  return runs
}

interface Placed {
  center: Vec2
  /** Rotation of the whole solid on screen, after it has been tipped. */
  turn: number
  scale: number
  /** Whether `turn` happens before the face is tipped. See the note at its use. */
  inPlane: boolean
  /** Index in the palette — kept through the sort so colors stay put. */
  index: number
  /** Low paints first. */
  order: number
}

/**
 * Where each solid sits. Every arrangement also says which end of it is
 * nearest, because that genuinely differs: a stack is lit from above so the
 * top one covers the rest, while a row just overlaps one way.
 */
function place(
  params: Params,
  count: number,
  radius: number,
  minSide: number,
  middle: Vec2,
  pitched: number,
  noise: readonly { x: number; y: number; turn: number }[],
): Placed[] {
  const out: Placed[] = []
  const centred = (i: number) => i - (count - 1) / 2
  const span = count === 1 ? 0 : count - 1
  const step = radius * 2 * (0.25 + params.gap)
  const scatter = params.scatter * minSide * 0.25

  for (let i = 0; i < count; i++) {
    const grain = noise[i] as { x: number; y: number; turn: number }
    const scale = 1 + params.taper * (span === 0 ? 0 : (centred(i) / (span / 2)))
    const rise = params.drop * minSide * 0.25 * centred(i)

    let center: Vec2 = { x: middle.x, y: middle.y }
    let turn = 0
    let order = i
    let inPlane = false

    if (params.arrangement === 'stack') {
      center = { x: middle.x, y: middle.y + centred(i) * step }
      // Seen from above, the top solid is the near one.
      order = -center.y
    } else if (params.arrangement === 'row') {
      center = { x: middle.x + centred(i) * step, y: middle.y }
      order = center.x
    } else if (params.arrangement === 'fan') {
      // Blades hinged below the composition, each pointing away from the
      // hinge. The hinge is placed a blade's reach below the middle rather
      // than at a fixed depth, so the fan is centred in the frame whatever
      // size the blades are — pinning it put small fans down in the corner
      // with the frame empty above them.
      const opening = params.spread * Math.PI * 0.9
      const at = span === 0 ? 0 : -opening / 2 + opening * (i / span)
      const reach = radius * (1.15 + Math.max(0, params.gap))
      const hinge: Vec2 = { x: middle.x, y: middle.y + reach }
      center = { x: hinge.x + Math.sin(at) * reach, y: hinge.y - Math.cos(at) * reach }
      turn = at
      order = at
    } else if (params.arrangement === 'ring') {
      // The ring lies in the same plane the faces do, so it is squashed by the
      // same amount they are: a full circle when nothing is tipped, an ellipse
      // as the plane tips away, a line when it is nearly edge-on.
      const at = (i / count) * TAU
      const reach = minSide * (0.12 + params.spread * 0.3)
      center = { x: middle.x + Math.cos(at) * reach, y: middle.y + Math.sin(at) * reach * pitched }
      turn = at + Math.PI / 2
      inPlane = true
      // Round the back of the ring first.
      order = center.y
    } else if (params.arrangement === 'grid') {
      const columns = Math.ceil(Math.sqrt(count))
      const rows = Math.ceil(count / columns)
      const column = i % columns
      const row = Math.floor(i / columns)
      center = {
        x: middle.x + (column - (columns - 1) / 2) * step,
        y: middle.y + (row - (rows - 1) / 2) * step,
      }
      order = row * 1000 + column
    } else {
      // Cascade: stepped down and across, each one in front of the last.
      const drift = step * 0.8
      center = {
        x: middle.x + centred(i) * drift,
        y: middle.y + centred(i) * drift * (0.3 + params.spread),
      }
      order = i
    }

    out.push({
      center: {
        x: center.x + grain.x * scatter,
        y: center.y + grain.y * scatter + rise,
      },
      turn: turn + grain.turn * params.scatter * Math.PI * 0.35,
      scale: Math.max(0.02, scale),
      inPlane,
      index: i,
      order,
    })
  }

  return out
}

/** The face, as a polygon of bounding radius 1 before it is sized. */
function facePolygon(shape: Params['shape'], ratio: number): Vec2[] {
  // `ratio` stretches the face horizontally; dividing through by the longer
  // axis keeps `size` meaning the same thing whatever the proportion.
  const wide = Math.max(1, ratio)
  const w = ratio / wide
  const h = 1 / wide

  if (shape === 'rect') {
    return [
      { x: -w, y: -h },
      { x: w, y: -h },
      { x: w, y: h },
      { x: -w, y: h },
    ]
  }

  if (shape === 'triangle') {
    return [
      { x: 0, y: -h },
      { x: w, y: h },
      { x: -w, y: h },
    ]
  }

  if (shape === 'chevron') {
    // The one shape here that is not convex. Its edges still sweep correctly —
    // the normals are found per edge — but the faces can overlap each other,
    // which reads as a fold rather than as an error.
    const notch = h * 0.45
    return [
      { x: -w, y: -h },
      { x: 0, y: -h + notch },
      { x: w, y: -h },
      { x: w, y: h - notch },
      { x: 0, y: h },
      { x: -w, y: h - notch },
    ]
  }

  const sides = shape === 'hexagon' ? 6 : 48
  return Array.from({ length: sides }, (_, i) => {
    const at = (i / sides) * TAU - Math.PI / 2
    return { x: Math.cos(at) * w, y: Math.sin(at) * h }
  })
}
