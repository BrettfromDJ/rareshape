/**
 * Index-at-scale checks (BUILD_BRIEF phase 5).
 *
 * Pads the registry to 100 synthetic entries, rebuilds, and drives the real
 * page: scroll smoothness, how many previews play at once, filtering and ⌘K by
 * keyboard alone, and reduced-motion behaviour. Restores the registry after.
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { launchBrowser } from './lib/browser'
import { serveStatic } from './lib/serve'
import { checkBundleSize } from './check-bundle-size'

const ROOT = resolve(import.meta.dirname, '..')
const REGISTRY = join(ROOT, 'registry.generated.ts')
const PREVIEWS = join(ROOT, 'public', 'previews')
const COUNT = 100

const CATEGORIES = ['Patterns', 'Shapes', 'Effects', 'Shaders', 'Type', 'Image'] as const
const OUTPUT_SETS = [
  ['SVG', 'PNG', 'HTML'],
  ['PNG', 'GIF', 'MP4', 'HTML'],
  ['PNG', 'MP4', 'HTML'],
  ['SVG', 'PNG', 'GIF', 'MP4', 'HTML'],
]
/** Cycled so every synthetic entry has real preview media behind it. */
const SOURCES = ['_harness-svg', '_harness-canvas', '_harness-webgl']

interface Check {
  name: string
  ok: boolean
  detail: string
}

