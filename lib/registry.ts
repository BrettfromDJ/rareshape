import type { Category, Output, ToolMeta } from '@rareshape/schema'
import { CATEGORIES } from '@rareshape/schema'
import { harness, registry } from '@/registry.generated'

/** Harness tools are buildable and linkable but never listed. */
const SHOW_HARNESS = process.env.NEXT_PUBLIC_SHOW_HARNESS === '1'

export const listedTools: ToolMeta[] = [...registry, ...(SHOW_HARNESS ? harness : [])].sort(
  (a, b) => (a.added < b.added ? 1 : a.added > b.added ? -1 : a.name.localeCompare(b.name)),
)

/** Everything that gets a page, harness tools included. */
export const allTools: ToolMeta[] = [...registry, ...harness]

export function toolBySlug(slug: string): ToolMeta | undefined {
  return allTools.find((t) => t.slug === slug)
}

export function usedCategories(tools: ToolMeta[] = listedTools): Category[] {
  return CATEGORIES.filter((c) => tools.some((t) => t.category === c))
}

export function usedOutputs(tools: ToolMeta[] = listedTools): Output[] {
  const seen = new Set<Output>()
  for (const t of tools) for (const o of t.outputs) seen.add(o)
  return [...seen]
}

export function lastUpdated(tools: ToolMeta[] = listedTools): string | null {
  return tools.reduce<string | null>((max, t) => (max === null || t.added > max ? t.added : max), null)
}

/** 2026-08-19 -> 08/19. The index shows dates in this compact form. */
export function shortDate(iso: string): string {
  const [, m = '', d = ''] = iso.split('-')
  return `${m}/${d}`
}
