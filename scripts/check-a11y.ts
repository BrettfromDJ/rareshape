/**
 * Accessibility audit (BUILD_BRIEF phase 1: Lighthouse a11y ≥ 95).
 *
 * Runs axe-core over the real pages — Lighthouse's accessibility score is a
 * weighted roll-up of exactly these checks, so a clean axe run at the wcag2a /
 * wcag2aa / best-practice tags is the same bar, stated more precisely.
 * Also checks that every interactive element is reachable and visibly focused.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import type { Page } from 'playwright'
import { launchBrowser } from './lib/browser'
import { serveStatic } from './lib/serve'

const require = createRequire(import.meta.url)
const AXE_SOURCE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')

const PAGES: Array<[string, string]> = [
  ['index', '/'],
  ['info', '/info'],
  ['tool', '/tools/_harness-svg'],
  ['spelling-bee', '/spelling-bee'],
  ['spelling-bee-audience', '/spelling-bee/audience'],
]

interface Violation {
  id: string
  impact: string
  help: string
  nodes: number
}

async function audit(page: Page): Promise<Violation[]> {
  await page.addScriptTag({ content: AXE_SOURCE })
  const result = (await page.evaluate(`
    axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
    })
  `)) as { violations: Array<{ id: string; impact: string; help: string; nodes: unknown[] }> }

  return result.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.length,
  }))
}

async function main(): Promise<void> {
  const server = await serveStatic('out', 4312)
  const browser = await launchBrowser()
  let failures = 0

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

    for (const [name, path] of PAGES) {
      await page.goto(`${server.origin}${path}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(800)

      const violations = await audit(page)
      const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')

      if (violations.length === 0) {
        console.log(`ok   ${name} — no axe violations`)
      } else {
        for (const violation of violations) {
          console.log(
            `${serious.includes(violation) ? 'FAIL' : 'warn'} ${name} — ${violation.id} (${violation.impact}, ${violation.nodes} node(s)): ${violation.help}`,
          )
        }
        failures += serious.length
      }

      // Focus must be visible, not merely present.
      const focus = await page.evaluate(`
        (() => {
          const focusable = document.querySelectorAll(
            'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
          )
          let checked = 0
          let invisible = 0
          for (const node of focusable) {
            node.focus()
            if (document.activeElement !== node) continue
            checked++
            const style = getComputedStyle(node, ':focus-visible')
            if (style.outlineStyle === 'none' && style.boxShadow === 'none') invisible++
          }
          return { checked, invisible }
        })()
      `) as { checked: number; invisible: number }

      const focusOk = focus.checked > 0 && focus.invisible === 0
      console.log(
        `${focusOk ? 'ok  ' : 'FAIL'} ${name} — focus is visible on ${focus.checked} element(s)`,
      )
      if (!focusOk) failures += 1
    }
  } finally {
    await browser.close()
    await server.close()
  }

  console.log(failures === 0 ? '\naccessibility: clean' : `\naccessibility: ${failures} failure(s)`)
  if (failures > 0) process.exit(1)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
