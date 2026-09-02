'use client'

import { teamColor } from '../_lib/defaults'
import { gameStats, teamById, type GameStats } from '../_lib/engine'
import { formatDuration, formatPoints } from '../_lib/format'
import type { GameState, LogEntry } from '../_lib/types'
import { TeamSwatch } from './ui'

function describe(game: GameState, entry: LogEntry): string {
  const team = teamById(game, entry.teamId)?.name ?? 'A team'
  switch (entry.kind) {
    case 'turn':
      return `${entry.playerName ?? team} ${entry.outcome === 'correct' ? 'spelled' : 'missed'} “${entry.word ?? '?'}”${entry.doubled ? ' on a Double Word' : ''}${entry.distraction ? ` while: ${entry.distraction.toLowerCase()}` : ''}`
    case 'steal':
      return `${team} ${entry.outcome === 'correct' ? 'stole' : 'failed to steal'} “${entry.word ?? '?'}” from ${teamById(game, entry.fromTeamId)?.name ?? 'another team'}`
    case 'skip':
      return `${entry.playerName ?? team} skipped${entry.word ? ` “${entry.word}”` : ' a word'}`
    case 'adjust':
      return `${team}: ${entry.text ?? 'manual adjustment'}`
    case 'tiebreak':
      return `${team} ${entry.outcome === 'correct' ? 'got' : 'missed'} tiebreaker word “${entry.word ?? '?'}”`
    case 'token':
      return `${entry.playerName ?? team} activated the Double Word token`
    default:
      return entry.text ?? ''
  }
}

/** Every scoring action of the game, newest first. */
export function HistoryList({ game, limit }: { game: GameState; limit?: number }) {
  const entries = [...game.log].reverse().slice(0, limit ?? game.log.length)
  if (entries.length === 0) return <p className="bee-hint">Nothing has happened yet.</p>
  return (
    <ol className="flex flex-col gap-2">
      {entries.map((entry) => {
        const team = teamById(game, entry.teamId)
        const round = game.rounds[entry.roundIndex]
        const tone =
          entry.outcome === 'correct' ? 'var(--bee-green)' : entry.outcome === 'incorrect' ? 'var(--bee-red-soft)' : 'var(--bee-dim)'
        return (
          <li key={entry.id} className="bee-card-flat flex items-center gap-3 px-3 py-2 text-base">
            {team && <TeamSwatch team={team} size="sm" />}
            <span className="flex-1 min-w-0">
              <span className="block truncate">{describe(game, entry)}</span>
              <span className="bee-hint text-xs">{round?.name ?? 'Tiebreaker'}</span>
            </span>
            <span className="bee-score text-2xl bee-tabular" style={{ color: entry.points === 0 ? tone : entry.points > 0 ? 'var(--bee-green)' : 'var(--bee-red-soft)' }}>
              {entry.kind === 'token' ? '2×' : formatPoints(entry.points)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/** Rendered only on paper: the results screen's printable summary. */
export function PrintSummary({ game, stats }: { game: GameState; stats?: GameStats }) {
  const data = stats ?? gameStats(game)
  const winner = teamById(game, game.winnerId)
  return (
    <div className="bee-print">
      <h1>{game.settings.eventName}</h1>
      <p>
        {game.endedAt ? new Date(game.endedAt).toLocaleString() : ''}
        {data.durationMs ? ` · ${formatDuration(data.durationMs)}` : ''}
      </p>
      {winner && (
        <p>
          <strong>{game.settings.trophyTitle}:</strong> {winner.name} ({winner.players.join(', ') || 'no players listed'})
        </p>
      )}

      <h2>Final standings</h2>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Team</th>
            <th>Players</th>
            <th>Score</th>
            <th>Correct</th>
            <th>Missed</th>
            <th>Accuracy</th>
            <th>Token left</th>
          </tr>
        </thead>
        <tbody>
          {data.teams.map((row) => (
            <tr key={row.team.id}>
              <td>{row.rank}</td>
              <td>
                <span className="swatch" style={{ background: teamColor(row.team.color).bg }} />
                {row.team.name}
              </td>
              <td>{row.team.players.join(', ')}</td>
              <td>{row.score}</td>
              <td>{row.correct}</td>
              <td>{row.incorrect}</td>
              <td>{row.accuracy === null ? '—' : `${Math.round(row.accuracy * 100)}%`}</td>
              <td>{row.tokenLeft ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Highlights</h2>
      <ul>
        <li>
          Total: {data.totalCorrect} correct, {data.totalIncorrect} missed
        </li>
        {data.hardestWord && (
          <li>
            Hardest word spelled: “{data.hardestWord.word}” ({data.hardestWord.difficulty}) by {data.hardestWord.team.name}
          </li>
        )}
        {data.mostMissed && (
          <li>
            Most missed word: “{data.mostMissed.word}” ({data.mostMissed.misses}×)
          </li>
        )}
        {data.biggestSteal && (
          <li>
            Biggest steal: {data.biggestSteal.team.name} took “{data.biggestSteal.word}” from {data.biggestSteal.from.name} for {data.biggestSteal.points}
          </li>
        )}
        <li>Unused Double Word tokens: {data.tokensLeft.length ? data.tokensLeft.map((team) => team.name).join(', ') : 'none'}</li>
      </ul>

      <h2>Every turn</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Round</th>
            <th>Team</th>
            <th>What happened</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {game.log.map((entry, index) => (
            <tr key={entry.id}>
              <td>{index + 1}</td>
              <td>{game.rounds[entry.roundIndex]?.name ?? 'Tiebreaker'}</td>
              <td>{teamById(game, entry.teamId)?.name ?? ''}</td>
              <td>{describe(game, entry)}</td>
              <td>{entry.kind === 'token' ? '' : formatPoints(entry.points)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
