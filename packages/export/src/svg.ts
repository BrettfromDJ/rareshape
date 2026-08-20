import { makeRng } from '@rareshape/core'
import { isSvg } from '@rareshape/schema'
import { assertLive, filenameFor, type ExportRequest, type ExportResult } from './types'
import { svgMarkup } from './render-frame'
import { optimizeSvg } from './svgo'

/** Static SVG. Vector tools only — the format is hidden for the others. */
export async function exportSvg(request: ExportRequest): Promise<ExportResult> {
  const { tool, module: renderModule, params, width, height, seed, signal } = request
  assertLive(signal)
  if (!isSvg(renderModule)) throw new Error(`${tool.meta.name} does not draw vectors`)

  const out = renderModule.render({
    params,
    t: request.t ?? 0,
    width,
    height,
    dpr: 1,
    seed,
    rng: makeRng(seed),
  })

  const markup = svgMarkup(
    out.body,
    out.defs,
    width,
    height,
    request.background === null ? null : (request.background ?? out.background ?? null),
  )
  request.onProgress?.(0.6)

  const optimised = await optimizeSvg(markup)
  request.onProgress?.(1)

  const blob = new Blob([optimised], { type: 'image/svg+xml' })
  return {
    blob,
    filename: filenameFor(tool.meta.slug, 'svg', width, height, 1),
    size: blob.size,
  }
}

/** Ceiling on frames regardless of how cheap they are. */
const MAX_FRAMES = 120
/** Floor: below this it stops reading as motion at all. */
const MIN_FRAMES = 24
/** Rough character budget for the whole document. */
const BUDGET = 2_000_000

/**
 * Every frame of a tool renders its defs under the same ids — a clip path is
 * `#c0` in frame 0 and `#c0` again in frame 119. Stacked into one document
 * that is 120 elements sharing an id, and a reference resolves to the first
 * one: every frame ends up clipped to frame 0's geometry, which reads as the
 * whole thing flashing at you.
 *
 * Ids are therefore made per-frame. Only ids declared in this frame's defs are
 * rewritten, and only where they appear as a whole attribute or a whole
 * reference — `#c1` never matches inside `#c10`.
 */
function scopeIds(frame: number, defs: string, body: string): { defs: string; body: string } {
  const ids = [...defs.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1] as string)
  let scopedDefs = defs
  let scopedBody = body

  for (const id of ids) {
    const scoped = `${id}-f${frame}`
    for (const [from, to] of [
      [`id="${id}"`, `id="${scoped}"`],
      [`url(#${id})`, `url(#${scoped})`],
      [`href="#${id}"`, `href="#${scoped}"`],
    ]) {
      scopedDefs = scopedDefs.split(from as string).join(to as string)
      scopedBody = scopedBody.split(from as string).join(to as string)
    }
  }

  return { defs: scopedDefs, body: scopedBody }
}

/**
 * Animated SVG. Frames are sampled and driven by CSS keyframes in an embedded
 * <style> block, with no script and no external references — which is what
 * lets the file animate inside an <img> tag.
 */
export async function exportAnimatedSvg(request: ExportRequest): Promise<ExportResult> {
  const { tool, module: renderModule, params, width, height, seed, signal } = request
  if (!isSvg(renderModule)) throw new Error(`${tool.meta.name} does not draw vectors`)

  const duration = request.duration ?? tool.meta.duration
  const fps = Math.min(request.fps ?? tool.meta.fps, 25)
  const wanted = Math.max(2, Math.min(Math.round(duration * fps), MAX_FRAMES))

  // An animated SVG carries every frame's geometry, and every frame sits in
  // the document at once — the browser parses and composites all of them, not
  // just the visible one. A tool that draws a few dozen shapes affords the
  // full frame count; one drawing a dithered grid produces megabytes of nodes
  // that a browser cannot animate smoothly. So the cost is measured on a real
  // frame rather than guessed at, and frames are dropped to fit. The loop gets
  // choppier; it does not become a file that stutters or will not open.
  const probe = renderModule.render({
    params,
    t: 0,
    width,
    height,
    dpr: 1,
    seed,
    rng: makeRng(seed),
  })
  const perFrame = Math.max(1, probe.body.length + (probe.defs?.length ?? 0))
  const frameCount = Math.min(wanted, Math.max(MIN_FRAMES, Math.floor(BUDGET / perFrame)))

  const groups: string[] = []
  const rules: string[] = []
  const defs: string[] = []
  let ownGround: string | undefined

  for (let i = 0; i < frameCount; i++) {
    assertLive(signal)
    const out = renderModule.render({
      params,
      t: i / frameCount,
      width,
      height,
      dpr: 1,
      seed,
      rng: makeRng(seed),
    })
    // The paper is the tool's, not this exporter's. Hardcoding a ground here
    // put a near-black rectangle behind artwork drawn for cream paper.
    if (i === 0) ownGround = out.background
    const frame = scopeIds(i, out.defs ?? '', out.body)
    if (frame.defs) defs.push(frame.defs)

    const from = (i / frameCount) * 100
    const to = ((i + 1) / frameCount) * 100
    groups.push(`<g class="f f${i}">${frame.body}</g>`)
    rules.push(
      `@keyframes f${i}{0%{opacity:0}${trim(from)}%{opacity:1}${trim(to)}%{opacity:0}100%{opacity:0}}` +
        `.f${i}{animation-name:f${i}}`,
    )
    request.onProgress?.((i + 1) / frameCount)
  }

  // Same contract as every other format: undefined is the tool's own ground,
  // null is transparent, a color is that color.
  const ground =
    request.background === null ? null : (request.background ?? ownGround ?? null)
  const background = ground
    ? `<rect width="${width}" height="${height}" fill="${ground}"/>`
    : ''

  const style =
    `<style>.f{opacity:0;animation-duration:${duration}s;animation-iteration-count:infinite;` +
    `animation-timing-function:step-end}${rules.join('')}</style>`

  const markup =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">${style}` +
    background +
    (defs.length ? `<defs>${defs.join('')}</defs>` : '') +
    groups.join('') +
    `</svg>`

  const blob = new Blob([markup], { type: 'image/svg+xml' })
  return {
    blob,
    filename: `${tool.meta.slug.replace(/^_+/, '')}-${Math.round(width)}x${Math.round(height)}-loop.svg`,
    size: blob.size,
  }
}

const trim = (v: number) => Number(v.toFixed(4))
