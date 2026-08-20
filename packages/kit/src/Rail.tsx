'use client'

import { useMemo } from 'react'
import type { ParamSchema, ParamsOf, Store, Tool } from '@rareshape/schema'
import { isVisible } from '@rareshape/schema'
import { AspectBar } from './AspectBar'
import { Control } from './controls'
import { Button } from './primitives'

/**
 * The left rail. Every control in it is generated from the schema — the rail
 * has no knowledge of any individual tool.
 */
export function Rail<S extends ParamSchema>({
  tool,
  store,
  params,
  onCopyLink,
  copied,
  aspect,
  onAspectChange,
  colorsLocked,
  onColorsLockedChange,
}: {
  tool: Tool<S>
  store: Store<S>
  params: ParamsOf<S>
  onCopyLink: () => void
  copied: boolean
  /** Stage shape. Not a param, but it belongs with the settings, not the output. */
  aspect: string
  onAspectChange: (aspect: string) => void
  /** Whether Randomize leaves the color scheme where it is. */
  colorsLocked: boolean
  onColorsLockedChange: (locked: boolean) => void
}) {
  const groups = useMemo(() => {
    const out = new Map<string, string[]>()
    for (const [name, def] of Object.entries(tool.params)) {
      const group = def.group ?? 'Parameters'
      const list = out.get(group) ?? []
      list.push(name)
      out.set(group, list)
    }
    return [...out.entries()]
  }, [tool])

  const record = params as Record<string, unknown>

  // Re-rolling colors belongs beside the colors themselves, not in the row
  // of global actions. It lands on the group holding the palette, or failing
  // that the first group with a color in it.
  const colorGroup = (() => {
    const entries = Object.values(tool.params).filter((def) => def.randomize !== false)
    const palette = entries.find((def) => def.type === 'palette')
    const color = palette ?? entries.find((def) => def.type === 'color')
    return color ? (color.group ?? 'Parameters') : null
  })()

  return (
    <aside className="rule border-b lg:border-b-0 lg:border-r w-full lg:w-[19rem] shrink-0 bg-[var(--surface)] overflow-y-auto overscroll-contain">
      <div className="px-4 py-3 rule border-b sticky top-0 bg-[var(--surface)] z-10">
        <h1 className="text-[var(--text)] text-[length:var(--text-md)] font-normal leading-tight">
          {tool.meta.name}
        </h1>
        {/* The tagline is a sentence, so it is set as one — not as metadata. */}
        <p className="rs-hint mt-1 max-w-[32ch]">{tool.meta.tagline}</p>
      </div>

      <div className="px-4 py-3 rule border-b flex flex-wrap gap-1">
        <Button
          onClick={() => store.randomize({ keepColors: colorsLocked })}
          title="Randomize (R)"
        >
          Randomize
        </Button>
        {/* Next to the button it modifies, which is where someone who has just
            landed on a scheme they like goes looking for it. */}
        <Button
          active={colorsLocked}
          onClick={() => onColorsLockedChange(!colorsLocked)}
          title="Keep the current colors when you randomize everything else"
        >
          Lock colors
        </Button>
        <Button onClick={() => store.undo()} disabled={!store.canUndo()} title="Undo (Z)">
          Undo
        </Button>
        <Button onClick={() => store.redo()} disabled={!store.canRedo()} title="Redo (⇧Z)">
          Redo
        </Button>
        <Button onClick={() => store.reset()} disabled={store.isDefault()} title="Reset (0)">
          Reset
        </Button>
        <Button onClick={onCopyLink} title="Copy link (C)">
          {copied ? 'Copied' : 'Copy link'}
        </Button>
      </div>

      {/* Shape comes before anything you would draw into it, and it is a
          setting rather than a property of the output — so it sits here with
          the other settings, not down beside the export button. */}
      <div className="px-4 py-3 rule border-b">
        <div className="rs-label mb-2">Aspect</div>
        <AspectBar value={aspect} fallback={tool.meta.aspect} onChange={onAspectChange} />
      </div>

      {tool.presets.length > 0 && (
        <div className="px-4 py-3 rule border-b">
          <div className="rs-label mb-2">Presets</div>
          <div className="flex flex-wrap gap-1">
            {tool.presets.map((preset) => (
              <Button key={preset.name} onClick={() => store.loadPreset(preset.name)}>
                {preset.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {groups.map(([group, names]) => {
        const visible = names.filter((name) => isVisible(tool.params[name]!, record))
        if (visible.length === 0) return null
        return (
          <section key={group}>
            {/* A heavier rule and more air above mark a new section; the
                heading itself is brighter and more widely spaced than the
                control labels under it. */}
            {/* Pulled up a pixel so the section rule replaces the last field's
                hairline instead of sitting beside it as a double line. */}
            <div className="flex items-center justify-between gap-3 px-4 pt-6 pb-3 -mt-px rule border-t border-[var(--faint)]">
              <h2 className="rs-section">{group}</h2>
              {group === colorGroup && (
                <Button
                  onClick={() => store.randomizeColors()}
                  title="Randomize colors (⇧R)"
                  className="py-0.5"
                >
                  Randomize
                </Button>
              )}
            </div>
            {visible.map((name) => (
              <Control
                key={name}
                name={name}
                def={tool.params[name]!}
                value={record[name]}
                onChange={(value) => store.set(name as keyof S & string, value as never)}
              />
            ))}
          </section>
        )
      })}
    </aside>
  )
}
