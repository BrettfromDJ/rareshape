'use client'

import { parseAspect } from '@rareshape/core'
import { Button } from './primitives'

/** The shapes worth one click. Anything else is typed into the export sheet. */
export const ASPECT_PRESETS = ['1:1', '4:5', '3:2', '16:9', '9:16'] as const

/**
 * Stage shape. It is not a tool param — no render function should know or care
 * what it is drawing into — but it is part of the state a link carries, so it
 * round-trips through the URL alongside the params.
 */
export function AspectBar({
  value,
  fallback,
  onChange,
}: {
  value: string
  /** The tool's own aspect, offered first when it is not already a preset. */
  fallback: string
  onChange: (aspect: string) => void
}) {
  const options = ASPECT_PRESETS.includes(fallback as (typeof ASPECT_PRESETS)[number])
    ? [...ASPECT_PRESETS]
    : [fallback, ...ASPECT_PRESETS]

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Stage aspect">
      <span className="rs-label mr-1 hidden sm:inline">Aspect</span>
      {options.map((option) => (
        <Button
          key={option}
          active={parseAspect(option) === parseAspect(value)}
          onClick={() => onChange(option)}
          title={`${option}${option === fallback ? ' — the tool’s own shape' : ''}`}
        >
          {option}
        </Button>
      ))}
    </div>
  )
}
