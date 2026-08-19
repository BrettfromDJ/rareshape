'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import type { Category, Output, ToolMeta } from '@rareshape/schema'
import { shortDate } from '@/lib/registry'

/**
 * The index grid. Filtering happens in place — no navigation, no refetch — and
 * previews are lazy: a poster until the cell is hovered and on screen, then the
 * tool's own animated output. At most four play at once.
 */
const MAX_PLAYING = 4

export function ToolGrid({
  tools,
  categories,
  outputs,
}: {
  tools: ToolMeta[]
  categories: readonly Category[]
  outputs: readonly Output[]
}) {
  const [category, setCategory] = useState<Category | null>(null)
  const [output, setOutput] = useState<Output | null>(null)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return tools.filter((tool) => {
      if (category && tool.category !== category) return false
      if (output && !tool.outputs.includes(output)) return false
      if (!needle) return true
      const haystack =
        `${tool.name} ${tool.category} ${tool.tagline} ${(tool.keywords ?? []).join(' ')}`.toLowerCase()
      return needle.split(/\s+/).every((word) => haystack.includes(word))
    })
  }, [tools, category, output, query])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
        window.setTimeout(() => searchRef.current?.focus(), 0)
      } else if (event.key === 'Escape' && searchOpen) {
        setSearchOpen(false)
        setQuery('')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [searchOpen])

  return (
    <>
      <div id="tools" className="rule border-b sticky top-12 z-30 bg-[var(--bg)]">
        <div className="flex items-center gap-3 px-[var(--gutter)] h-10 overflow-x-auto">
          <Chip active={category === null && output === null} onClick={() => {
            setCategory(null)
            setOutput(null)
          }}>
            All
          </Chip>

          {categories.map((entry) => (
            <Chip
              key={entry}
              active={category === entry}
              onClick={() => setCategory(category === entry ? null : entry)}
            >
              {entry}
            </Chip>
          ))}

          <span className="text-[var(--faint)] select-none">|</span>

          {outputs.map((entry) => (
            <Chip
              key={entry}
              active={output === entry}
              onClick={() => setOutput(output === entry ? null : entry)}
            >
              {entry}
            </Chip>
          ))}

          <button
            type="button"
            onClick={() => {
              setSearchOpen(true)
              window.setTimeout(() => searchRef.current?.focus(), 0)
            }}
            className="meta ml-auto whitespace-nowrap hover:text-[var(--text)]"
          >
            ⌘K
          </button>
        </div>

        {searchOpen && (
          <div className="rule border-t px-[var(--gutter)] py-2 flex items-center gap-3">
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tools"
              aria-label="Search tools"
              className="flex-1 bg-transparent outline-none text-[var(--text)] placeholder:text-[var(--faint)] py-1"
            />
            <span className="meta tabular-nums">{visible.length}</span>
            <button
              type="button"
              onClick={() => {
                setSearchOpen(false)
                setQuery('')
              }}
              className="meta hover:text-[var(--text)]"
            >
              Esc
            </button>
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="px-[var(--gutter)] py-16">
          <p className="text-[var(--dim)] max-w-[40ch]">
            Nothing matches. Clear the filters, or{' '}
            <button
              type="button"
              className="underline underline-offset-4"
              onClick={() => {
                setCategory(null)
                setOutput(null)
                setQuery('')
              }}
            >
              show everything
            </button>
            .
          </p>
        </div>
      ) : (
        <ul className="stagger grid gap-x-6 gap-y-10 px-[var(--gutter)] py-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((tool, index) => (
            <li key={tool.slug} className="rs-cell">
              <Cell tool={tool} index={Math.min(index, 12)} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'meta whitespace-nowrap transition-colors ' +
        (active ? 'text-[var(--text)]' : 'hover:text-[var(--text)]')
      }
    >
      {children}
    </button>
  )
}

/** How many previews are currently playing, shared across every cell. */
let playing = 0

function Cell({ tool, index }: { tool: ToolMeta; index: number }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const cellRef = useRef<HTMLAnchorElement>(null)
  const [onScreen, setOnScreen] = useState(false)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const node = cellRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry?.isIntersecting ?? false
        setOnScreen(visible)
        if (!visible) {
          const video = videoRef.current
          if (video && !video.paused) {
            video.pause()
            playing = Math.max(0, playing - 1)
          }
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const start = useCallback(() => {
    if (!tool.animated) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const video = videoRef.current
    if (!video || !onScreen || playing >= MAX_PLAYING) return
    playing += 1
    setActive(true)
    video.play().catch(() => {
      playing = Math.max(0, playing - 1)
      setActive(false)
    })
  }, [onScreen, tool.animated])

  const stop = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (!video.paused) {
      video.pause()
      video.currentTime = 0
      playing = Math.max(0, playing - 1)
    }
    setActive(false)
  }, [])

  return (
    <Link
      ref={cellRef}
      href={`/tools/${tool.slug}`}
      style={{ '--i': index } as React.CSSProperties}
      className="group block"
      onMouseEnter={start}
      onMouseLeave={stop}
      onFocus={start}
      onBlur={stop}
    >
      <div className="flex items-baseline gap-3 mb-2">
        <span className="meta tabular-nums">{shortDate(tool.added)}</span>
        <span className="text-[var(--text-md)] text-[var(--text)] group-hover:underline underline-offset-4 decoration-[var(--faint)]">
          {tool.name}
        </span>
      </div>
      <div className="meta mb-2 truncate">
        {tool.category} <span className="text-[var(--faint)]">—</span> {tool.outputs.join(' ')}
      </div>

      <div className="rule border bg-[var(--surface)] aspect-[4/3] overflow-hidden relative">
        {/* Native lazy loading rather than mounting on intersection: the browser
            schedules decode better than a burst of DOM work during a fast scroll. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/previews/${tool.slug}/thumb.jpg`}
          alt=""
          width={800}
          height={600}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {tool.animated && onScreen && (
          <video
            ref={videoRef}
            src={`/previews/${tool.slug}/preview.mp4`}
            muted
            loop
            playsInline
            preload="none"
            aria-hidden="true"
            className={
              'absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ' +
              (active ? 'opacity-100' : 'opacity-0')
            }
          />
        )}
      </div>
    </Link>
  )
}
