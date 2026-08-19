'use client'

import type { BooleanDef } from '@rareshape/schema'
import { Field } from '../primitives'

export function SwitchControl({
  name,
  def,
  value,
  onChange,
}: {
  name: string
  def: BooleanDef
  value: boolean
  onChange: (value: boolean) => void
}) {
  const id = `p-${name}`
  return (
    <Field label={def.label} htmlFor={id} hint={def.hint}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className="rule border w-10 h-5 relative transition-colors hover:border-[var(--faint)]"
      >
        <span
          className="absolute top-0.5 bottom-0.5 w-4 bg-[var(--text)] transition-[left] duration-150"
          style={{ left: value ? 'calc(100% - 1.125rem)' : '0.125rem' }}
        />
        <span className="sr-only">{value ? 'On' : 'Off'}</span>
      </button>
    </Field>
  )
}
