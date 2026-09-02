'use client'

/**
 * Hands a generated text file to the person. On the site this is a plain
 * browser download. Inside a claude.ai artifact the viewer blocks downloads,
 * so the page asks the host's `downloads` capability instead, which shows the
 * viewer a confirmation.
 */

type Outcome = 'saved' | 'declined' | 'unavailable'

interface HostDownloads {
  save(request: { filename: string; data: string }): Promise<{ status: 'saved' }>
}

interface HostClaude {
  use(name: 'downloads'): Promise<HostDownloads | null>
}

function hostClaude(): HostClaude | null {
  const candidate = (window as unknown as { claude?: { use?: unknown } }).claude
  return candidate && typeof candidate.use === 'function' ? (candidate as HostClaude) : null
}

export async function saveTextFile(filename: string, text: string): Promise<Outcome> {
  const host = hostClaude()
  if (host) {
    const downloads = await host.use('downloads').catch(() => null)
    if (!downloads) return 'unavailable'
    try {
      await downloads.save({ filename, data: text })
      return 'saved'
    } catch (cause) {
      const code = (cause as { code?: string } | null)?.code
      return code === 'declined' || code === 'rate_limited' ? 'declined' : 'unavailable'
    }
  }
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'saved'
}
