'use client'

import type { TextDef } from '@rareshape/schema'
import { Field, TextInput } from '../primitives'

export function TextControl({
  name,
  def,
  value,
  onChange,
}: {
  name: string
  def: TextDef
  value: string
  onChange: (value: string) => void
}) {
  const id = `p-${name}`
  return (
    <Field label={def.label} htmlFor={id} hint={def.hint}>
      <TextInput
        id={id}
        value={value}
        onChange={onChange}
        placeholder={def.placeholder}
        maxLength={def.maxLength}
      />
    </Field>
  )
}
