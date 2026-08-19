'use client'

import type { SeedDef } from '@rareshape/schema'
import { Button, Field, NumberInput } from '../primitives'

/** `seed`. The dice steps the seed forward — deterministic, not random. */
export function SeedControl({
  name,
  def,
  value,
  onChange,
}: {
  name: string
  def: SeedDef
  value: number
  onChange: (value: number) => void
}) {
  const id = `p-${name}`
  return (
    <Field label={def.label} htmlFor={id} hint={def.hint}>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <NumberInput id={id} value={value} onChange={onChange} min={0} step={1} ariaLabel={def.label} />
        </div>
        <Button onClick={() => onChange(value + 1)} title="Next seed">
          Next
        </Button>
      </div>
    </Field>
  )
}
