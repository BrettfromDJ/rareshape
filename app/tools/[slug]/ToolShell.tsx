'use client'

import { useEffect, useState } from 'react'
import type { RenderModule, Tool, ToolMeta } from '@rareshape/schema'
import { ToolHost } from '@rareshape/kit'
import { loaders } from '@/registry.generated'

interface Loaded {
  tool: Tool
  module: RenderModule
  encoded: string | null
  aspect: string | null
}

/**
 * Resolves a tool from the generated loader map and hands it to the kit.
 * The import is dynamic so that no renderer — and no Three.js — is pulled into
 * any bundle but the one page that needs it.
 */
export function ToolShell({ tool: meta }: { tool: ToolMeta }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    // The URL is read before the host mounts, so the first painted frame is
    // already the shared state rather than the defaults.
    const search = new URLSearchParams(window.location.search)
    const encoded = search.get('p')
    const aspect = search.get('a')

    const load = async (): Promise<Loaded> => {
      const loader = loaders[meta.slug]
      if (!loader) throw new Error(`No loader for "${meta.slug}". Run pnpm registry.`)
      const [toolModule, renderModule] = await Promise.all([loader.tool(), loader.render()])
      const resolved = (toolModule as { tool?: Tool }).tool
      if (!resolved) throw new Error(`tools/${meta.slug}/tool.ts must export \`tool\``)
      return { tool: resolved, module: renderModule as RenderModule, encoded, aspect }
    }

    load().then(
      (next) => {
        if (!cancelled) setLoaded(next)
      },
      (cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause))
      },
    )

    return () => {
      cancelled = true
    }
  }, [meta.slug])

  if (error) {
    return (
      <div className="flex-1 grid place-items-center px-6">
        <p className="text-[var(--dim)] max-w-[40ch] text-center">{error}</p>
      </div>
    )
  }

  if (!loaded) {
    return (
      <div className="flex-1 grid place-items-center">
        <span className="meta text-[var(--faint)]">Loading {meta.name}</span>
      </div>
    )
  }

  return (
    <ToolHost
      tool={loaded.tool}
      module={loaded.module}
      initialEncoded={loaded.encoded}
      initialAspect={loaded.aspect}
    />
  )
}
