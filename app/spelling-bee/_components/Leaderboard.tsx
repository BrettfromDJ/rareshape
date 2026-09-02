'use client'

import { teamColor } from '../_lib/defaults'
import { standings } from '../_lib/engine'
import type { GameState } from '../_lib/types'
import { TeamSwatch, Token } from './ui'

/**
 * Live rankings. Rows are absolutely positioned and slide to their rank with a
 * transform, so a lead change is one calm movement rather than a reshuffle.
 */
export function Leaderboard({
  game,
  size = 'md',
  activeTeamId = null,
  showPlayers = true,
}: {
  game: GameState
  size?: 'md' | 'lg'
  activeTeamId?: string | null
  showPlayers?: boolean
}) {
  const rows = standings(game)
  const rowHeight = size === 'lg' ? (showPlayers ? 108 : 84) : showPlayers ? 84 : 66
  const gap = 10
  const byId = new Map(rows.map((row, index) => [row.team.id, { ...row, index }]))

  return (
    <div className="bee-board" style={{ height: rows.length * (rowHeight + gap) - gap }} aria-label="Leaderboard" role="list">
      {game.teams.map((team) => {
        const row = byId.get(team.id)
        if (!row) return null
        const color = teamColor(team.color)
        const taken = new Set(game.turnsTaken[team.id] ?? [])
        const active = team.id === activeTeamId
        return (
          <div
            key={team.id}
            role="listitem"
            className="bee-board-row"
            style={{ transform: `translateY(${row.index * (rowHeight + gap)}px)` }}
          >
            <div
              className="flex items-center gap-3 md:gap-4 rounded-2xl border-[3px] px-3 md:px-4"
              style={{
                height: rowHeight,
                background: active ? color.bg : 'var(--bee-surface)',
                color: active ? color.fg : 'var(--bee-cream)',
                borderColor: active ? 'var(--bee-cream)' : 'var(--bee-ink)',
                boxShadow: '0 5px 0 var(--bee-ink)',
              }}
            >
              <span className="bee-rank" aria-label={`Rank ${row.rank}`}>
                {row.rank}
              </span>
              {!active && <TeamSwatch team={team} size={size === 'lg' ? 'lg' : 'md'} />}
              <div className="min-w-0 flex-1">
                <div className={`bee-display truncate ${size === 'lg' ? 'text-3xl md:text-4xl' : 'text-2xl'}`}>
                  {team.name}
                  {active && <span className="sr-only"> (spelling now)</span>}
                </div>
                {showPlayers && (
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-sm md:text-base leading-tight opacity-90 truncate">
                    {team.players.length === 0 && <span>No players listed</span>}
                    {team.players.map((player, index) => (
                      <span key={`${player}-${index}`} className={taken.has(index) ? 'opacity-70' : ''}>
                        {taken.has(index) ? '✓ ' : ''}
                        {player}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {game.settings.doubleWordEnabled && <Token available={Boolean(game.tokens[team.id])} size="sm" label={false} />}
              <span className={`bee-score ${size === 'lg' ? 'text-5xl md:text-6xl' : 'text-4xl'}`} aria-label={`${row.score} points`}>
                {row.score}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
