'use client'

import { parseColor, toHex } from '@rareshape/core'
import type { ColorDef, PaletteDef } from '@rareshape/schema'
import { Field, TextInput } from '../primitives'

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
  const id = `p-${name}`
  const rgba = parseColor(value)
  const solid = toHex({ ...rgba, a: 1 }, false)

  return (
    <Field label={def.label} htmlFor={id} hint={def.hint}>
      <div className="flex items-center gap-2">
        <span className="relative w-6 h-6 shrink-0 rule border rs-checker">
          <span className="absolute inset-0" style={{ background: value }} />
          <input
            id={id}
            type="color"
            aria-label={def.label}
            value={solid}
            onChange={(e) =>
              onChange(def.alpha ? toHex({ ...parseColor(e.target.value), a: rgba.a }) : e.target.value)
            }
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </span>
        <div className="flex-1">
          <TextInput
            value={value}
            mono
            ariaLabel={`${def.label} hex`}
            onChange={(next) => onChange(next.startsWith('#') ? next : `#${next}`)}
          />
        </div>
      </div>
      {def.alpha && (
        <div className="flex items-center gap-2 mt-2">
          <span className="meta w-10 shrink-0">Alpha</span>
          <input
            type="range"
            aria-label={`${def.label} alpha`}
            className="rs-range flex-1"
            min={0}
            max={1}
            step={0.01}
            value={rgba.a}
            onChange={(e) => onChange(toHex({ ...rgba, a: Number(e.target.value) }, true))}
          />
          <span className="font-mono text-[var(--text-xs)] tabular-nums w-8 text-right">
            {rgba.a.toFixed(2)}
          </span>
        </div>
      )}
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

  const setAt = (index: number, color: string) =>
    onChange(value.map((c, i) => (i === index ? color : c)))

  return (
    <Field label={def.label} hint={def.hint} value={`${value.length}`}>
      <div className="flex flex-wrap gap-1" id={`p-${name}`}>
        {value.map((color, index) => (
          <span key={`${index}-${color}`} className="relative w-6 h-6 rule border group">
            <span className="absolute inset-0" style={{ background: color }} />
            <input
              type="color"
              aria-label={`${def.label} swatch ${index + 1}`}
              value={toHex({ ...parseColor(color), a: 1 }, false)}
              onChange={(e) => setAt(index, e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            {value.length > min && (
              <button
                type="button"
                aria-label={`Remove swatch ${index + 1}`}
                onClick={() => onChange(value.filter((_, i) => i !== index))}
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
    </Field>
  )
}
