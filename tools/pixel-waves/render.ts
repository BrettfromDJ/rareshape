import {
  TAU,
  clamp,
  makeNoise,
  n,
  type Frame,
  type SvgFrame,
} from '@rareshape/core'
import type { Params } from './tool'

/**
 * Every band is a smooth wave sampled once per column, then snapped to whole
 * grid cells — the quantising is what makes it read as plotted data rather than
 * as a drawn curve.
 *
 * Pure: no DOM, no clock, no Math.random. Motion comes from `frame.t` and all
 * of it is periodic over one loop, so t=1 lands exactly on t=0.
 */
export function render(frame: Frame<Params>): SvgFrame {
  const { params, t, width, height, rng } = frame
  const noise = makeNoise(rng)

  const columns = Math.max(1, params.columns)
  const cell = width / columns
  const rows = Math.max(1, Math.round(height / cell))
  const rowHeight = height / rows

  const parts: string[] = []
  let defs = ''

  /* --- graph paper -------------------------------------------------------- */

  if (params.grid) {
    // One <pattern> rather than thousands of lines: a 300-column grid stays a
    // handful of nodes in the exported SVG. It is painted last, over the bands.
    defs +=
      `<pattern id="pw-grid" width="${n(cell)}" height="${n(rowHeight)}" patternUnits="userSpaceOnUse">` +
      `<path d="M${n(cell)} 0H0V${n(rowHeight)}" fill="none" ` +
      `stroke="${params.gridColor}" stroke-width="${n(params.gridWeight)}"/></pattern>`
  }

  /* --- bands -------------------------------------------------------------- */

  const palette = params.palette.length ? params.palette : ['#151515']
  const bands = Math.max(1, params.layers)
  const step = Math.max(1, params.step)

  // In edge mode each band is a mass anchored to the nearest edge, so the
  // deepest one has to be painted first — otherwise the shallower bands are
  // buried and only the last of each group survives. Ribbons and stacks do not
  // overlap, so they keep their natural order.
  const order = Array.from({ length: bands }, (_, i) => i)
  if (params.fill === 'edges') {
    const seatOf = (i: number) => (bands === 1 ? 0.5 : i / (bands - 1))
    order.sort((a, b) => {
      const top = (i: number) => seatOf(i) < 0.5 || bands === 1
      if (top(a) !== top(b)) return top(a) ? -1 : 1
      // Within a group, the band reaching furthest from its edge goes down first.
      return top(a) ? seatOf(b) - seatOf(a) : seatOf(a) - seatOf(b)
    })
  }

  for (const band of order) {
    // Each band gets its own slice of the canvas, pushed apart by `spread`.
    const seat = bands === 1 ? 0.5 : band / (bands - 1)
    const centre = 0.5 + (seat - 0.5) * params.spread
    const phase = band * 0.37
    const colour = palette[band % palette.length] as string

    // Both edges of the band are sampled per column, then emitted as ONE
    // staircase polygon rather than a rect per column. Abutting rects leave a
    // hairline seam where their antialiased edges meet, and a single path has
    // no internal edges to seam. It is also far fewer nodes in the export.
    const tops: number[] = []
    const bottoms: number[] = []

    for (let column = 0; column < columns; column++) {
      const u = columns === 1 ? 0.5 : column / (columns - 1)

      // Travelling sine: adding whole turns of t keeps the loop seamless.
      const wave = Math.sin((u * params.frequency + t * params.drift + phase) * TAU)
      // Noise walked around a circle, which also returns to its start at t=1.
      const grain = noise.noise3(
        u * params.frequency * 1.7 + band * 10,
        Math.cos(t * TAU) * 0.6,
        Math.sin(t * TAU) * 0.6 + band * 3.1,
      )

      const offset = (wave * (1 - params.roughness) + grain * params.roughness) * params.amplitude
      // Bands thin out towards the left and right edges when tapered.
      const edge = 1 - params.taper * Math.pow(Math.abs(u - 0.5) * 2, 2)
      const half = (params.thickness * Math.max(0, edge)) / 2

      // Where the band sits depends on the fill mode: a floating ribbon, a
      // mass anchored to the nearest edge, or one layer of a stack.
      let top: number
      let bottom: number

      if (params.fill === 'ribbons') {
        top = (centre + offset - half) * height
        bottom = (centre + offset + half) * height
      } else if (params.fill === 'stacked') {
        const floor = 1 - (band / bands) * params.spread
        top = (floor + offset - params.thickness) * height
        bottom = (floor + offset) * height
      } else {
        // Edges: the top half hangs from the top, the bottom half rises from
        // the bottom, which is how plotted data usually reads. The margin keeps
        // paper showing at the outer edge instead of bleeding off it.
        const fromTop = seat < 0.5 || bands === 1
        const margin = params.inset * height
        top = fromTop ? margin : (centre + offset - half) * height
        bottom = fromTop ? (centre + offset + half) * height : height - margin
      }

      // Snapping to whole cells is the whole point; `step` snaps to blocks of
      // them, which is what gives the coarse, plotted-on-paper staircase.
      const snap = (value: number) => clamp(Math.round(value / rowHeight / step) * step, 0, rows)

      let topRow = snap(top)
      let bottomRow = Math.max(topRow, snap(bottom))

      if (params.fill === 'edges') {
        // The edge a band is anchored to is the canvas edge, not a grid line:
        // snapping it would round to the nearest multiple of `step`, which
        // lands short of the bottom whenever the row count is not a multiple
        // of it — a sliver of bare paper along the edge.
        //
        // The inner edge is still snapped, and a big amplitude can push it off
        // the canvas entirely, so each band keeps a single row against its own
        // edge. One row, not one step: at a coarse step that minimum would be
        // deep enough to bury the bands behind it and flatten the composition.
        const fromTop = seat < 0.5 || bands === 1
        if (fromTop) {
          topRow = 0
          bottomRow = Math.max(bottomRow, 1)
        } else {
          bottomRow = rows
          topRow = Math.min(topRow, rows - 1)
        }
      }

      tops.push(topRow)
      bottoms.push(bottomRow)
    }

    const path = staircase(tops, bottoms, cell, rowHeight, width)
    if (path) parts.push(`<path d="${path}" fill="${colour}"/>`)
  }

  // The grid is the last thing painted, over everything else.
  parts.push(gridOverlay(params, width, height))

  return {
    background: params.background,
    defs: defs || undefined,
    // Isolated so the blend mixes with the artwork, never with whatever sits
    // behind the SVG on the page.
    body: `<g style="isolation:isolate">${parts.join('')}</g>`,
  }
}

