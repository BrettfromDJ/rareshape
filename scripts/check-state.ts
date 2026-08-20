/**
 * State checks (BUILD_BRIEF phase 2).
 *
 * Every param type is exercised through the real page: changing it updates the
 * URL, a copied URL hard-reloads to the identical state, and undo/redo walks
 * back through all of it. The harness tool exists precisely so this can be
 * asserted over every type at once.
 */
import { pathToFileURL } from 'node:url'
import type { Page } from 'playwright'
import { launchBrowser } from './lib/browser'
import { serveStatic } from './lib/serve'

const SLUG = '_harness-svg'

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

/**
 * The rendered SVG markup is the ground truth for "same state" — but only once
 * the loop is parked: two pages left playing are simply at different `t`.
 */
async function freeze(page: Page): Promise<void> {
  await page.evaluate(`document.activeElement?.blur()`)
  await page.keyboard.press(' ')
  await page.locator('input[aria-label="Loop position"]').focus()
  await page.keyboard.press('Home')
  await page.waitForTimeout(200)
}

const snapshot = (page: Page) =>
  page.evaluate(`document.querySelector('[role="img"]')?.innerHTML ?? ''`) as Promise<string>

const encoded = (page: Page) =>
  page.evaluate(`new URLSearchParams(location.search).get('p') ?? ''`) as Promise<string>

const decode = (value: string): Record<string, unknown> =>
  value ? (JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<string, unknown>) : {}

// The codec drops the leading # from colors, so this matches with or without.
const isColor = (value: unknown): boolean =>
  typeof value === 'string' && /^#?(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)

/** Every color-shaped value in a decoded state, without knowing the schema. */
const colorsOf = (params: Record<string, unknown>): string =>
  JSON.stringify(
    Object.entries(params)
      .filter(([, v]) => isColor(v) || (Array.isArray(v) && v.length > 0 && v.every(isColor)))
      .sort(([a], [b]) => a.localeCompare(b)),
  )

