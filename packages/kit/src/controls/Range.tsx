'use client'

import type { RangeDef, Span } from '@rareshape/schema'
import { Field } from '../primitives'

/** `range`. Two native thumbs on one track — keyboard reachable, no library. */
export function RangeControl({
  name,
  def,
  value,
  onChange,
}: {
  name: string
  def: RangeDef
  value: Span
  onChange: (value: Span) => void
}) {
  const step = def.step ?? (def.max - def.min) / 100
  const [lo, hi] = value
  const pct = (v: number) => ((v - def.min) / (def.max - def.min || 1)) * 100

  return (
    <Field label={def.label} hint={def.hint} value={`${trim(lo)} – ${trim(hi)}`}>
      <div className="relative h-6 flex items-center">
        <div className="absolute inset-x-0 h-px bg-[var(--line)]" />
        <div
          className="absolute h-px bg-[var(--text)]"
          style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }}
        />
        <input
          id={`p-${name}`}
          type="range"
          aria-label={`${def.label} minimum`}
          className="rs-range rs-range-overlay"
          min={def.min}
          max={def.max}
          step={step}
          value={lo}
          onChange={(e) => onChange([Math.min(Number(e.target.value), hi), hi])}
        />
        <input
          type="range"
          aria-label={`${def.label} maximum`}
          className="rs-range rs-range-overlay"
          min={def.min}
          max={def.max}
          step={step}
          value={hi}
          onChange={(e) => onChange([lo, Math.max(Number(e.target.value), lo)])}
        />
      </div>
    </Field>
  )
}

const trim = (v: number) => String(Number(v.toFixed(4)))
