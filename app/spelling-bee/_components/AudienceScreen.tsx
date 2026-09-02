'use client'

import { useEffect, useState } from 'react'
import { teamColor } from '../_lib/defaults'
import { contestantName, currentRound, difficultyLabel, standings, teamById, upNext, wordById } from '../_lib/engine'
import { formatPoints, ordinal } from '../_lib/format'
import { useBee } from '../_lib/store'
import type { GameState, Team, Turn, Word } from '../_lib/types'
import { Leaderboard } from './Leaderboard'
import { TimerRing } from './TimerRing'
import { Pill, TeamChip, Token } from './ui'

/**
 * What the room sees: team, contestant, round, timer and scores. The word
 * itself appears only when the "show the word on the audience screen" rule
 * is on, only after the host reveals it, and never while a steal is open or
 * a tiebreaker is being written.
 */
export function AudienceScreen({
  game,
  onExit,
  soundOn,
  onToggleSound,
}: {
  game: GameState
  onExit?: () => void
  soundOn?: boolean
  onToggleSound?: () => void
}) {
  const [chromeVisible, setChromeVisible] = useState(true)

  // Controls fade after a few seconds of stillness so the TV shows only the show.
  useEffect(() => {
    let timeout = window.setTimeout(() => setChromeVisible(false), 4000)
    const wake = () => {
      setChromeVisible(true)
      window.clearTimeout(timeout)
      timeout = window.setTimeout(() => setChromeVisible(false), 4000)
    }
    window.addEventListener('mousemove', wake)
    window.addEventListener('keydown', wake)
    window.addEventListener('touchstart', wake)
    return () => {
      window.clearTimeout(timeout)
      window.removeEventListener('mousemove', wake)
      window.removeEventListener('keydown', wake)
      window.removeEventListener('touchstart', wake)
    }
  }, [])

  useEffect(() => {
    if (!onExit) return
    const onKey = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === 'Escape' || keyEvent.key.toLowerCase() === 'a') onExit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExit])

  return (
    <div className="bee-screen min-h-dvh flex flex-col p-[clamp(1rem,2.5vw,2.5rem)] gap-[clamp(0.75rem,2vw,1.5rem)]">
      <header className="flex items-center justify-between gap-4">
        <h1 className="bee-display text-[clamp(1.6rem,3.2vw,3.2rem)] text-[var(--bee-gold)] truncate">{game.settings.eventName}</h1>
        <div
          className="flex items-center gap-2 transition-opacity duration-500"
          style={{ opacity: chromeVisible ? 1 : 0 }}
          onFocus={() => setChromeVisible(true)}
        >
          {onToggleSound && (
            <button type="button" className="bee-btn bee-btn-sm bee-btn-ghost" onClick={onToggleSound} aria-pressed={soundOn}>
              {soundOn ? '🔊 Sound on' : '🔇 Sound off'}
            </button>
          )}
          {onExit && (
            <button type="button" className="bee-btn bee-btn-sm bee-btn-ghost" onClick={onExit}>
              Back to host <kbd className="bee-kbd">Esc</kbd>
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0">
        {game.phase === 'setup' && <AudienceLobby game={game} />}
        {game.phase === 'playing' && <AudiencePlaying game={game} />}
        {game.phase === 'tiebreaker' && <AudienceTiebreak game={game} />}
        {game.phase === 'results' && <AudienceResults game={game} />}
      </main>

      {game.paused && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[rgba(14,9,33,0.92)]">
          <div className="text-center">
            <p className="bee-display text-[clamp(4rem,12vw,12rem)] text-[var(--bee-gold)] bee-anim-pop">Intermission</p>
            <p className="bee-label text-[clamp(1rem,2vw,1.8rem)]">We&rsquo;ll be right back. Refill something.</p>
          </div>
        </div>
      )}
    </div>
  )
}

