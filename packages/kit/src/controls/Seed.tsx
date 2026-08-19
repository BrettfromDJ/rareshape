'use client'

import type { SeedDef } from '@rareshape/schema'
import { Button, Field, ValueInput } from '../primitives'

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
    <Field
      label={def.label}
      htmlFor={id}
      hint={def.hint}
      value={
        <ValueInput
          id={id}
          value={value}
          onChange={onChange}
          min={0}
          step={1}
          ariaLabel={def.label}
        />
      }
    >
      <Button onClick={() => onChange(value + 1)} title="Next seed" className="w-full">
        Next seed
      </Button>
    </Field>
  )
}
