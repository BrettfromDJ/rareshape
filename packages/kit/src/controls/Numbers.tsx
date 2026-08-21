'use client'

import type { NumbersDef } from '@rareshape/schema'
import { Field, ValueInput } from '../primitives'

/**
 * `numbers`. A list you add to and remove from, the way a palette works — one
 * row per entry so each one can be read and set on its own, rather than a
 * single field holding comma-separated values nobody can aim at.
 *
 * The list is short by design: it cycles when the tool draws more things than
 * there are entries, so three values across nine slabs repeats every three.
 */
export function NumbersControl({
  name,
  def,
  value,
  onChange,
}: {
  name: string
  def: NumbersDef
  value: number[]
  onChange: (value: number[]) => void
}) {
  const step = def.step ?? (def.max - def.min) / 100
  const minCount = def.minCount ?? 1
  const maxCount = def.maxCount ?? 8

  const setAt = (index: number, entry: number) =>
    onChange(value.map((current, i) => (i === index ? entry : current)))

  return (
    <Field label={def.label} hint={def.hint} value={`${value.length}`}>
      <div id={`p-${name}`} className="space-y-1">
        {value.map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="range"
              aria-label={`${def.label} ${index + 1}`}
              className="rs-range flex-1 min-w-0"
              min={def.min}
              max={def.max}
              step={step}
              value={entry}
              onChange={(event) => setAt(index, Number(event.target.value))}
            />
            <ValueInput
              value={entry}
              onChange={(next) => setAt(index, next)}
              min={def.min}
              max={def.max}
              step={step}
              suffix={def.unit}
              ariaLabel={`${def.label} ${index + 1} value`}
            />
            {value.length > minCount && (
              <button
                type="button"
                aria-label={`Remove ${def.label} ${index + 1}`}
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                className="meta w-4 shrink-0 hover:text-[var(--text)]"
              >
                ×
              </button>
            )}
          </div>
        ))}

        {value.length < maxCount && (
          <button
            type="button"
            onClick={() => onChange([...value, value[value.length - 1] ?? def.min])}
            aria-label={`Add a ${def.label} entry`}
            className="w-6 h-5 rule border meta hover:border-[var(--faint)] hover:text-[var(--text)]"
          >
            +
          </button>
        )}
      </div>
    </Field>
  )
}
