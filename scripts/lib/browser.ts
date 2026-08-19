/**
 * Headless Chromium, shared by the preview builder and the determinism test.
 * Both drive the *real* pipeline in a real browser — nothing about export is
 * reimplemented for Node, which is the only way the outputs can be trusted.
 */
import { existsSync } from 'node:fs'
import { chromium, type Browser, type LaunchOptions } from 'playwright'

/** Pinned browsers that ship with the image, newest first. */
const CANDIDATES = [
  process.env.CHROMIUM_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
].filter(Boolean) as string[]

export async function launchBrowser(options: LaunchOptions = {}): Promise<Browser> {
  const executablePath = CANDIDATES.find((path) => existsSync(path))
  return chromium.launch({
    ...options,
    ...(executablePath ? { executablePath } : {}),
    args: [
      '--allow-file-access-from-files',
      '--autoplay-policy=no-user-gesture-required',
      ...(options.args ?? []),
    ],
  })
}
