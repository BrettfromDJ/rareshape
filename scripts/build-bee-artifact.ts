/**
 * Bundles the spelling bee into one HTML file with React, the game and its
 * Tailwind classes inline, for hosting as a single page (a claude.ai
 * artifact, a USB stick, an email attachment). Fonts come from Google Fonts.
 *
 *   pnpm bee:artifact [out.html]
 */
import { build } from 'esbuild'
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const BEE = join(ROOT, 'app', 'spelling-bee')
const OUT = process.argv[2] ?? join(ROOT, 'spelling-bee.html')
const require = createRequire(join(ROOT, 'node_modules', '@tailwindcss', 'postcss', 'package.json'))

async function css(): Promise<string> {
  // Both come from Tailwind's own dependency tree, resolved from its package.
  type Processor = (plugins: unknown[]) => { process(css: string, options: { from: string }): Promise<{ css: string }> }
  const postcss = require('postcss') as Processor
  const tailwind = require('@tailwindcss/postcss') as () => unknown
  const input = `@import "tailwindcss" source(none);\n@source "${BEE}";\n`
  const result = await postcss([tailwind()]).process(input, { from: join(BEE, 'artifact-entry.css') })
  return result.css
}

async function js(): Promise<string> {
  const result = await build({
    entryPoints: [join(BEE, '_standalone', 'main.tsx')],
    bundle: true,
    minify: true,
    format: 'iife',
    jsx: 'automatic',
    target: 'es2020',
    absWorkingDir: ROOT,
    nodePaths: [join(ROOT, 'node_modules')],
    define: { 'process.env.NODE_ENV': '"production"' },
    write: false,
    logLevel: 'error',
    legalComments: 'none',
  })
  return result.outputFiles[0]!.text
}

async function main() {
  const [tailwind, script] = await Promise.all([css(), js()])
  const bee = readFileSync(join(BEE, 'bee.css'), 'utf8')
  const page = `<title>Williams Land Spelling Bee</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Geist:wght@400;500;600;700&family=Geist+Mono&display=swap">
<style>
${tailwind}
/* The bee's own system, unchanged from the site. */
${bee}
/* A single hosted page: one deliberate dark game-show world, painted explicitly. */
:root {
  --font-bee-display: 'Bebas Neue';
  --font-sans: 'Geist', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'Geist Mono', ui-monospace, 'SF Mono', monospace;
  color-scheme: dark;
}
html, body { margin: 0; background: #170f2f; color: #fff5dc; }
body { font-family: var(--font-sans); }
#root { min-height: 100dvh; }
.bee-noscript { padding: 2rem; font-family: var(--font-sans); }
</style>
<div id="root"><noscript class="bee-noscript">The spelling bee needs JavaScript turned on.</noscript></div>
<script>
${script}
</script>
`
  writeFileSync(OUT, page)
  console.log(`wrote ${OUT} — ${(Buffer.byteLength(page) / 1024).toFixed(0)} KB (css ${(tailwind.length / 1024).toFixed(0)} KB, js ${(script.length / 1024).toFixed(0)} KB)`)
}

main().catch((cause) => {
  console.error(cause)
  process.exit(1)
})
