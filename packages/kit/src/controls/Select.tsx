'use client'

import type { SelectDef } from '@rareshape/schema'
import { Field } from '../primitives'

/** Segmented up to four options, dropdown past that. */
export function SelectControl({
  name,
  def,
  value,
  onChange,
}: {
  name: string
  def: SelectDef
  value: string
  onChange: (value: string) => void
}) {
  const id = `p-${name}`
  if (def.options.length > 4) {
    return (
      <Field label={def.label} htmlFor={id} hint={def.hint}>
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-[var(--bg)] rule border px-2 py-1 font-mono text-[var(--text-xs)] text-[var(--text)] outline-none focus:border-[var(--faint)]"
        >
          {def.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label ?? option.value}
            </option>
          ))}
        </select>
      </Field>
    )
  }

  return (
    <Field label={def.label} hint={def.hint}>
      <div className="flex rule border divide-x divide-[var(--line)]" role="radiogroup" aria-label={def.label}>
        {def.options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={option.value === value}
            onClick={() => onChange(option.value)}
            className={
              'flex-1 px-2 py-1 meta transition-colors ' +
              // The `.meta` class sets a colour of its own; the selected chip
              // has to win it, or the label sits at 3:1 on a light ground.
              (option.value === value
                ? 'bg-[var(--text)] text-[var(--bg)]!'
                : 'hover:text-[var(--text)]')
            }
          >
            {option.label ?? option.value}
          </button>
        ))}
      </div>
    </Field>
  )
}