function AudienceLobby({ game }: { game: GameState }) {
  return (
    <div className="flex-1 grid place-items-center text-center">
      <div className="bee-stagger">
        <p className="bee-label text-[clamp(1rem,2vw,1.8rem)]" style={{ ['--i' as string]: 0 }}>
          Coming up
        </p>
        <p className="bee-display text-[clamp(3rem,9vw,9rem)] mt-2" style={{ ['--i' as string]: 1 }}>
          {game.settings.eventName}
        </p>
        <div className="flex flex-wrap justify-center gap-3 mt-6" style={{ ['--i' as string]: 2 }}>
          {game.teams.map((team) => (
            <TeamChip key={team.id} team={team} className="text-[clamp(1.2rem,2.4vw,2.2rem)] px-5 py-2" />
          ))}
        </div>
        <p className="bee-label mt-8 text-[clamp(0.9rem,1.6vw,1.4rem)]" style={{ ['--i' as string]: 3 }}>
          Trophy: {game.settings.trophyTitle}
        </p>
      </div>
    </div>
  )
}

/** The word is safe to show while the contestant, and only the contestant, is spelling. */
function audienceWord(game: GameState, turn: Turn, words: Word[]): Word | null {
  if (!game.settings.audienceShowsWord) return null
  if (turn.stage === 'ready' || turn.stage === 'steal-select' || turn.stage === 'steal-attempt') return null
  if (turn.outcome === 'skipped') return null
  return wordById(words, turn.wordId) ?? null
}

function AudiencePlaying({ game }: { game: GameState }) {
  const { words } = useBee()
  const round = currentRound(game)
  const turn = game.turn
  const team = teamById(game, turn?.teamId)
  const next = upNext(game)

  if (game.interlude && round) {
    const rows = standings(game)
    return (
      <div className="flex-1 grid lg:grid-cols-[1.1fr_1fr] gap-[clamp(1rem,2.5vw,2.5rem)] items-center">
        <div className="text-center lg:text-left">
          <p className="bee-label text-[clamp(1rem,2vw,1.8rem)]">That&rsquo;s the end of</p>
          <p className="bee-display text-[clamp(4rem,10vw,10rem)] text-[var(--bee-gold)] bee-anim-pop">{round.name}</p>
          {rows[0] && (
            <p className="text-[clamp(1.2rem,2.4vw,2.2rem)] mt-4">
              {rows.filter((row) => row.rank === 1).length > 1 ? 'Tied at the top: ' : 'Leading: '}
              <span className="bee-display">{rows.filter((row) => row.rank === 1).map((row) => row.team.name).join(' & ')}</span>
            </p>
          )}
        </div>
        <Leaderboard game={game} size="lg" showPlayers={false} />
      </div>
    )
  }

  if (!turn || !team || !round) return null
  const color = teamColor(team.color)
  const contestant = contestantName(team, turn.playerIndex)
  const stealer = teamById(game, turn.stealTeamId)
  const shown = audienceWord(game, turn, words)
  const stealHidden = game.settings.audienceShowsWord && (turn.stage === 'steal-select' || turn.stage === 'steal-attempt')

  return (
    <div className="flex-1 grid lg:grid-cols-[1.4fr_1fr] gap-[clamp(1rem,2.5vw,2.5rem)] min-h-0">
      <section className="flex flex-col gap-[clamp(0.75rem,1.5vw,1.25rem)] min-h-0">
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <Pill tone="gold">{round.name}</Pill>
          <Pill>{round.points} pts a word</Pill>
          <Pill>{difficultyLabel(round.difficulty)} words</Pill>
          <Pill>
            Turn {turn.indexInRound + 1} of {round.turnsPerTeam * game.teams.length}
          </Pill>
        </div>

        <div
          key={turn.number}
          className="bee-marquee flex-1 flex flex-col justify-center gap-[clamp(0.75rem,1.6vw,1.5rem)] p-[clamp(1.25rem,3vw,3rem)] bee-anim-rise"
          style={{ background: color.bg, color: color.fg }}
        >
          <div className="grid md:grid-cols-[1fr_auto] gap-6 items-center">
            <div className="min-w-0">
              <p className="bee-label text-[clamp(1rem,1.8vw,1.6rem)]" style={{ color: 'inherit', opacity: 0.8 }}>
                Now spelling for {team.name}
              </p>
              <p className={`bee-display leading-none mt-1 break-words ${shown ? 'text-[clamp(2.6rem,6vw,6.5rem)]' : 'text-[clamp(3.6rem,9vw,9.5rem)]'}`}>{contestant}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {turn.doubled && (
                  <span className="inline-flex items-center gap-2 bee-anim-spin-in rounded-full bg-[var(--bee-ink)] text-[var(--bee-gold)] px-4 py-2 bee-display text-[clamp(1.2rem,2.2vw,2rem)]">
                    <Token available size="sm" label={false} /> Double Word is on
                  </span>
                )}
                {turn.distraction && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-[var(--bee-ink)] text-[var(--bee-cream)] px-4 py-2 bee-display text-[clamp(1.2rem,2.2vw,2rem)] bee-anim-wobble">
                    🎪 {turn.distraction}
                  </span>
                )}
                {stealHidden && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-[var(--bee-ink)] text-[var(--bee-cream)] px-4 py-2 bee-display text-[clamp(1.1rem,2vw,1.8rem)]">
                    🙈 Word hidden for the steal
                  </span>
                )}
              </div>
            </div>
            <div className="justify-self-center rounded-full bg-[var(--bee-ink)] p-3">
              <TimerRing timer={game.timer} size={shown ? 190 : 220} enabled={game.settings.timedRounds} />
            </div>
          </div>

          {shown && (
            <div key={shown.id} className="bee-plate px-[clamp(1rem,2.5vw,2.5rem)] py-[clamp(0.75rem,1.8vw,1.75rem)] bee-anim-pop">
              <p className="bee-label" style={{ color: 'var(--bee-ink)', opacity: 0.6 }}>
                The word · {difficultyLabel(shown.difficulty)} · {shown.partOfSpeech}
              </p>
              <p
                className="bee-display leading-none tracking-wider whitespace-nowrap overflow-hidden"
                style={{ fontSize: `clamp(2.5rem, ${Math.min(9, 100 / Math.max(6, shown.word.length)).toFixed(2)}vw, 10rem)` }}
              >
                {shown.word}
              </p>
              {shown.pronunciation && <p className="font-mono text-[clamp(1rem,1.6vw,1.5rem)] mt-1 opacity-80">{shown.pronunciation}</p>}
              {(turn.showDefinition || turn.showSentence) && (
                <div className="mt-3 pt-3 border-t-2 border-[rgba(14,9,33,0.2)] grid gap-1 text-[clamp(1.05rem,1.8vw,1.7rem)] leading-snug">
                  {turn.showDefinition && <p>{shown.definition}</p>}
                  {turn.showSentence && <p className="opacity-85">“{shown.sentence}”</p>}
                </div>
              )}
            </div>
          )}

          <div className="min-h-[3rem]">
            <Status game={game} team={team} stealer={stealer} />
          </div>
        </div>

        {next && turn.stage !== 'resolved' && (
          <p className="text-[clamp(1rem,1.8vw,1.6rem)] text-[var(--bee-dim)]">
            Up next: <span className="text-[var(--bee-cream)] bee-display">{next.team.name}</span> ·{' '}
            <span className="text-[var(--bee-cream)]">{contestantName(next.team, next.playerIndex)}</span>
          </p>
        )}
      </section>

      <aside className="min-h-0">
        <p className="bee-label mb-3 text-[clamp(0.9rem,1.5vw,1.3rem)]">Leaderboard</p>
        <Leaderboard game={game} size="lg" activeTeamId={team.id} />
      </aside>
    </div>
  )
}

