'use client'

import { clamp, cubicBezier } from '@rareshape/core'
import type { Curve, CurveDef } from '@rareshape/schema'
import { Field, useDrag, type DragBind } from '../primitives'

const PRESETS: Array<{ name: string; value: Curve }> = [
  { name: 'Linear', value: [0, 0, 1, 1] },
  { name: 'Ease out', value: [0.16, 1, 0.3, 1] },
  { name: 'Ease in', value: [0.5, 0, 0.9, 0.4] },
  { name: 'S', value: [0.65, 0, 0.35, 1] },
]

/** `curve`. A cubic-bezier editor — the same four numbers CSS uses. */
export function CurveControl({
  name,
  def,
  value,
  onChange,
}: {
  name: string
  def: CurveDef
  value: Curve
  onChange: (value: Curve) => void
}) {
  const [x1, y1, x2, y2] = value
  // The pad is 0..1 across and -0.5..1.5 down, so overshoot stays reachable.
  const toY = (v: number) => (1.5 - v) / 2
  const fromY = (v: number) => 1.5 - v * 2

  const grab = (index: 0 | 1) => (x: number, y: number) => {
    const px = clamp(x, 0, 1)
    const py = clamp(fromY(y), -0.5, 1.5)
    onChange(index === 0 ? [px, py, x2, y2] : [x1, y1, px, py])
  }

  const first = useDrag(grab(0))
  const second = useDrag(grab(1))
  const id = `p-${name}`

  const ease = cubicBezier(x1, y1, x2, y2)
  const path = Array.from({ length: 33 }, (_, i) => {
    const t = i / 32
    return `${i === 0 ? 'M' : 'L'}${(t * 100).toFixed(2)} ${(toY(ease(t)) * 100).toFixed(2)}`
  }).join('')

  return (
    <Field label={def.label} hint={def.hint} value={value.map((v) => v.toFixed(2)).join(' ')}>
      <div className="relative w-full aspect-[3/2] rule border">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          <line x1="0" y1={toY(0) * 100} x2="100" y2={toY(0) * 100} stroke="var(--line)" strokeWidth="0.6" />
          <line x1="0" y1={toY(1) * 100} x2="100" y2={toY(1) * 100} stroke="var(--line)" strokeWidth="0.6" />
          <line
            x1="0"
            y1={toY(0) * 100}
            x2={x1 * 100}
            y2={toY(y1) * 100}
            stroke="var(--faint)"
            strokeWidth="0.6"
          />
          <line
            x1="100"
            y1={toY(1) * 100}
            x2={x2 * 100}
            y2={toY(y2) * 100}
            stroke="var(--faint)"
            strokeWidth="0.6"
          />
          <path d={path} fill="none" stroke="var(--text)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </svg>

        <Handle bind={first} x={x1} y={toY(y1)} label={`${def.label} first handle`} id={id} />
        <Handle bind={second} x={x2} y={toY(y2)} label={`${def.label} second handle`} />
      </div>

      <div className="flex flex-wrap gap-1 mt-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            onClick={() => onChange(preset.value)}
            className="rule border px-1.5 py-0.5 meta hover:text-[var(--text)] hover:border-[var(--faint)]"
          >
            {preset.name}
          </button>
        ))}
      </div>
    </Field>
  )
}

function Handle({
  bind,
  x,
  y,
  label,
  id,
}: {
  bind: DragBind
  x: number
  y: number
  label: string
  id?: string
}) {
  return (
    <div {...bind} id={id} className="absolute inset-0 touch-none">
      <span
        aria-hidden="true"
        title={label}
        className="absolute w-2 h-2 -ml-1 -mt-1 bg-[var(--text)] cursor-grab active:cursor-grabbing"
        style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
      />
    </div>
  )
}
