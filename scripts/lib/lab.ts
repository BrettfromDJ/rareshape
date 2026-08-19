/**
 * Opens the built site's /lab page in headless Chromium and exposes the real
 * export pipeline to Node. Everything downstream — previews, the determinism
 * test, the acceptance checks — goes through here.
 */
import type { Browser, Page } from 'playwright'
import { launchBrowser } from './browser'
import { serveStatic, type StaticServer } from './serve'

export interface LabToolInfo {
  slug: string
  name: string
  engine: string
  animated: boolean
  aspect: string
}

export interface LabExportOptions {
  slug: string
  format: 'png' | 'svg' | 'svg-animated' | 'gif' | 'mp4' | 'html'
  width: number
  height: number
  scale?: number
  duration?: number
  fps?: number
  t?: number
  background?: string | null
  params?: Record<string, unknown>
  allowFallbackCodec?: boolean
  htmlImports?: Record<string, string>
}

export interface LabSession {
  tools: LabToolInfo[]
  page: Page
  origin: string
  export(options: LabExportOptions): Promise<{ filename: string; size: number; bytes: Buffer }>
  hashFrame(options: {
    slug: string
    t: number
    width: number
    height: number
    seed?: number
  }): Promise<string>
  close(): Promise<void>
}

export async function openLab(root = 'out', port = 4310): Promise<LabSession> {
  const server: StaticServer = await serveStatic(root, port)
  const browser: Browser = await launchBrowser()
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

  const failures: string[] = []
  page.on('pageerror', (error) => failures.push(String(error)))

  await page.goto(`${server.origin}/lab`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => Boolean(window.rareshapeLab), null, { timeout: 30_000 })

  const tools = (await page.evaluate(() => window.rareshapeLab!.tools)) as LabToolInfo[]

  return {
    tools,
    page,
    origin: server.origin,

    async export(options) {
      const result = await page.evaluate(
        (request) => window.rareshapeLab!.export(request),
        options as never,
      )
      return {
        filename: result.filename,
        size: result.size,
        bytes: Buffer.from(result.base64, 'base64'),
      }
    },

    async hashFrame(options) {
      return page.evaluate((request) => window.rareshapeLab!.hashFrame(request), options as never)
    },

    async close() {
      await browser.close()
      await server.close()
      if (failures.length) console.warn(`lab: ${failures.length} page error(s)\n${failures.join('\n')}`)
    },
  }
}