function Status({ game, team, stealer }: { game: GameState; team: Team; stealer: Team | undefined }) {
  const turn = game.turn
  if (!turn) return null
  const big = 'bee-display text-[clamp(2rem,4.5vw,4.5rem)] leading-none'
  switch (turn.stage) {
    case 'ready':
      return <p className={`${big} opacity-80`}>Waiting for the word…</p>
    case 'revealed':
      return <p className={`${big} bee-anim-blink`}>Spell it!</p>
    case 'steal-select':
      return (
        <p className={`${big} bee-anim-shake`}>
          Missed! {game.settings.stealMode === 'written' ? 'Whiteboards up: steal for ' : 'Steal for '}
          {game.settings.stealWorth === 'word' ? `${currentRound(game)?.points ?? 0}` : game.settings.stealPoints}{' '}
          {(game.settings.stealWorth === 'word' ? currentRound(game)?.points : game.settings.stealPoints) === 1 ? 'point' : 'points'}
        </p>
      )
    case 'steal-attempt':
      return (
        <p className={`${big} bee-anim-pop`}>
          Steal attempt: {stealer?.name ?? 'another team'}
        </p>
      )
    case 'resolved': {
      if (turn.outcome === 'skipped') return <p className={`${big} opacity-80`}>Word skipped</p>
      if (turn.outcome === 'correct') {
        return (
          <p className={`${big} bee-anim-pop`}>
            Correct! {formatPoints(turn.pointsAwarded)} for {team.name}
          </p>
        )
      }
      const parts: string[] = [turn.doubled ? `Missed. ${formatPoints(turn.pointsAwarded)} for ${team.name}` : 'Missed. No points']
      if (turn.stealOutcome === 'correct' && stealer) parts.push(`${stealer.name} steals ${formatPoints(turn.stealPointsAwarded)}!`)
      if (turn.stealOutcome === 'incorrect' && stealer) {
        parts.push(`${stealer.name} missed the steal${turn.stealPointsAwarded < 0 ? ` (${formatPoints(turn.stealPointsAwarded)})` : ''}.`)
      }
      return <p className={`${big} bee-anim-shake`}>{parts.join(' ')}</p>
    }
    default:
      return null
  }
}

