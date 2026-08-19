'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import type { ParamSchema, RenderModule, Tool, ParamsOf } from '@rareshape/schema'
import { permalink } from '@rareshape/schema'
import { Rail } from './Rail'
import { Stage } from './Stage'
import { Button } from './primitives'
import { usePlayback, usePrefersReducedMotion } from './playback'
import { SHORTCUT_HINTS, useShortcuts } from './shortcuts'
import { useToolStore, useUrlSync } from './useStore'

/**
 * The generic tool page. Given a tool and its render module it produces the
 * whole interface — controls, stage, playback, shortcuts, permalink.
 * Nothing here is tool-specific.
 */
export function ToolHost<S extends ParamSchema>({
  tool,
  module: renderModule,
  initialEncoded,
  slot,
}: {
  tool: Tool<S>
  module: RenderModule<ParamsOf<S>> | null
  initialEncoded: string | null
  /** Bottom-bar extras — the export bar is injected here. */
  slot?: (context: { params: ParamsOf<S>; t: number }) => React.ReactNode
}) {
  const { store, params } = useToolStore(tool, initialEncoded)
  const reduced = usePrefersReducedMotion()
  const [playing, setPlaying] = useState(tool.meta.animated && !reduced)
  const [copied, setCopied] = useState(false)
  const { t, setT } = usePlayback(tool.meta.duration, playing && tool.meta.animated)

  const encoded = store.encoded()
  useUrlSync(tool.meta.slug, encoded)

  const seed = useMemo(() => {
    const entry = Object.entries(tool.params).find(([, def]) => def.type === 'seed')
    const value = entry ? (params as Record<string, unknown>)[entry[0]] : undefined
    return typeof value === 'number' ? value : 1
  }, [tool, params])

  const copyLink = useCallback(() => {
    const href =
      typeof window === 'undefined'
        ? ''
        : permalink(window.location.origin, tool.meta.slug, encoded)
    void navigator.clipboard?.writeText(href).then(
      () => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1600)
      },
      () => undefined,
    )
  }, [encoded, tool.meta.slug])

  // Which preset `[` and `]` last landed on, so the pair walks the list.
  const lastPreset = useRef<string | null>(null)

  const cyclePreset = useCallback(
    (direction: 1 | -1) => {
      const names = tool.presets.map((preset) => preset.name)
      if (names.length === 0) return
      const index = names.indexOf(lastPreset.current ?? '')
      const next = (index + direction + names.length) % names.length
      const name = names[next]
      if (!name) return
      lastPreset.current = name
      store.loadPreset(name)
    },
    [store, tool.presets],
  )

  useShortcuts(
    useMemo(
      () => ({
        r: () => store.randomize(),
        z: () => store.undo(),
        'shift+z': () => store.redo(),
        '0': () => store.reset(),
        c: copyLink,
        space: () => setPlaying((value) => !value),
        '[': () => cyclePreset(-1),
        ']': () => cyclePreset(1),
      }),
      [store, copyLink, cyclePreset],
    ),
  )

  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
      <Rail tool={tool} store={store} params={params} onCopyLink={copyLink} copied={copied} />

      <main className="flex-1 min-h-0 flex flex-col">
        <Stage
          module={renderModule}
          params={params}
          t={t}
          seed={seed}
          aspect={tool.meta.aspect}
        />

        <div className="rule border-t flex items-center gap-3 px-4 h-11 shrink-0">
          {tool.meta.animated && (
            <>
              <Button onClick={() => setPlaying((value) => !value)} title="Play / pause (Space)">
                {playing ? 'Pause' : 'Play'}
              </Button>
              <input
                type="range"
                aria-label="Loop position"
                className="rs-range w-32"
                min={0}
                max={0.999}
                step={0.001}
                value={t}
                onChange={(event) => {
                  setPlaying(false)
                  setT(Number(event.target.value))
                }}
              />
              <span className="meta tabular-nums w-10">{t.toFixed(2)}</span>
            </>
          )}

          <div className="ml-auto flex items-center gap-3">
            {slot?.({ params, t })}
          </div>
        </div>

        <div className="rule border-t hidden md:flex items-center gap-4 px-4 h-8 shrink-0 overflow-x-auto">
          {SHORTCUT_HINTS.map(([key, label]) => (
            <span key={key} className="meta whitespace-nowrap">
              <span className="text-[var(--text)]">{key}</span> {label}
            </span>
          ))}
        </div>
      </main>
    </div>
  )
}
