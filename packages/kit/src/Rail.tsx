'use client'

import { useMemo } from 'react'
import type { ParamSchema, ParamsOf, Store, Tool } from '@rareshape/schema'
import { isVisible } from '@rareshape/schema'
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
}: {
  tool: Tool<S>
  store: Store<S>
  params: ParamsOf<S>
  onCopyLink: () => void
  copied: boolean
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

  // Re-rolling colours belongs beside the colours themselves, not in the row
  // of global actions. It lands on the group holding the palette, or failing
  // that the first group with a colour in it.
  const colourGroup = (() => {
    const entries = Object.values(tool.params).filter((def) => def.randomize !== false)
    const palette = entries.find((def) => def.type === 'palette')
    const colour = palette ?? entries.find((def) => def.type === 'color')
    return colour ? (colour.group ?? 'Parameters') : null
  })()

  return (
    <aside className="rule border-b lg:border-b-0 lg:border-r w-full lg:w-[19rem] shrink-0 bg-[var(--surface)] overflow-y-auto overscroll-contain">
      <div className="px-4 py-3 rule border-b sticky top-0 bg-[var(--surface)] z-10">
        <h1 className="text-[var(--text)] text-[length:var(--text-md)] font-normal">{tool.meta.name}</h1>
        <p className="meta normal-case tracking-normal mt-1 text-[var(--dim)]">{tool.meta.tagline}</p>
      </div>

      <div className="px-4 py-3 rule border-b flex flex-wrap gap-1">
        <Button onClick={() => store.randomize()} title="Randomize (R)">
          Randomize
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

      {tool.presets.length > 0 && (
        <div className="px-4 py-3 rule border-b">
          <div className="meta mb-2">Presets</div>
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
            <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
              <h2 className="meta">{group}</h2>
              {group === colourGroup && (
                <Button
                  onClick={() => store.randomizeColours()}
                  title="Randomize colours (⇧R)"
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