async function main(): Promise<void> {
  const server = await serveStatic('out', 4313)
  const browser = await launchBrowser()

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(String(error)))

    await page.goto(`${server.origin}/tools/${SLUG}`, { waitUntil: 'networkidle' })
    await page.waitForSelector('.rule input[type="range"]')
    await page.waitForTimeout(400)

    record('a default state leaves the URL clean', (await encoded(page)) === '')

    // --- touch one control of every type -----------------------------------
    const touched: string[] = []

    // Sliders and the dial are driven from the keyboard, which is both the
    // accessible path and the one a synthetic value change would skip.
    const nudge = async (selector: string, times = 4) => {
      await page.locator(selector).focus()
      for (let i = 0; i < times; i++) await page.keyboard.press('ArrowRight')
      await page.waitForTimeout(80)
    }
    const fill = async (selector: string, value: string) => {
      await page.locator(selector).first().fill(value)
      await page.waitForTimeout(80)
    }

    await nudge('#p-columns')
    touched.push('int')
    await nudge('#p-padding')
    touched.push('number')
    await nudge('#p-scale')
    touched.push('range')
    await nudge('#p-rotation', 6)
    touched.push('angle')
    await fill('#p-seed', '99')
    touched.push('seed')
    await fill('#p-caption', 'hello')
    touched.push('text')
    // Color controls open a picker panel; the hex field inside it is the
    // deterministic way to set a value.
    await page.locator('#p-background button').first().click()
    await fill('#p-background input[type="text"]', '#223344')
    touched.push('color')

    await page.locator('#p-palette button').first().click()
    await fill('#p-palette input[type="text"]', '#ff0055')
    touched.push('palette')
    await page.getByRole('radio', { name: 'Square' }).click()
    touched.push('select')
    await page.getByRole('switch', { name: 'Outline' }).click()
    touched.push('boolean')

    // point: drag the pad
    const pad = page.locator('#p-focus')
    const box = await pad.boundingBox()
    if (box) {
      await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.7)
      await page.mouse.down()
      await page.mouse.up()
      touched.push('point')
    }

    // curve: nudge the first handle
    const curve = page.locator('#p-falloff')
    const curveBox = await curve.boundingBox()
    if (curveBox) {
      await page.mouse.move(curveBox.x + curveBox.width * 0.3, curveBox.y + curveBox.height * 0.4)
      await page.mouse.down()
      await page.mouse.move(curveBox.x + curveBox.width * 0.6, curveBox.y + curveBox.height * 0.2)
      await page.mouse.up()
      touched.push('curve')
    }

    await page.waitForTimeout(300)
    record('every param type has a working control', touched.length === 12, touched.join(', '))

    const url = page.url()
    const state = await encoded(page)
    record('changing params writes to the URL', state.length > 0, `?p=${state.slice(0, 24)}…`)

    await freeze(page)
    const before = await snapshot(page)

    // --- hard reload the copied URL ----------------------------------------
    const fresh = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await fresh.goto(url, { waitUntil: 'networkidle' })
    await fresh.waitForTimeout(600)
    await freeze(fresh)
    const after = await snapshot(fresh)
    record(
      'a copied URL hard-reloads to the identical state',
      before === after && before.length > 0,
      `${before.length} vs ${after.length} chars of output`,
    )
    record('reload preserves the encoded state exactly', (await encoded(fresh)) === state)
    await fresh.close()

    // --- undo / redo --------------------------------------------------------
    // Shortcuts deliberately do nothing while a control has focus, so let go of
    // the timeline slider first.
    await page.evaluate(`document.activeElement?.blur()`)
    const undos = touched.length + 1
    for (let i = 0; i < undos; i++) {
      await page.keyboard.press('z')
      await page.waitForTimeout(60)
    }
    record('undo walks back through every type', (await encoded(page)) === '', 'back to defaults')

    for (let i = 0; i < undos; i++) {
      await page.keyboard.press('Shift+Z')
      await page.waitForTimeout(60)
    }
    record(
      'redo returns to the same state',
      (await encoded(page)) === state,
      'encoded state matches',
    )

    // --- randomize, reset, presets -----------------------------------------
    await page.keyboard.press('r')
    await page.waitForTimeout(200)
    const randomised = await encoded(page)
    record('randomize changes the state', randomised !== state && randomised.length > 0)

    await page.keyboard.press('0')
    await page.waitForTimeout(200)
    record('reset returns to defaults', (await encoded(page)) === '')

    await page.keyboard.press(']')
    await page.waitForTimeout(200)
    record('presets load from the keyboard', (await encoded(page)).length > 0)

    // --- stage aspect ------------------------------------------------------
    // Not a param, but part of what a link should carry.
    await page.getByRole('button', { name: '9:16', exact: true }).click()
    await page.waitForTimeout(300)
    const withAspect = page.url()
    record('changing the stage aspect writes to the URL', withAspect.includes('a=9%3A16'))

    const shaped = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await shaped.goto(withAspect, { waitUntil: 'networkidle' })
    await shaped.waitForTimeout(800)
    const ratio = (await shaped.evaluate(`(() => {
      const box = document.querySelector('[role="img"]').getBoundingClientRect()
      return box.width / box.height
    })()`)) as number
    record(
      'a shared link reopens at the same aspect',
      Math.abs(ratio - 9 / 16) < 0.01,
      ratio.toFixed(3),
    )
    await shaped.close()

    // --- the color picker dismisses ----------------------------------------
    // The picker expands inline, so closing it collapses the rail. Dismissing
    // on pointerdown moved every control below it out from under the pointer
    // before the button it was aimed at could be clicked — the second check
    // here is that trap.
    const field = (control: string) => page.locator(`${control} [role="application"]`).count()

    await page.locator('#p-background button').first().click()
    await page.waitForTimeout(150)
    const wasOpen = await field('#p-background')
    await page.locator('h1').first().click()
    await page.waitForTimeout(150)
    record(
      'clicking outside closes the color picker',
      wasOpen === 1 && (await field('#p-background')) === 0,
    )

    await page.locator('#p-background button').first().click()
    await page.waitForTimeout(150)
    await page.locator('#p-palette button').first().click()
    await page.waitForTimeout(150)
    record(
      'a swatch clicked while another picker is open opens its own',
      (await field('#p-background')) === 0 && (await field('#p-palette')) === 1,
    )
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)

    // --- locking the color scheme -------------------------------------------
    // Landing on colors you like and then wanting new geometry under them is
    // the whole point, so Randomize has to be able to leave them alone — and
    // has to go back to rolling them when the lock comes off.
    await page.locator('#p-background button').first().click()
    await fill('#p-background input[type="text"]', '#7a2f9e')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(120)

    const roll = async (): Promise<Record<string, unknown>> => {
      await page.evaluate(`document.activeElement?.blur()`)
      await page.keyboard.press('r')
      await page.waitForTimeout(200)
      return decode(await encoded(page))
    }

    await page.getByRole('button', { name: 'Lock colors' }).click()
    const beforeLocked = decode(await encoded(page))
    const afterLocked = await roll()
    record(
      'locked colors survive a randomize',
      colorsOf(afterLocked) !== '[]' &&
        colorsOf(beforeLocked) === colorsOf(afterLocked) &&
        JSON.stringify(beforeLocked) !== JSON.stringify(afterLocked),
      colorsOf(afterLocked).slice(0, 70),
    )

    await page.getByRole('button', { name: 'Lock colors' }).click()
    const afterUnlocked = await roll()
    record('unlocking lets randomize roll them again', colorsOf(afterLocked) !== colorsOf(afterUnlocked))

    // --- the export sheet, driven the way a person drives it ----------------
    // Every other export check calls the pipeline directly, which is exactly
    // how a sheet clipped out of sight by an overflow container went unnoticed.
    await page.getByTitle('Export (E)').click()
    await page.waitForTimeout(400)

    const painted = await page.evaluate(`(() => {
      const panel = [...document.querySelectorAll('div')].find((d) =>
        String(d.className).includes('absolute bottom-11'),
      )
      if (!panel) return 'missing'
      const box = panel.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) return 'collapsed'
      // Whatever is painted at the panel's own coordinates must be the panel.
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + 20)
      return panel.contains(hit) ? 'visible' : 'clipped'
    })()`)
    record('the export sheet is visible when opened', painted === 'visible', String(painted))

    const download = page.waitForEvent('download', { timeout: 60_000 }).catch(() => null)
    await page.getByRole('button', { name: /Export PNG/i }).click()
    const file = await download
    record(
      'the export button produces a file',
      file !== null,
      file ? file.suggestedFilename() : 'no download arrived',
    )

    record('no page errors throughout', errors.length === 0, errors[0] ?? '')
  } finally {
    await browser.close()
    await server.close()
  }

  const failed = checks.filter((check) => !check.ok)
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
  if (failed.length) process.exit(1)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
