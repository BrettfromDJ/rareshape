'use client'

import type { IntDef, NumberDef } from '@rareshape/schema'
import { Field, ValueInput } from '../primitives'

/** `number` and `int`. Native range for free keyboard support, plus a field. */
export function SliderControl({
  name,
  def,
  value,
  onChange,
}: {
  name: string
  def: NumberDef | IntDef
  value: number
  onChange: (value: number) => void
}) {
  const step = def.step ?? (def.type === 'int' ? 1 : (def.max - def.min) / 100)
  const id = `p-${name}`

  return (
    <Field
      label={def.label}
      htmlFor={id}
      hint={def.hint}
      value={
        <ValueInput
          value={value}
          onChange={onChange}
          min={def.min}
          max={def.max}
          step={step}
          suffix={def.unit}
          ariaLabel={`${def.label} value`}
        />
      }
    >
      <input
        id={id}
        type="range"
        className="rs-range w-full"
        min={def.min}
        max={def.max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </Field>
  )
}
