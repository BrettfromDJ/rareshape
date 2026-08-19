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
    request.background === null ? null : (request.background ?? out.background),
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

/**
 * Animated SVG. Frames are sampled and driven by CSS keyframes in an embedded
 * <style> block, with no script and no external references — which is what
 * lets the file animate inside an <img> tag.
 */
export async function exportAnimatedSvg(request: ExportRequest): Promise<ExportResult> {
  const { tool, module: renderModule, params, width, height, seed, signal } = request
  if (!isSvg(renderModule)) throw new Error(`${tool.meta.name} does not draw vectors`)

  const duration = request.duration ?? tool.meta.duration
  // Frame count is capped: an animated SVG carries every frame's geometry, so
  // this is the difference between a 200KB file and a 6MB one.
  const fps = Math.min(request.fps ?? tool.meta.fps, 25)
  const frameCount = Math.max(2, Math.min(Math.round(duration * fps), 120))

  const groups: string[] = []
  const rules: string[] = []
  const defs = new Set<string>()

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
    if (out.defs) defs.add(out.defs)

    const from = (i / frameCount) * 100
    const to = ((i + 1) / frameCount) * 100
    groups.push(`<g class="f f${i}">${out.body}</g>`)
    rules.push(
      `@keyframes f${i}{0%{opacity:0}${trim(from)}%{opacity:1}${trim(to)}%{opacity:0}100%{opacity:0}}` +
        `.f${i}{animation-name:f${i}}`,
    )
    request.onProgress?.((i + 1) / frameCount)
  }

  const background =
    request.background === null
      ? ''
      : `<rect width="${width}" height="${height}" fill="${request.background ?? '#0a0a0a'}"/>`

  const style =
    `<style>.f{opacity:0;animation-duration:${duration}s;animation-iteration-count:infinite;` +
    `animation-timing-function:step-end}${rules.join('')}</style>`

  const markup =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">${style}` +
    background +
    (defs.size ? `<defs>${[...defs].join('')}</defs>` : '') +
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
