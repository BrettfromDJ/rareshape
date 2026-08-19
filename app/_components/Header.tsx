import Link from 'next/link'
import { SITE } from '@/lib/site'
import { Clock } from './Clock'

const NAV = [
  { href: '/', label: 'Index' },
  { href: '/#tools', label: 'Tools' },
  { href: '/info', label: 'Info' },
]

export function Header({ current = 'Index' }: { current?: string }) {
  return (
    <header className="rule border-b sticky top-0 z-40 bg-[var(--bg)]/95 backdrop-blur-[2px]">
      <div className="flex items-center gap-4 px-[var(--gutter)] h-12">
        <Link href="/" className="font-mono text-[var(--text-sm)] tracking-[0.14em] text-[var(--text)]">
          {SITE.wordmark}
        </Link>

        <nav className="hidden sm:flex items-center gap-4 ml-4">
          {NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={
                'meta hover:text-[var(--text)] transition-colors ' +
                (item.label === current ? 'text-[var(--text)]' : '')
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <Clock />
          <a
            href={SITE.github}
            target="_blank"
            rel="noreferrer noopener"
            className="rule border px-3 py-1 meta hover:text-[var(--text)] hover:border-[var(--faint)] transition-colors"
          >
            GitHub
          </a>
        </div>
      </div>
    </header>
  )
}
