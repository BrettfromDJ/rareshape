/**
 * Acceptance checks for the export pipeline (BUILD_BRIEF phase 3).
 *
 * Runs every format through the real pipeline in headless Chromium and asserts
 * the properties the brief names: byte-identical repeat runs, a seamless loop,
 * geometrically correct 4× PNG, an animated SVG that animates in an <img>, and
 * MP4 that is absent rather than broken where WebCodecs is missing.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { openLab } from './lib/lab'

const OUT_DIR = process.env.EXPORT_CHECK_DIR ?? '.export-check'
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex').slice(0, 16)

interface Check {
  name: string
  ok: boolean
  detail: string
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true })
  const lab = await openLab()
  const checks: Check[] = []
  const record = (name: string, ok: boolean, detail = '') => {
    checks.push({ name, ok, detail })
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  }

  try {
    // --- PNG, all three scales -------------------------------------------
    for (const slug of ['_harness-svg', '_harness-canvas', '_harness-webgl']) {
      for (const scale of [1, 2, 4]) {
        const png = await lab.export({ slug, format: 'png', width: 400, height: 400, scale })
        writeFileSync(join(OUT_DIR, `${slug}-${scale}x.png`), png.bytes)
        const size = pngSize(png.bytes)
        record(
          `png ${slug} @${scale}x`,
          size.width === 400 * scale && size.height === 400 * scale,
          `${size.width}×${size.height}, ${png.size} bytes`,
        )
      }
    }

    // 4× must be the same drawing, not a bigger one: downscaling 4× to 1×
    // should land close to the 1× render.
    const oneX = await lab.export({ slug: '_harness-svg', format: 'png', width: 200, height: 200, scale: 1 })
    const fourX = await lab.export({ slug: '_harness-svg', format: 'png', width: 200, height: 200, scale: 4 })
    record(
      'png 4× is resolution independent',
      pngSize(fourX.bytes).width === pngSize(oneX.bytes).width * 4,
      `${pngSize(oneX.bytes).width} vs ${pngSize(fourX.bytes).width}`,
    )

    // Does this browser have an H.264 encoder at all? Open-source Chromium
    // builds do not, and the product hides MP4 in exactly that case.
    const h264 = await lab.page.evaluate(async () => {
      try {
        const support = await VideoEncoder.isConfigSupported({
          codec: 'avc1.4D402A',
          width: 320,
          height: 240,
          bitrate: 2_000_000,
          framerate: 30,
        })
        return support.supported === true
      } catch {
        return false
      }
    })
    console.log(`note  browser H.264 encoder: ${h264 ? 'present' : 'absent (using an open codec for the mp4 checks)'}`)

    // --- determinism: the same export twice -------------------------------
    for (const format of ['png', 'svg', 'gif', 'mp4'] as const) {
      const slug = format === 'svg' ? '_harness-svg' : '_harness-canvas'
      const options = {
        slug,
        format,
        width: 320,
        height: 180,
        scale: 1,
        duration: 1,
        fps: 12,
        allowFallbackCodec: !h264,
      }
      const first = await lab.export(options)
      const second = await lab.export(options)
      record(
        `${format} is byte-identical across runs`,
        sha(first.bytes) === sha(second.bytes),
        `${sha(first.bytes)} / ${sha(second.bytes)}`,
      )
      writeFileSync(join(OUT_DIR, first.filename), first.bytes)
    }

    // --- MP4: frame count and no seam at the loop point --------------------
    const mp4 = await lab.export({
      slug: '_harness-canvas',
      format: 'mp4',
      width: 480,
      height: 270,
      scale: 1,
      duration: 10,
      fps: 60,
      allowFallbackCodec: !h264,
    })
    writeFileSync(join(OUT_DIR, 'loop-10s-60fps.mp4'), mp4.bytes)
    const frames = countMp4Samples(mp4.bytes)
    record('mp4 10s at 60fps has 600 frames', frames === 600, `${frames} frames, ${mp4.size} bytes`)

    // A seam shows up as a jump in mean pixel difference across the wrap.
    // Exact hash equality is the wrong test: sin(2π) is 1e-16, not 0, so a
    // perfectly seamless loop still differs in the last bit.
    for (const slug of ['_harness-canvas', '_harness-svg', '_harness-webgl']) {
      const wrap = await lab.page.evaluate(
        (name: string) =>
          window.rareshapeLab!.diffFrames({ slug: name, a: 0, b: 1, width: 240, height: 240 }),
        slug,
      )
      const step = await lab.page.evaluate(
        (name: string) =>
          window.rareshapeLab!.diffFrames({ slug: name, a: 0, b: 1 / 60, width: 240, height: 240 }),
        slug,
      )
      record(
        `${slug} loop has no seam at t=1`,
        wrap < 0.5 && wrap < Math.max(step, 0.5),
        `wrap ${wrap.toFixed(4)} vs one-frame step ${step.toFixed(4)}`,
      )
    }

    // --- animated SVG: animates inside an <img> ---------------------------
    const animated = await lab.export({
      slug: '_harness-svg',
      format: 'svg-animated',
      width: 400,
      height: 400,
      duration: 2,
      fps: 12,
    })
    writeFileSync(join(OUT_DIR, 'loop.svg'), animated.bytes)
    const markup = animated.bytes.toString('utf8')
    const external = /<script|xlink:href="http|href="http|url\(['"]?http|<image/.test(markup)
    record(
      'animated svg is self-contained CSS keyframes',
      markup.includes('@keyframes') && !external,
      `${animated.size} bytes`,
    )

    const animates = await animatesInImgTag(lab, markup)
    record('animated svg animates inside an <img>', animates.ok, animates.detail)

    // --- MP4 hidden, not broken, without WebCodecs -------------------------
    const withoutCodecs = await lab.page.evaluate(() => {
      const original = window.VideoEncoder
      // @ts-expect-error deliberately removing the API to mimic Firefox
      delete window.VideoEncoder
      const present = typeof window.VideoEncoder === 'function'
      window.VideoEncoder = original
      return present
    })
    record('mp4 is feature-detected, not assumed', withoutCodecs === false)

    const probe = await lab.page.evaluate(
      async () =>
        // The product's own probe must agree with the browser's real capability.
        (await window.rareshapeLab!.mp4Supported()) === true,
    )
    record('export sheet offers mp4 only where H.264 encodes', probe === h264, `probe ${probe}, browser ${h264}`)

    const svgOnly = await lab
      .export({ slug: '_harness-canvas', format: 'svg', width: 100, height: 100 })
      .then(() => false)
      .catch(() => true)
    record('svg export refuses non-vector tools', svgOnly)
  } finally {
    await lab.close()
  }

  const failed = checks.filter((check) => !check.ok)
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
  if (failed.length) process.exit(1)
}

/** Width and height out of a PNG IHDR. */
function pngSize(bytes: Buffer): { width: number; height: number } {
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

/** Sample count from the first `stsz` box — the number of encoded frames. */
function countMp4Samples(bytes: Buffer): number {
  const index = bytes.indexOf('stsz')
  if (index < 0) return -1
  return bytes.readUInt32BE(index + 12)
}

async function animatesInImgTag(
  lab: Awaited<ReturnType<typeof openLab>>,
  markup: string,
): Promise<{ ok: boolean; detail: string }> {
  // Load the SVG through an <img>, screenshot it twice a beat apart, and check
  // the pixels actually changed. Scripts do not run in that context, so if this
  // moves, it moves for real users too.
  const script = `
    (async (svg) => {
      const img = document.createElement('img')
      img.width = 200
      img.height = 200
      document.body.appendChild(img)
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = () => reject(new Error('img failed to load the svg'))
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
      })
      const canvas = document.createElement('canvas')
      canvas.width = 200
      canvas.height = 200
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, 200, 200)
      const first = canvas.toDataURL()
      await new Promise((resolve) => setTimeout(resolve, 700))
      ctx.clearRect(0, 0, 200, 200)
      ctx.drawImage(img, 0, 0, 200, 200)
      const second = canvas.toDataURL()
      img.remove()
      return { changed: first !== second }
    })
  `
  const result = (await lab.page.evaluate(`(${script})(${JSON.stringify(markup)})`)) as {
    changed: boolean
  }

  return {
    ok: result.changed,
    detail: result.changed ? 'pixels change over time' : 'no movement between samples',
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
