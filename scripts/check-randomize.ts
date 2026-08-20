/**
 * Randomize quality (TOOL_SPEC.md §10: "Randomize never produces an empty or
 * broken frame — try it twenty times").
 *
 * Presses Randomize repeatedly on every registered tool and looks at what
 * comes out: a frame that is almost entirely one colour, or that has only one
 * colour in it at all, is a wasted press. Colour schemes are generated as a
 * tonal ladder to prevent exactly that, and this is what proves it.
 */
import { pathToFileURL } from 'node:url'
import { launchBrowser } from './lib/browser'
import { serveStatic } from './lib/serve'

const ROLLS = Number(process.env.RANDOMIZE_ROLLS ?? 40)
/** One colour covering more than this reads as a flat block. */
const DOMINANCE = 0.88
/** Colours holding at least this share count as part of the composition. */
const MAJOR = 0.04

const MEASURE = `
  (async () => {
    // Vector tools render into a div; canvas and WebGL tools are the canvas.
    const host = document.querySelector('[role="img"]')
    const surface = host.tagName === 'CANVAS' ? host : host.querySelector('canvas')
    const svg = host.tagName === 'CANVAS' ? null : host.querySelector('svg')
    let width = 220
    let height = 140
    let source = null
    if (svg) {
      const clone = svg.cloneNode(true)
      const [, , w, h] = clone.getAttribute('viewBox').split(' ').map(Number)
      height = Math.max(1, Math.round(width * h / w))
      clone.setAttribute('width', width)
      clone.setAttribute('height', height)
      clone.removeAttribute('preserveAspectRatio')
      source = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone))
    }
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (source) {
      const img = new Image()
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = source })
      ctx.drawImage(img, 0, 0, width, height)
    } else {
      ctx.drawImage(surface, 0, 0, width, height)
    }
    const data = ctx.getImageData(0, 0, width, height).data
    const counts = new Map()
    for (let i = 0; i < data.length; i += 4) {
      // Quantised, so grid tints and antialiasing do not count as colours.
      const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4)
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    const total = width * height
    const shares = [...counts.values()].sort((a, b) => b - a).map((n) => n / total)
    return { dominant: shares[0], majors: shares.filter((s) => s >= ${MAJOR}).length }
  })()
`

async function main(): Promise<void> {
  const server = await serveStatic('out', 4314)
  const browser = await launchBrowser()
  let failures = 0

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } })
    await page.goto(`${server.origin}/lab`, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => Boolean(window.rareshapeLab), null, { timeout: 30_000 })
    // Harness fixtures are excluded: they exist to exercise the machinery, not
    // to compose, and a sparse test pattern on a flat ground is a pass for them.
    const tools = (
      (await page.evaluate(() => window.rareshapeLab!.tools)) as Array<{ slug: string }>
    ).filter((tool) => !tool.slug.startsWith('_'))

    if (tools.length === 0) {
      console.log('No listed tools to check.')
      return
    }

    for (const tool of tools) {
      await page.goto(`${server.origin}/tools/${tool.slug}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(900)

      let flat = 0
      let worst = 0
      for (let roll = 0; roll < ROLLS; roll++) {
        await page.evaluate(`document.activeElement?.blur()`)
        await page.keyboard.press('r')
        await page.waitForTimeout(80)
        const out = (await page.evaluate(MEASURE)) as { dominant: number; majors: number }
        worst = Math.max(worst, out.dominant)
        if (out.dominant > DOMINANCE || out.majors < 2) flat++
      }

      const ok = flat === 0
      if (!ok) failures++
      console.log(
        `${ok ? 'ok  ' : 'FAIL'} ${tool.slug} — ${ROLLS} rolls, ${flat} flat, ` +
          `busiest single colour ${(worst * 100).toFixed(1)}%`,
      )
    }
  } finally {
    await browser.close()
    await server.close()
  }

  console.log(failures === 0 ? '\nrandomize: every roll composes' : `\nrandomize: ${failures} tool(s) failing`)
  if (failures > 0) process.exit(1)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
