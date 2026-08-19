/**
 * Acceptance checks for the standalone HTML export (BUILD_BRIEF phase 4).
 *
 * Every harness tool is ejected through the real export path, written to disk,
 * then opened over file:// with the network cut off — which is what "opens
 * offline by double-clicking" actually means.
 */
import { build } from 'esbuild'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { launchBrowser } from './lib/browser'
import { openLab } from './lib/lab'

const OUT_DIR = process.env.EJECT_CHECK_DIR ?? '.eject-check'

interface Check {
  name: string
  ok: boolean
  detail: string
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true })
  const checks: Check[] = []
  const record = (name: string, ok: boolean, detail = '') => {
    checks.push({ name, ok, detail })
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  }

  // The sandbox this runs in cannot reach a CDN, so Three.js is self-hosted
  // for the test and the import map is pointed at it. That exercises the same
  // mechanism the shipped file uses; only the URL differs.
  const threePath = resolve(join(OUT_DIR, 'three.module.js'))
  await build({
    entryPoints: ['three'],
    outfile: threePath,
    bundle: true,
    format: 'esm',
    target: 'es2022',
    platform: 'browser',
    minify: false,
    legalComments: 'none',
  })

  // --- eject every tool through the real pipeline --------------------------
  const lab = await openLab()
  const files: Array<{ slug: string; path: string; webgl: boolean }> = []
  try {
    for (const tool of lab.tools) {
      const result = await lab.export({
        slug: tool.slug,
        format: 'html',
        width: 800,
        height: 800,
        htmlAspect: '3:2',
        ...(tool.engine === 'webgl'
          ? { htmlImports: { three: './three.module.js', 'three/': './three.module.js' } }
          : {}),
      })
      const path = resolve(join(OUT_DIR, result.filename))
      writeFileSync(path, result.bytes)
      files.push({ slug: tool.slug, path, webgl: tool.engine === 'webgl' })

      const text = result.bytes.toString('utf8')
      record(
        `${tool.slug} ejects`,
        text.startsWith('<!doctype html>') && text.includes('rs-params'),
        `${Math.round(result.size / 1024)} KB`,
      )
      record(
        `${tool.slug} eject carries the stage shape it was exported at`,
        text.includes('data-aspect="3:2"'),
      )
      record(
        `${tool.slug} eject is readable source`,
        text.includes('standalone build') && /function (render|create)\b/.test(text),
        'render function present in plain text',
      )
      if (tool.engine === 'webgl') {
        // The file under test points at a self-hosted copy; check the default
        // export — the one users get — points at the CDN instead of inlining.
        const shipped = await lab.export({
          slug: tool.slug,
          format: 'html',
          width: 400,
          height: 400,
        })
        const shippedText = shipped.bytes.toString('utf8')
        record(
          `${tool.slug} reaches three through an import map`,
          text.includes('importmap') &&
            shippedText.includes('esm.sh/three') &&
            !shippedText.includes('THREE.WebGLRenderer =') &&
            shipped.size < 200_000,
          `shipped file ${Math.round(shipped.size / 1024)} KB, three not inlined`,
        )
      }
    }
  } finally {
    await lab.close()
  }

  // --- open each file from disk, offline -----------------------------------
  const browser = await launchBrowser()
  try {
    for (const file of files) {
      const context = await browser.newContext({ offline: true })
      const page = await context.newPage()
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(String(error)))

      await page.goto(pathToFileURL(file.path).href)
      await page.waitForTimeout(file.webgl ? 4000 : 1200)

      const state = await page.evaluate(() => ({
        controls: document.querySelectorAll('.rs-field').length,
        hasSurface: Boolean(document.querySelector('#rs-frame canvas, #rs-frame svg')),
        painted: (() => {
          const canvas = document.querySelector<HTMLCanvasElement>('#rs-frame canvas')
          if (canvas) {
            const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
            if (gl) return canvas.width > 0 && canvas.height > 0
            const ctx = canvas.getContext('2d')
            if (!ctx) return false
            const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
            for (let i = 3; i < data.length; i += 4) if ((data[i] as number) > 0) return true
            return false
          }
          const svg = document.querySelector('#rs-frame svg')
          return Boolean(svg && svg.children.length > 1)
        })(),
      }))

      record(
        `${file.slug} opens from file:// offline${file.webgl ? ' (three self-hosted)' : ''}`,
        state.controls > 0 && state.hasSurface && state.painted && errors.length === 0,
        `${state.controls} controls, painted ${state.painted}${errors.length ? `, errors: ${errors[0]}` : ''}`,
      )

      // Controls must actually drive the render: randomize, then compare the
      // painted output rather than merely checking the page survived.
      const sample = `
        (() => {
          const canvas = document.querySelector('#rs-frame canvas')
          if (canvas) {
            const out = document.createElement('canvas')
            out.width = 64
            out.height = 64
            const ctx = out.getContext('2d')
            ctx.drawImage(canvas, 0, 0, 64, 64)
            return out.toDataURL()
          }
          return document.querySelector('#rs-frame')?.innerHTML ?? ''
        })()
      `
      const before = (await page.evaluate(sample)) as string
      await page.evaluate(`
        [...document.querySelectorAll('button')]
          .find((node) => node.textContent === 'Randomize')
          ?.click()
      `)
      await page.waitForTimeout(400)
      const after = (await page.evaluate(sample)) as string
      record(
        `${file.slug} controls drive the render`,
        before !== after && before.length > 0 && errors.length === 0,
        `output changed after randomize`,
      )

      await context.close()
    }
  } finally {
    await browser.close()
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
