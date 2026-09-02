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
  token: 'token',
  'round-complete': 'round',
  winner: 'winner',
  'time-up': 'expired',
  tiebreak: 'steal',
}

const CONFETTI: ReadonlySet<EventType> = new Set<EventType>(['correct', 'winner', 'token'])
const GOLD = ['#ffc531', '#fff5dc', '#e0a100', '#ffe08a']

const VERDICT: ReadonlySet<EventType> = new Set<EventType>(['correct', 'incorrect'])

function flashColor(game: GameState): string | null {
  const current = game.lastEvent
  if (!current) return null
  if (current.type === 'correct') return 'var(--bee-green)'
  if (current.type === 'winner') {
    const team = teamById(game, current.teamId)
    return team ? teamColor(team.color).bg : 'var(--bee-gold)'
  }
  if (current.type === 'incorrect' || current.type === 'time-up') return 'var(--bee-red)'
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
  }, [game.lastEvent, sound])

  const current = game.lastEvent
  const fresh = current && current.id !== initialId ? current : null
  const color = fresh ? flashColor(game) : null
  const tokenTeam = fresh?.type === 'token' ? teamById(game, fresh.teamId) : undefined

  return (
    <>
      <Confetti burst={fresh && CONFETTI.has(fresh.type) ? fresh.id : ''} rain={rain} colors={fresh?.type === 'token' ? GOLD : undefined} />
      {fresh?.type === 'token' && (
        <div key={`${fresh.id}-takeover`} className="bee-takeover" aria-hidden="true">
          <div className="bee-takeover-stack">
            <div className="bee-takeover-coin">2×</div>
            <div className="bee-takeover-title">Double Word!</div>
            <div className="bee-takeover-sub">{tokenTeam ? `${tokenTeam.name} bets it all` : 'Double or nothing'}</div>
          </div>
        </div>
      )}
      {fresh && color && <div key={`${fresh.id}-flash`} className={`bee-flash ${VERDICT.has(fresh.type) ? 'bee-flash-verdict' : ''}`} style={{ background: color }} />}
    </>
  )
}
