/**
 * `pnpm test:tools`
 *
 * Loads every registered tool, renders twice at t=0 and t=0.5 with a fixed
 * seed, and hashes the pixel buffers. A mismatch means the render function is
 * reading something it should not — Math.random(), a clock, module state —
 * which is the main way a tool ships silently broken.
 *
 * Runs against the built site in headless Chromium, so it tests the real
 * renderers rather than a Node reimplementation of them.
 */
import { pathToFileURL } from 'node:url'
import { openLab, type LabSession } from './lib/lab'

const SIZE = { width: 320, height: 320 }
const SEED = 12345
const SAMPLES = [0, 0.5]

export interface DeterminismResult {
  slug: string
  t: number
  first: string
  second: string
  ok: boolean
}

export async function runDeterminismTest(lab: LabSession): Promise<DeterminismResult[]> {
  const results: DeterminismResult[] = []

  for (const tool of lab.tools) {
    for (const t of SAMPLES) {
      const request = { slug: tool.slug, t, seed: SEED, ...SIZE }
      const first = await lab.hashFrame(request)
      const second = await lab.hashFrame(request)
      results.push({ slug: tool.slug, t, first, second, ok: first === second })
    }
  }

  return results
}

async function main(): Promise<void> {
  const lab = await openLab()
  let results: DeterminismResult[]
  try {
    if (lab.tools.length === 0) {
      console.log('No tools registered. Nothing to check.')
      return
    }
    results = await runDeterminismTest(lab)
  } finally {
    await lab.close()
  }

  for (const result of results) {
    const label = `${result.slug} @ t=${result.t}`
    if (result.ok) console.log(`ok   ${label} — ${result.first}`)
    else console.log(`FAIL ${label} — ${result.first} then ${result.second}`)
  }

  const failed = results.filter((result) => !result.ok)
  console.log(`\n${results.length - failed.length}/${results.length} renders are deterministic`)

  if (failed.length) {
    const slugs = [...new Set(failed.map((result) => result.slug))]
    console.error(
      `\n${slugs.join(', ')}: the same params produced different pixels twice.\n` +
        'Look for Math.random(), Date.now(), performance.now(), or state kept between\n' +
        'frames in the render function. See TOOL_SPEC.md §5.',
    )
    process.exit(1)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
