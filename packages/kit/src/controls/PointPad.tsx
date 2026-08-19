'use client'

import { clamp } from '@rareshape/core'
import type { Point, PointDef } from '@rareshape/schema'
import { Field, useDrag } from '../primitives'

export function PointControl({
  name,
  def,
  value,
  onChange,
}: {
  name: string
  def: PointDef
  value: Point
  onChange: (value: Point) => void
}) {
  const { ref, onPointerDown } = useDrag((x, y) => onChange({ x, y }))
  const nudge = (dx: number, dy: number) =>
    onChange({ x: clamp(value.x + dx, 0, 1), y: clamp(value.y + dy, 0, 1) })

  return (
    <Field
      label={def.label}
      hint={def.hint}
      value={`${value.x.toFixed(2)}, ${value.y.toFixed(2)}`}
    >
      <div
        id={`p-${name}`}
        ref={ref}
        onPointerDown={onPointerDown}
        role="application"
        tabIndex={0}
        aria-label={`${def.label} position`}
        onKeyDown={(e) => {
          const s = e.shiftKey ? 0.1 : 0.01
          if (e.key === 'ArrowLeft') nudge(-s, 0)
          else if (e.key === 'ArrowRight') nudge(s, 0)
          else if (e.key === 'ArrowUp') nudge(0, -s)
          else if (e.key === 'ArrowDown') nudge(0, s)
          else return
          e.preventDefault()
        }}
        className="relative w-full aspect-square max-w-[9rem] rule border touch-none cursor-crosshair"
      >
        <span className="absolute inset-x-0 top-1/2 h-px bg-[var(--line)]" />
        <span className="absolute inset-y-0 left-1/2 w-px bg-[var(--line)]" />
        <span
          className="absolute w-2 h-2 -ml-1 -mt-1 bg-[var(--text)]"
          style={{ left: `${value.x * 100}%`, top: `${value.y * 100}%` }}
        />
      </div>
    </Field>
  )
}