function AudienceTiebreak({ game }: { game: GameState }) {
  const tb = game.tiebreak
  if (!tb) return null
  const teams = tb.teamIds.map((id) => teamById(game, id)).filter((team): team is Team => Boolean(team))
  return (
    <div className="flex-1 grid lg:grid-cols-[1.2fr_1fr] gap-[clamp(1rem,2.5vw,2.5rem)] items-center">
      <div className="text-center lg:text-left">
        <p className="bee-label text-[clamp(1rem,2vw,1.8rem)]">We have a tie</p>
        <p className="bee-display text-[clamp(4rem,10vw,10rem)] text-[var(--bee-red-soft)] bee-anim-pop">Sudden death</p>
        <p className="text-[clamp(1.2rem,2.4vw,2.2rem)] mt-2">
          Whiteboards up. Word {tb.wordNumber}. {tb.revealed ? 'Spell it!' : 'Listen for the word…'}
        </p>
        <div className="flex flex-wrap gap-3 mt-6 justify-center lg:justify-start">
          {teams.map((team) => (
            <TeamChip key={team.id} team={team} className="text-[clamp(1.4rem,2.8vw,2.6rem)] px-5 py-2" />
          ))}
        </div>
        <div className="mt-6 rounded-full bg-[var(--bee-ink)] p-3 inline-block">
          <TimerRing timer={game.timer} size={180} enabled={game.settings.timedRounds} />
        </div>
      </div>
      <Leaderboard game={game} size="lg" showPlayers={false} />
    </div>
  )
}

function AudienceResults({ game }: { game: GameState }) {
  const winner = teamById(game, game.winnerId)
  const rows = standings(game)
  const color = winner ? teamColor(winner.color) : null
  return (
    <div className="flex-1 grid lg:grid-cols-[1.3fr_1fr] gap-[clamp(1rem,2.5vw,2.5rem)] items-center">
      <div className="text-center">
        <p className="bee-label text-[clamp(1rem,2vw,1.8rem)]">{game.settings.trophyTitle}</p>
        {winner && color ? (
          <div className="bee-marquee inline-block mt-4 px-[clamp(1.5rem,4vw,4rem)] py-[clamp(1rem,3vw,3rem)] bee-anim-pop" style={{ background: color.bg, color: color.fg }}>
            <p className="bee-display text-[clamp(1.4rem,3vw,3rem)] opacity-80">Champions</p>
            <p className="bee-display text-[clamp(4rem,10vw,11rem)] leading-none">{winner.name}</p>
            <p className="text-[clamp(1.1rem,2.2vw,2rem)] mt-2">{winner.players.join(' · ')}</p>
          </div>
        ) : (
          <p className="bee-display text-[clamp(3rem,8vw,8rem)]">Game over</p>
        )}
      </div>
      <div>
        <p className="bee-label mb-3">Final standings</p>
        <ol className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.team.id} className="bee-card-flat flex items-center gap-3 px-4 py-2">
              <span className="bee-rank">{row.rank}</span>
              <span className="bee-display text-[clamp(1.3rem,2.4vw,2.2rem)] flex-1 truncate">{row.team.name}</span>
              <span className="bee-label">{ordinal(row.rank)}</span>
              <span className="bee-score text-[clamp(1.8rem,3.4vw,3.4rem)]">{row.score}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
