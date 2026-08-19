'use client'

import type { IntDef, NumberDef } from '@rareshape/schema'
import { Field, NumberInput } from '../primitives'

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
      value={`${format(value)}${def.unit ? ` ${def.unit}` : ''}`}
    >
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="range"
          className="rs-range flex-1"
          min={def.min}
          max={def.max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <div className="w-[4.5rem] shrink-0">
          <NumberInput
            value={value}
            onChange={onChange}
            min={def.min}
            max={def.max}
            step={step}
            ariaLabel={`${def.label} value`}
          />
        </div>
      </div>
    </Field>
  )
}

const format = (v: number) => (Number.isInteger(v) ? String(v) : String(Number(v.toFixed(4))))
