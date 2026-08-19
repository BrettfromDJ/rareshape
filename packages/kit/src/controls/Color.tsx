'use client'

import { useState } from 'react'
import type { ColorDef, PaletteDef } from '@rareshape/schema'
import { Field } from '../primitives'
import { ColorPicker, Swatch, useEscape } from './ColorPicker'

export function ColorControl({
  name,
  def,
  value,
  onChange,
}: {
  name: string
  def: ColorDef
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  useEscape(open, () => setOpen(false))

  return (
    <Field label={def.label} hint={def.hint} value={value.toUpperCase()}>
      <div id={`p-${name}`}>
        <Swatch
          value={value}
          open={open}
          label={`${def.label} — ${open ? 'close' : 'open'} the picker`}
          onToggle={() => setOpen((current) => !current)}
        />
        {open && (
          <ColorPicker
            value={value}
            onChange={onChange}
            alpha={def.alpha === true}
            label={def.label}
            onClose={() => setOpen(false)}
          />
        )}
      </div>
    </Field>
  )
}

export function PaletteControl({
  name,
  def,
  value,
  onChange,
}: {
  name: string
  def: PaletteDef
  value: string[]
  onChange: (value: string[]) => void
}) {
  const min = def.min ?? 1
  const max = def.max ?? 8
  const [editing, setEditing] = useState<number | null>(null)
  useEscape(editing !== null, () => setEditing(null))

  const setAt = (index: number, color: string) =>
    onChange(value.map((entry, i) => (i === index ? color : entry)))

  return (
    <Field label={def.label} hint={def.hint} value={`${value.length}`}>
      <div id={`p-${name}`}>
        <div className="flex flex-wrap gap-1">
          {value.map((color, index) => (
            <span key={`${index}-${color}`} className="relative group">
              <Swatch
                value={color}
                open={editing === index}
                label={`${def.label} swatch ${index + 1}`}
                onToggle={() => setEditing(editing === index ? null : index)}
              />
              {value.length > min && (
                <button
                  type="button"
                  aria-label={`Remove swatch ${index + 1}`}
                  onClick={() => {
                    setEditing(null)
                    onChange(value.filter((_, i) => i !== index))
                  }}
                  className="absolute -top-1 -right-1 w-3 h-3 bg-[var(--bg)] rule border text-[8px] leading-none opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                >
                  ×
                </button>
              )}
            </span>
          ))}

          {value.length < max && (
            <button
              type="button"
              onClick={() => onChange([...value, value[value.length - 1] ?? '#ffffff'])}
              aria-label={`Add a ${def.label} swatch`}
              className="w-6 h-6 rule border meta hover:border-[var(--faint)] hover:text-[var(--text)]"
            >
              +
            </button>
          )}
        </div>

        {editing !== null && value[editing] !== undefined && (
          <ColorPicker
            value={value[editing] as string}
            onChange={(color) => setAt(editing, color)}
            label={`${def.label} swatch ${editing + 1}`}
            onClose={() => setEditing(null)}
          />
        )}
      </div>
    </Field>
  )
}
