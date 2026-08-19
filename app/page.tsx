import Link from 'next/link'
import { CATEGORIES } from '@rareshape/schema'
import { Header } from './_components/Header'
import { ToolGrid } from './_components/ToolGrid'
import { lastUpdated, listedTools, shortDate, usedCategories, usedOutputs } from '@/lib/registry'
import { SITE } from '@/lib/site'

export default function IndexPage() {
  const tools = listedTools
  const categories = usedCategories(tools)
  const outputs = usedOutputs(tools)
  const updated = lastUpdated(tools)

  return (
    <>
      <Header current="Index" />

      <main id="content">
      <section className="rule border-b px-[var(--gutter)] py-10 md:py-14">
        <div className="grid gap-8 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <dl className="grid grid-cols-2 gap-y-6 gap-x-8 self-start max-w-xs">
            <Stat label="Tools" value={String(tools.length)} />
            <Stat label="Categories" value={String(categories.length || CATEGORIES.length)} />
            <Stat label="Exports" value={`${outputs.length || 5} formats`} />
            <Stat label="Updated" value={updated ? shortDate(updated) : '—'} />
          </dl>

          <div className="flex flex-col justify-between gap-8 md:min-h-[14rem]">
            <h1 className="hero max-w-[22ch]">{SITE.statement}</h1>
            <a
              href={`${SITE.github}/blob/main/CONTRIBUTING.md`}
              target="_blank"
              rel="noreferrer noopener"
              className="meta self-start hover:text-[var(--text)] transition-colors"
            >
              ↳ Add a tool
            </a>
          </div>
        </div>
      </section>

      {tools.length === 0 ? (
        <Empty />
      ) : (
        <ToolGrid
          tools={tools}
          categories={categories.length ? categories : CATEGORIES}
          outputs={outputs}
        />
      )}

      </main>

      <footer className="rule border-t px-[var(--gutter)] py-6 flex flex-wrap gap-x-6 gap-y-2">
        <span className="meta">MIT</span>
        <span className="meta">No accounts, no tracking</span>
        <Link href="/info" className="meta hover:text-[var(--text)] transition-colors ml-auto">
          Info
        </Link>
      </footer>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="meta">{label}</dt>
      <dd className="font-mono text-[var(--text-lg)] text-[var(--text)] tabular-nums mt-1">{value}</dd>
    </div>
  )
}

function Empty() {
  return (
    <div className="px-[var(--gutter)] py-16">
      <p className="text-[var(--dim)] max-w-[40ch]">
        No tools yet. Run <code className="font-mono text-[var(--text)]">pnpm new-tool my-tool</code> to
        scaffold one, then <code className="font-mono text-[var(--text)]">pnpm registry</code>.
      </p>
    </div>
  )
}
