import {
  cubicBezier,
  clamp,
  grid,
  loopSin,
  n,
  pathFrom,
  polygon,
  samplePalette,
  type Frame,
  type SvgFrame,
} from '@rareshape/core'
import type { Params } from './tool'

/**
 * Pure. No DOM, no clock, no Math.random — everything random comes from
 * `frame.rng`, which is seeded from the `seed` param.
 */
export function render(frame: Frame<Params>): SvgFrame {
  const { params, t, width, height, rng } = frame
  const pad = params.padding * Math.min(width, height)
  const box = { x: pad, y: pad, width: width - pad * 2, height: height - pad * 2 }
  const cells = grid(params.columns, params.rows, box)
  const ease = cubicBezier(...params.falloff)
  const [minScale, maxScale] = params.scale
  const diagonal = Math.hypot(box.width, box.height) || 1
  const focus = {
    x: box.x + params.focus.x * box.width,
    y: box.y + params.focus.y * box.height,
  }

  const parts: string[] = []

  cells.forEach((cell, index) => {
    const cx = cell.x + cell.width / 2
    const cy = cell.y + cell.height / 2
    const unit = Math.min(cell.width, cell.height)

    // Distance from the focus point, eased through the curve param.
    const d = clamp(Math.hypot(cx - focus.x, cy - focus.y) / (diagonal / 2), 0, 1)
    const falloff = ease(d)

    // Per-cell phase, so the field breathes rather than pulsing as one block.
    const phase = rng()
    const wobble = params.amount * loopSin(t, phase - falloff * 0.5)

    const scale = clamp(minScale + (maxScale - minScale) * (1 - falloff) + wobble * 0.2, 0, 1.4)
    const size = (unit * scale) / 2
    if (size <= 0.01) return

    const color = params.palette.length
      ? samplePalette(params.palette, falloff + wobble * 0.15)
      : params.tint
    const angle = params.rotation + wobble * 90

    const paint = params.stroke
      ? `fill="none" stroke="${color}" stroke-width="${n(params.weight)}"`
      : `fill="${color}"`

    const transform =
      angle % 360 === 0 ? '' : ` transform="rotate(${n(angle)} ${n(cx)} ${n(cy)})"`

    parts.push(shapeMarkup(params.shape, cx, cy, size, paint, transform, index))
  })

  if (params.caption.trim()) {
    const fontSize = Math.max(9, Math.min(width, height) * 0.028)
    parts.push(
      `<text x="${n(pad)}" y="${n(height - pad + fontSize * 0.9)}" fill="${params.tint}" ` +
        `font-family="ui-monospace, monospace" font-size="${n(fontSize)}" ` +
        `letter-spacing="0.08em">${escapeText(params.caption)}</text>`,
    )
  }

  // A defs entry that changes with `t`, on purpose. No harness tool used defs
  // before, so nothing exercised what the exporters do with them — and the
  // animated SVG, which stacks every frame into one document, was giving all
  // of them the same ids and clipping the lot to frame 0.
  const breathe = Math.min(box.width, box.height) * 0.04 * (0.5 + 0.5 * loopSin(t, 0.25))
  const defs =
    `<clipPath id="hs-frame"><rect x="${n(box.x - breathe)}" y="${n(box.y - breathe)}" ` +
    `width="${n(box.width + breathe * 2)}" height="${n(box.height + breathe * 2)}"/></clipPath>`

  return {
    background: params.background,
    defs,
    body: `<g clip-path="url(#hs-frame)">${parts.join('')}</g>`,
  }
}

function shapeMarkup(
  shape: Params['shape'],
  cx: number,
  cy: number,
  size: number,
  paint: string,
  transform: string,
  index: number,
): string {
  switch (shape) {
    case 'circle':
      return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(size)}" ${paint}${transform}/>`
    case 'square':
      return `<rect x="${n(cx - size)}" y="${n(cy - size)}" width="${n(size * 2)}" height="${n(
        size * 2,
      )}" ${paint}${transform}/>`
    case 'triangle':
      return `<path d="${pathFrom(polygon(3, size, { x: cx, y: cy }))}" ${paint}${transform}/>`
    case 'cross': {
      const arm = size
      const d = `M${n(cx - arm)} ${n(cy)}H${n(cx + arm)}M${n(cx)} ${n(cy - arm)}V${n(cy + arm)}`
      // A cross is strokes by definition, whatever the fill setting says.
      const strokePaint = paint.includes('stroke=')
        ? paint
        : `fill="none" stroke="${paint.replace(/^fill="|"$/g, '')}" stroke-width="${n(size * 0.35)}"`
      return `<path data-i="${index}" d="${d}" ${strokePaint}${transform}/>`
    }
  }
}

function escapeText(value: string): string {
  return value.replace(/[<>&]/g, (c) => (c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;'))
}
