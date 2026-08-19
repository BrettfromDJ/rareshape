import type { ExportRequest, ExportResult } from './types'

/**
 * Standalone HTML: the tool's render function, its param schema, the vanilla
 * shell and the current params in one file that opens from the filesystem.
 *
 * The bundle is built at compile time by scripts/build-eject.ts and served from
 * /eject/<slug>.js — it is inlined here rather than fetched at runtime, so the
 * saved file has no network dependency (WebGL tools excepted: Three.js is
 * reached through an import map, as agreed, rather than inlined).
 */
export const THREE_CDN = 'https://esm.sh/three@0.185.1'

export interface HtmlExportOptions {
  /** Where to fetch the prebuilt bundle from. Defaults to the current origin. */
  base?: string
  /** Written into the file's header as a link home. */
  source?: string
}

export async function exportHtml(request: ExportRequest): Promise<ExportResult> {
  const { tool, params } = request
  const base = request.htmlBase ?? (typeof window !== 'undefined' ? window.location.origin : '')
  const url = `${base}/eject/${tool.meta.slug}.js`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `Missing standalone bundle for ${tool.meta.slug}. Run \`pnpm eject\` and rebuild.`,
    )
  }
  const bundle = await response.text()
  request.onProgress?.(0.7)

  const html = buildHtmlDocument({
    title: tool.meta.name,
    tagline: tool.meta.tagline,
    webgl: tool.meta.engine === 'webgl',
    params: params as Record<string, unknown>,
    bundle,
    source: request.htmlSource,
    imports: request.htmlImports,
    // The shape on screen when Export was pressed, so the saved file opens
    // looking like the thing that was exported.
    aspect: request.htmlAspect,
  })

  request.onProgress?.(1)
  const blob = new Blob([html], { type: 'text/html' })
  return {
    blob,
    filename: `${tool.meta.slug.replace(/^_+/, '')}.html`,
    size: blob.size,
  }
}

export function buildHtmlDocument(options: {
  title: string
  tagline: string
  webgl: boolean
  params: Record<string, unknown>
  bundle: string
  source?: string
  /** Overrides the import map, for self-hosting Three.js instead of the CDN. */
  imports?: Record<string, string>
  aspect?: string
}): string {
  const { title, tagline, webgl, params, bundle, source, imports, aspect } = options

  // A `</script>` anywhere in the bundle or the params would end the block early.
  const safe = (value: string) => value.replace(/<\/script/gi, '<\\/script')

  const map = imports ?? { three: THREE_CDN, 'three/': `${THREE_CDN}/` }
  const importMap = webgl
    ? `<script type="importmap">${JSON.stringify({ imports: map })}</script>\n`
    : ''

  return `<!doctype html>
<html lang="en"${source ? ` data-source="${escapeAttribute(source)}"` : ''}${
    aspect ? ` data-aspect="${escapeAttribute(aspect)}"` : ''
  }>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeAttribute(tagline)}">
<!--
  ${escapeHtml(title)} — a standalone build from Rareshape.
  Everything below is the same param schema and render function the site runs.
  Open it, read it, change it. MIT licensed.
-->
${importMap}<script type="application/json" id="rs-params">${safe(JSON.stringify(params, null, 2))}</script>
</head>
<body>
<script type="module">
${safe(bundle)}
</script>
</body>
</html>
`
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'))

const escapeAttribute = (value: string): string => escapeHtml(value).replace(/"/g, '&quot;')