/** The graph paper, painted over the bands and tinted by what is underneath. */
function gridOverlay(params: Params, width: number, height: number): string {
  if (!params.grid) return ''
  const blend =
    params.gridBlend === 'normal' ? '' : ` style="mix-blend-mode:${params.gridBlend}"`
  return `<rect width="${n(width)}" height="${n(height)}" fill="url(#pw-grid)"${blend}/>`
}

/**
 * One rectilinear polygon around a band: along the top edge left to right,
 * down the right side, back along the bottom edge. Steps only appear where the
 * height actually changes, so a flat stretch costs two numbers, not forty.
 */
function staircase(
  tops: readonly number[],
  bottoms: readonly number[],
  cell: number,
  rowHeight: number,
  width: number,
): string {
  const columns = tops.length
  if (columns === 0) return ''
  // Nothing to draw if the band has no height anywhere.
  if (tops.every((top, i) => (bottoms[i] as number) <= top)) return ''

  const d: string[] = [`M0 ${n((tops[0] as number) * rowHeight)}`]

  for (let column = 1; column < columns; column++) {
    if (tops[column] !== tops[column - 1]) {
      d.push(`H${n(column * cell)}`, `V${n((tops[column] as number) * rowHeight)}`)
    }
  }
  d.push(`H${n(width)}`, `V${n((bottoms[columns - 1] as number) * rowHeight)}`)

  for (let column = columns - 1; column > 0; column--) {
    if (bottoms[column - 1] !== bottoms[column]) {
      d.push(`H${n(column * cell)}`, `V${n((bottoms[column - 1] as number) * rowHeight)}`)
    }
  }
  d.push('H0', 'Z')

  return d.join('')
}
