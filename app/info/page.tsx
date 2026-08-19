import type { Metadata } from 'next'
import Link from 'next/link'
import { CATEGORIES, OUTPUTS } from '@rareshape/schema'
import { Header } from '../_components/Header'
import { listedTools, usedCategories } from '@/lib/registry'
import { SITE } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Info',
  description: SITE.description,
}

export default function InfoPage() {
  const tools = listedTools

  return (
    <>
      <Header current="Info" />

      <div className="px-[var(--gutter)] py-12 md:py-16 max-w-[68ch]">
        <h1 className="hero mb-8">{SITE.statement}</h1>

        <Section title="What this is">
          <p>
            {SITE.name} is an open repository of small browser tools for designers — pattern makers,
            shape generators, effects and shaders. Every tool has its own URL, shares one set of
            controls, and exports real files: PNG, MP4, GIF, SVG where it applies, and a standalone
            HTML file you can keep.
          </p>
          <p>
            There is no backend. No accounts, no database, no tracking. The state of a tool lives in
            its URL, so a link is the whole document — copy it, send it, reopen it a year later.
          </p>
        </Section>

        <Section title="How a tool works">
          <p>
            A tool is a param schema and a deterministic render function. Everything else — the
            controls, the URL state, presets, randomize, undo, export, permalinks, the preview on the
            index — is generated from that schema by shared machinery. Adding a tool means writing a
            render function and a param list.
          </p>
          <p>
            Because the render function is pure, the same parameters always produce the same pixels.
            That is what makes exports frame-accurate, previews reproducible, and the standalone HTML
            file identical to the site.
          </p>
        </Section>

        <Section title="Exports">
          <Table
            rows={[
              ['PNG', '1×, 2× or 4×, with real transparency'],
              ['MP4', 'WebCodecs H.264. Chrome, Edge, Safari 16.4+'],
              ['GIF', 'The universal fallback — works everywhere'],
              ['SVG', 'Vector tools, optimised. Animated SVG loops inside an img tag'],
              ['HTML', 'One self-contained file that opens offline and keeps working'],
            ]}
          />
          <p>
            MP4 is hidden rather than broken where the browser has no H.264 encoder. GIF covers the
            same ground everywhere else.
          </p>
        </Section>

        <Section title="Shortcuts">
          <Table
            rows={[
              ['R', 'Randomize'],
              ['Z / ⇧Z', 'Undo / redo'],
              ['Space', 'Play / pause'],
              ['E', 'Export'],
              ['C', 'Copy link'],
              ['0', 'Reset'],
              ['[ / ]', 'Previous / next preset'],
              ['⌘K', 'Search the index'],
            ]}
          />
        </Section>

        <Section title="Contributing">
          <p>
            The repository is MIT licensed and takes contributions. Run{' '}
            <Code>pnpm new-tool my-tool</Code> to scaffold one; the checklist for shipping it is in{' '}
            <Code>TOOL_SPEC.md</Code>.
          </p>
          <p>
            <a
              href={SITE.github}
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-4 decoration-[var(--faint)] hover:decoration-[var(--text)]"
            >
              github.com/BrettfromDJ/rareshape
            </a>
          </p>
        </Section>

        <Section title="State of the repository">
          <Table
            rows={[
              ['Tools', String(tools.length)],
              ['Categories', `${usedCategories(tools).length || CATEGORIES.length} of ${CATEGORIES.length}`],
              ['Export formats', String(OUTPUTS.length)],
              ['Licence', 'MIT'],
            ]}
          />
        </Section>
      </div>

      <footer className="rule border-t px-[var(--gutter)] py-6 flex gap-6">
        <Link href="/" className="meta hover:text-[var(--text)]">
          ← Index
        </Link>
        <span className="meta ml-auto">MIT</span>
      </footer>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rule border-t py-8 space-y-4">
      <h2 className="meta text-[var(--text)]">{title}</h2>
      <div className="space-y-4 text-[var(--dim)]">{children}</div>
    </section>
  )
}

function Table({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="grid grid-cols-[minmax(6rem,10rem)_1fr] gap-x-6 gap-y-2">
      {rows.map(([term, description]) => (
        <div key={term} className="contents">
          <dt className="font-mono text-[var(--text-sm)] text-[var(--text)]">{term}</dt>
          <dd>{description}</dd>
        </div>
      ))}
    </dl>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[var(--text)]">{children}</code>
}
