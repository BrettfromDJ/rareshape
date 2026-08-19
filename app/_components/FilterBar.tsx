import type { Category, Output } from '@rareshape/schema'

/** Static in phase 1; wired to real filtering in phase 5. */
export function FilterBar({
  categories,
  outputs,
}: {
  categories: readonly Category[]
  outputs: readonly Output[]
}) {
  return (
    <div className="rule border-b flex items-center gap-4 px-[var(--gutter)] h-10 overflow-x-auto">
      <span className="meta text-[var(--text)] whitespace-nowrap">All</span>
      {categories.map((c) => (
        <span key={c} className="meta whitespace-nowrap">
          {c}
        </span>
      ))}
      <span className="text-[var(--faint)]">|</span>
      {outputs.map((o) => (
        <span key={o} className="meta whitespace-nowrap">
          {o}
        </span>
      ))}
      <span className="meta ml-auto whitespace-nowrap">⌘K</span>
    </div>
  )
}
