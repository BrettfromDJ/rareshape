'use client'

import { mod } from '@rareshape/core'
import type { AngleDef } from '@rareshape/schema'
import { Field, NumberInput, useDrag } from '../primitives'

export function AngleControl({
  name,
  def,
  value,
  onChange,
}: {
  name: string
  def: AngleDef
  value: number
  onChange: (value: number) => void
}) {
  const step = def.step ?? 1
  const { ref, onPointerDown } = useDrag((x, y) => {
    const angle = (Math.atan2(y - 0.5, x - 0.5) * 180) / Math.PI
    onChange(Math.round(mod(angle, 360) / step) * step)
  })

  const radians = (value * Math.PI) / 180

  return (
    <Field label={def.label} hint={def.hint} value={`${Math.round(mod(value, 360))}°`}>
      <div className="flex items-center gap-3">
        <div
          id={`p-${name}`}
          ref={ref}
          onPointerDown={onPointerDown}
          role="slider"
          tabIndex={0}
          aria-label={def.label}
          aria-valuenow={Math.round(mod(value, 360))}
          aria-valuemin={0}
          aria-valuemax={360}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange(value - step)
            else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange(value + step)
            else return
            e.preventDefault()
          }}
          className="w-10 h-10 rule border relative cursor-grab active:cursor-grabbing touch-none shrink-0"
        >
          <span
            className="absolute left-1/2 top-1/2 h-px w-[45%] bg-[var(--text)] origin-left"
            style={{ transform: `rotate(${radians}rad)` }}
          />
        </div>
        <div className="flex-1">
          <NumberInput value={value} onChange={onChange} step={step} ariaLabel={`${def.label} degrees`} />
        </div>
      </div>
    </Field>
  )
}
