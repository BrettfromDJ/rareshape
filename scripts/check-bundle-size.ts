/**
 * Bundle budget for the index (BUILD_BRIEF phase 5).
 *
 * Two numbers, because only one of them is ours:
 *   • framework baseline — what any page in this Next/React version costs,
 *     measured from /info, which is a heading and a clock
 *   • app delta — what the index itself adds: the grid, filters, ⌘K
 *
 * The brief's 120KB gzipped target is below the framework baseline in Next 16
 * with React 19 (~172KB gzipped for an empty page), so the enforced budget is
 * on the delta, with the total reported and guarded against regression. If the
 * 120KB figure has to hold literally, the index has to leave the framework
 * behind — see README, "Bundle budget".
 */
import { gzipSync } from 'node:zlib'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = resolve(import.meta.dirname, '..')
const OUT = join(ROOT, 'out')

/** What the index may add on top of the framework baseline. */
export const APP_BUDGET = 32 * 1024
/** Regression guard on the whole page. */
export const TOTAL_BUDGET = 200 * 1024
/** The figure named in the brief, reported for reference. */
export const BRIEF_BUDGET = 120 * 1024

export interface PageSize {
  page: string
  files: Array<{ path: string; gzip: number }>
  totalGzip: number
  threeChunks: string[]
}

function measure(page: string, htmlPath: string): PageSize {
  const file = join(OUT, htmlPath)
  if (!existsSync(file)) throw new Error(`No build found at ${htmlPath}. Run \`pnpm build\`.`)
  const html = readFileSync(file, 'utf8')

  const paths = [
    ...new Set(
      [...html.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)].map((match) => match[1] as string),
    ),
  ]
  const files: PageSize['files'] = []
  const threeChunks: string[] = []

  for (const path of paths) {
    const chunk = join(OUT, path.replace(/^\//, ''))
    if (!existsSync(chunk)) continue
    const source = readFileSync(chunk)
    files.push({ path, gzip: gzipSync(source).length })
    if (/WebGLRenderer|InstancedMesh|THREE\.REVISION/.test(source.toString('utf8'))) {
      threeChunks.push(path)
    }
  }

  return {
    page,
    files,
    totalGzip: files.reduce((sum, entry) => sum + entry.gzip, 0),
    threeChunks,
  }
}

export function checkBundleSize(): { ok: boolean; index: PageSize; baseline: PageSize } {
  const index = measure('/', 'index.html')
  const baseline = measure('/info', 'info.html')
  const delta = index.totalGzip - baseline.totalGzip
  const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`

  console.log(`framework baseline (/info): ${kb(baseline.totalGzip)} gzipped`)
  console.log(`index total:                ${kb(index.totalGzip)} gzipped (guard ${kb(TOTAL_BUDGET)})`)
  console.log(`index app code:             ${kb(delta)} gzipped (budget ${kb(APP_BUDGET)})`)
  console.log(`brief's figure:             ${kb(BRIEF_BUDGET)} — see README, "Bundle budget"`)

  const problems: string[] = []
  if (delta > APP_BUDGET) problems.push(`index app code is ${kb(delta)}, over ${kb(APP_BUDGET)}`)
  if (index.totalGzip > TOTAL_BUDGET) problems.push(`index total is ${kb(index.totalGzip)}`)
  if (index.threeChunks.length) {
    problems.push(`Three.js in the index bundle: ${index.threeChunks.join(', ')}`)
  }

  for (const problem of problems) console.error(`FAIL ${problem}`)
  if (!problems.length) console.log('ok — no Three.js on the index, app code within budget')

  return { ok: problems.length === 0, index, baseline }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { ok } = checkBundleSize()
  if (!ok) process.exit(1)
}