const checks: Check[] = []
const record = (name: string, ok: boolean, detail = '') => {
  checks.push({ name, ok, detail })
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

function syntheticRegistry(original: string): { source: string; slugs: string[] } {
  const slugs: string[] = []
  const entries: string[] = []

  for (let i = 0; i < COUNT; i++) {
    const slug = `synthetic-${String(i + 1).padStart(3, '0')}`
    slugs.push(slug)
    const source = SOURCES[i % SOURCES.length] as string
    const animated = source !== '_harness-still'
    entries.push(
      JSON.stringify({
        slug,
        name: `Synthetic ${i + 1}`,
        tagline: `Scale fixture number ${i + 1}, standing in for a real tool.`,
        category: CATEGORIES[i % CATEGORIES.length],
        engine: source === '_harness-svg' ? 'svg' : source === '_harness-canvas' ? 'canvas2d' : 'webgl',
        outputs: OUTPUT_SETS[i % OUTPUT_SETS.length],
        added: `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
        animated,
        duration: 4,
        fps: 60,
        aspect: '1:1',
        keywords: [`fixture${i}`, i % 2 === 0 ? 'even' : 'odd'],
      }),
    )
  }

  const source = original.replace(
    /export const registry: ToolMeta\[\] = \[[\s\S]*?\] as ToolMeta\[\]/,
    `export const registry: ToolMeta[] = [\n${entries.map((entry) => `  ${entry},`).join('\n')}\n] as ToolMeta[]`,
  )
  return { source, slugs }
}

async function main(): Promise<void> {
  const original = readFileSync(REGISTRY, 'utf8')
  const { source, slugs } = syntheticRegistry(original)
  const linked: string[] = []

  try {
    writeFileSync(REGISTRY, source)
    // Real preview media for every synthetic entry, so image and video weight
    // in the measurement is real weight.
    slugs.forEach((slug, index) => {
      const from = join(PREVIEWS, SOURCES[index % SOURCES.length] as string)
      const to = join(PREVIEWS, slug)
      if (existsSync(from) && !existsSync(to)) {
        cpSync(from, to, { recursive: true })
        linked.push(to)
      }
    })

    console.log(`building with ${COUNT} synthetic entries…`)
    execFileSync('npx', ['next', 'build'], { cwd: ROOT, stdio: 'pipe' })

    const size = checkBundleSize()
    record('index bundle within budget with 100 entries', size.ok)
    record('no Three.js in the index bundle', size.index.threeChunks.length === 0)

    const server = await serveStatic(join(ROOT, 'out'), 4311)
    const browser = await launchBrowser()

    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(String(error)))

      await page.goto(`${server.origin}/`, { waitUntil: 'networkidle' })

      const cells = await page.locator('main a[href^="/tools/"], ul li a').count()
      record('all 100 entries render', cells >= COUNT, `${cells} cells`)
      record('no page errors', errors.length === 0, errors[0] ?? '')

      // --- scroll smoothness ------------------------------------------------
      const frames = (await page.evaluate(`
        new Promise((resolve) => {
          const durations = []
          let last = performance.now()
          let scrolled = 0
          const step = () => {
            const now = performance.now()
            durations.push(now - last)
            last = now
            scrolled += 220
            window.scrollTo(0, scrolled)
            if (scrolled < document.body.scrollHeight - window.innerHeight) {
              requestAnimationFrame(step)
            } else {
              durations.sort((a, b) => a - b)
              resolve({
                frames: durations.length,
                median: durations[Math.floor(durations.length / 2)],
                p95: durations[Math.floor(durations.length * 0.95)],
                worst: durations[durations.length - 1],
              })
            }
          }
          requestAnimationFrame(step)
        })
      `)) as { frames: number; median: number; p95: number; worst: number }

      record(
        'scrolling stays smooth at 100 entries',
        frames.p95 < 32,
        `median ${frames.median.toFixed(1)}ms, p95 ${frames.p95.toFixed(1)}ms over ${frames.frames} frames`,
      )

      // --- at most four previews playing ------------------------------------
      await page.evaluate('window.scrollTo(0, 0)')
      await page.waitForTimeout(300)
      const cellLocator = page.locator('ul li a')
      for (let i = 0; i < 8; i++) {
        await cellLocator.nth(i).hover({ force: true })
        await page.waitForTimeout(120)
      }
      const playingCount = await page.evaluate(
        `[...document.querySelectorAll('video')].filter((v) => !v.paused).length`,
      )
      record('at most four previews play at once', (playingCount as number) <= 4, `${playingCount} playing`)

      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
      // The observer needs a beat to fire before anything can be asserted.
      await page.waitForTimeout(600)
      const offscreenPlaying = await page.evaluate(`
        [...document.querySelectorAll('video')].filter((v) => {
          const box = v.getBoundingClientRect()
          return !v.paused && (box.bottom < -300 || box.top > window.innerHeight + 300)
        }).length
      `)
      record('offscreen previews are paused', (offscreenPlaying as number) === 0)

      // --- filtering and search, keyboard only -------------------------------
      await page.evaluate('window.scrollTo(0, 0)')
      await page.keyboard.press('Tab')
      const filtered = await filterByKeyboard(page)
      record('category filter works by keyboard alone', filtered.ok, filtered.detail)

      await page.reload({ waitUntil: 'networkidle' })
      await page.keyboard.press('Control+k')
      await page.waitForTimeout(150)
      // A keyword that belongs to exactly one entry, so the count is unambiguous.
      await page.keyboard.type('fixture41')
      await page.waitForTimeout(200)
      const searched = await page.locator('ul li a').count()
      const searchedName = await page.locator('ul li a').first().innerText()
      record(
        '⌘K search works by keyboard alone',
        searched === 1 && searchedName.includes('Synthetic 42'),
        `${searched} result(s): ${searchedName.replace(/\n/g, ' ')}`,
      )

      await page.keyboard.press('Escape')
      await page.waitForTimeout(150)
      record('escape clears the search', (await page.locator('ul li a').count()) === COUNT)

      // --- reduced motion -----------------------------------------------------
      const reduced = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        reducedMotion: 'reduce',
      })
      const reducedPage = await reduced.newPage()
      await reducedPage.goto(`${server.origin}/`, { waitUntil: 'networkidle' })
      await reducedPage.locator('ul li a').first().hover()
      await reducedPage.waitForTimeout(600)
      const playingReduced = await reducedPage.evaluate(
        `[...document.querySelectorAll('video')].filter((v) => !v.paused).length`,
      )
      record('previews stay still under reduced motion', playingReduced === 0)
      await reduced.close()
    } finally {
      await browser.close()
      await server.close()
    }
  } finally {
    writeFileSync(REGISTRY, original)
    for (const dir of linked) rmSync(dir, { recursive: true, force: true })
    console.log('\nregistry restored; rebuilding')
    execFileSync('npx', ['next', 'build'], { cwd: ROOT, stdio: 'pipe' })
  }

  const failed = checks.filter((check) => !check.ok)
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
  if (failed.length) process.exit(1)
}

async function filterByKeyboard(
  page: import('playwright').Page,
): Promise<{ ok: boolean; detail: string }> {
  // Walk the filter row with Tab until a category chip has focus, then press it.
  for (let i = 0; i < 24; i++) {
    const label = await page.evaluate(`document.activeElement?.textContent ?? ''`)
    if (label === 'Shaders') {
      await page.keyboard.press('Enter')
      await page.waitForTimeout(200)
      const count = await page.locator('ul li a').count()
      return {
        ok: count > 0 && count < COUNT,
        detail: `Shaders: ${count} of ${COUNT}`,
      }
    }
    await page.keyboard.press('Tab')
  }
  return { ok: false, detail: 'never reached a category chip by Tab' }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
