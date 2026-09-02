'use client'

import { useEffect, useRef, useState } from 'react'
import { teamColor } from '../_lib/defaults'
import { teamById } from '../_lib/engine'
import { playCue, type Cue } from '../_lib/sound'
import type { EventType, GameState } from '../_lib/types'
import { Confetti } from './Confetti'

const CUE_FOR: Partial<Record<EventType, Cue>> = {
  reveal: 'reveal',
  correct: 'correct',
  incorrect: 'incorrect',
  'steal-open': 'incorrect',
  'steal-won': 'correct',
  'steal-lost': 'incorrect',
  token: 'token',
  'round-complete': 'round',
  winner: 'winner',
  'time-up': 'expired',
  tiebreak: 'steal',
}

const CONFETTI: ReadonlySet<EventType> = new Set<EventType>(['correct', 'steal-won', 'winner'])

const VERDICT: ReadonlySet<EventType> = new Set<EventType>(['correct', 'steal-won', 'incorrect', 'steal-lost', 'steal-open'])

function flashColor(game: GameState): string | null {
  const current = game.lastEvent
  if (!current) return null
  if (current.type === 'correct' || current.type === 'steal-won') return 'var(--bee-green)'
  if (current.type === 'winner') {
    const team = teamById(game, current.teamId)
    return team ? teamColor(team.color).bg : 'var(--bee-gold)'
  }
  if (current.type === 'incorrect' || current.type === 'steal-lost' || current.type === 'time-up' || current.type === 'steal-open') return 'var(--bee-red)'
  if (current.type === 'token') return 'var(--bee-gold)'
  return null
}

/**
 * Reacts to the game's last event with a sound, a screen flash and confetti.
 * Mounted in whichever window should celebrate; each window decides its own
 * sound setting. The event present at mount is never replayed, so a refresh
 * stays quiet.
 */
export function Celebrations({ game, sound, rain = false }: { game: GameState; sound: boolean; rain?: boolean }) {
  const [initialId] = useState(() => game.lastEvent?.id ?? null)
  const played = useRef<string | null>(initialId)

  useEffect(() => {
    const current = game.lastEvent
    if (!current || played.current === current.id) return
    played.current = current.id
    const cue = CUE_FOR[current.type]
    if (cue) playCue(cue, !sound)
    if (current.type !== 'steal-open') return
    const timeout = window.setTimeout(() => playCue('steal', !sound), 650)
    return () => window.clearTimeout(timeout)
  }, [game.lastEvent, sound])

  const current = game.lastEvent
  const fresh = current && current.id !== initialId ? current : null
  const color = fresh ? flashColor(game) : null

  return (
    <>
      <Confetti burst={fresh && CONFETTI.has(fresh.type) ? fresh.id : ''} rain={rain} />
      {fresh && color && <div key={fresh.id} className={`bee-flash ${VERDICT.has(fresh.type) ? 'bee-flash-verdict' : ''}`} style={{ background: color }} />}
    </>
  )
}
