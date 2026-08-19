import { makeNoise, samplePalette, TAU, type Frame } from '@rareshape/core'
import type { Params } from './tool'

/**
 * Stacked noise contours. Every moving term is a function of `t` over one full
 * cycle, so `t=1` lands exactly on `t=0` and the loop has no seam.
 */
export function render(ctx: CanvasRenderingContext2D, frame: Frame<Params>): void {
  const { params, t, width, height, rng } = frame
  const noise = makeNoise(rng)

  ctx.fillStyle = params.background
  ctx.fillRect(0, 0, width, height)

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = params.weight

  const margin = height * 0.08

  for (let line = 0; line < params.lines; line++) {
    const v = params.lines === 1 ? 0.5 : line / (params.lines - 1)
    const y = margin + v * (height - margin * 2)

    ctx.beginPath()
    for (let step = 0; step <= params.steps; step++) {
      const u = step / params.steps
      // Walking a circle through the noise field is what makes it loop.
      const nx = Math.cos(t * TAU) * params.drift
      const ny = Math.sin(t * TAU) * params.drift
      const wave =
        noise.noise3(u * params.frequency + nx, v * params.frequency + ny, v * 2) *
        params.amplitude *
        height

      const x = u * width
      if (step === 0) ctx.moveTo(x, y + wave)
      else ctx.lineTo(x, y + wave)
    }

    const edge = params.fade ? Math.sin(v * Math.PI) : 1
    // A full cycle over t, so the colour walk lands back where it started.
    ctx.strokeStyle = samplePalette(params.palette, v + t)
    ctx.globalAlpha = 0.25 + 0.75 * edge
    ctx.stroke()
  }

  ctx.globalAlpha = 1
}
