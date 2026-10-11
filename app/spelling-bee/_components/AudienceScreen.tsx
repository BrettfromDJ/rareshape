'use client'

import { useEffect, useRef, useState } from 'react'
import { teamColor } from '../_lib/defaults'
import { contestantName, standings, teamById, totalTurns, upNext, wordById } from '../_lib/engine'
import { formatPoints, ordinal } from '../_lib/format'
import { useBee } from '../_lib/store'
import type { GameState, Team, Turn, Word } from '../_lib/types'
import { Leaderboard } from './Leaderboard'
import { TimerFill, TimerRing } from './TimerRing'
import { Pill, TeamChip, TeamSwatch, Token } from './ui'

/**
 * What the room sees: team, contestant, turn, timer and scores. The word
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

  const verdict = game.phase === 'playing' && game.turn?.stage === 'resolved' ? game.turn.outcome : null
  const ground =
    verdict === 'correct' ? 'var(--bee-ground-correct)' : verdict === 'incorrect' ? 'var(--bee-ground-wrong)' : 'transparent'

  return (
    <div
      className="bee-screen min-h-dvh flex flex-col p-[clamp(1rem,2.5vw,2.5rem)] gap-[clamp(0.75rem,2vw,1.5rem)]"
      style={{ background: ground, transition: 'background 350ms ease' }}
    >
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
  const kids = game.settings.mode === 'kids'
  const count = game.teams.length
  const columns = count <= 2 ? count || 1 : count <= 4 ? 2 : count <= 6 ? 3 : 4
  return (
    <div className="flex-1 flex flex-col gap-[clamp(0.75rem,2vw,1.5rem)] min-h-0">
      <div className="text-center bee-stagger">
        <p className="bee-label text-[clamp(1rem,2vw,1.8rem)]" style={{ ['--i' as string]: 0 }}>
          {kids ? 'Tonight\u2019s spellers' : 'Tonight\u2019s teams'}
        </p>
        <p className="bee-display text-[clamp(2.4rem,6vw,6rem)] leading-none mt-1" style={{ ['--i' as string]: 1 }}>
          {game.settings.eventName}
        </p>
      </div>

      {count === 0 ? (
        <p className="bee-label text-center text-[clamp(1rem,2vw,1.8rem)] mt-6">The host is still setting up.</p>
      ) : kids ? (
        <ul className="flex-1 flex flex-wrap content-center justify-center gap-[clamp(0.6rem,1.5vw,1.25rem)] bee-stagger">
          {game.teams.map((team, index) => {
            const color = teamColor(team.color)
            return (
              <li
                key={team.id}
                className="rounded-2xl border-[3px] border-[var(--bee-ink)] px-[clamp(1rem,2.5vw,2.5rem)] py-[clamp(0.6rem,1.5vw,1.25rem)] bee-display text-[clamp(1.8rem,4.5vw,4.5rem)] leading-none"
                style={{ background: color.bg, color: color.fg, boxShadow: '0 6px 0 var(--bee-ink)', ['--i' as string]: index + 2 }}
              >
                {team.name}
              </li>
            )
          })}
        </ul>
      ) : (
        <ul className="flex-1 grid gap-[clamp(0.6rem,1.5vw,1.25rem)] min-h-0 bee-stagger" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {game.teams.map((team, index) => {
            const color = teamColor(team.color)
            return (
              <li
                key={team.id}
                className="rounded-2xl border-[3px] border-[var(--bee-ink)] p-[clamp(0.75rem,2vw,1.75rem)] flex flex-col min-h-0"
                style={{ background: color.bg, color: color.fg, boxShadow: '0 6px 0 var(--bee-ink)', ['--i' as string]: index + 2 }}
              >
                <p className="bee-display leading-none break-words text-[clamp(1.8rem,4.2vw,4.2rem)]">{team.name}</p>
                <p className="mt-[0.4em] text-[clamp(1rem,2.2vw,2.1rem)] leading-snug break-words" style={{ opacity: 0.9 }}>
                  {team.players.length ? team.players.join(' \u00b7 ') : 'Players to be announced'}
                </p>
                {game.settings.doubleWordEnabled && (
                  <p className="mt-auto pt-2 inline-flex items-center gap-2 text-[clamp(0.85rem,1.5vw,1.3rem)]" style={{ opacity: 0.85 }}>
                    <Token available size="sm" label={false} /> One Double Word to play
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <p className="bee-label text-center text-[clamp(0.9rem,1.6vw,1.4rem)]">
        Playing for: {game.settings.trophyTitle}
        {count > 0 && ` \u00b7 ${game.settings.timesEach} ${game.settings.timesEach === 1 ? 'word' : 'words'} each \u00b7 ${game.settings.pointsPerWord} ${game.settings.pointsPerWord === 1 ? 'pt' : 'pts'} a word`}
      </p>
    </div>
  )
}

/** The word is safe to show while the contestant, and only the contestant, is spelling. */
function audienceWord(game: GameState, turn: Turn, words: Word[]): Word | null {
  if (!game.settings.audienceShowsWord) return null
  if (turn.stage === 'ready') return null
  if (turn.outcome === 'skipped') return null
  return wordById(words, turn.wordId) ?? null
}

function AudiencePlaying({ game }: { game: GameState }) {
  const { words } = useBee()
  const turn = game.turn
  const team = teamById(game, turn?.teamId)
  const next = upNext(game)

  if (!turn || !team) return null
  const color = teamColor(team.color)
  const contestant = contestantName(team, turn.playerIndex)
  const shown = audienceWord(game, turn, words)
  const kids = game.settings.mode === 'kids'

  if (shown) {
    return <WordStage game={game} turn={turn} team={team} contestant={contestant} word={shown} next={next} />
  }

  return (
    <div className="flex-1 grid lg:grid-cols-[1.4fr_1fr] gap-[clamp(1rem,2.5vw,2.5rem)] min-h-0">
      <section className="flex flex-col gap-[clamp(0.75rem,1.5vw,1.25rem)] min-h-0">
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <Pill tone="gold">
            Turn {turn.number} of {totalTurns(game)}
          </Pill>
          <Pill>{game.settings.pointsPerWord} pts a word</Pill>
        </div>

        <TimerFill
          key={turn.number}
          timer={game.timer}
          enabled={game.settings.timedRounds}
          bg={color.bg}
          fg={color.fg}
          size="lg"
          className="bee-marquee flex-1 flex flex-col justify-center p-[clamp(1.25rem,3vw,3rem)] bee-anim-rise"
        >
          <div className="flex flex-col gap-[clamp(0.75rem,1.6vw,1.5rem)]">
            <div className="min-w-0">
              <p className="bee-label text-[clamp(1rem,1.8vw,1.6rem)]" style={{ color: 'inherit', opacity: 0.8 }}>
                {kids ? 'Now spelling' : `Now spelling for ${team.name}`}
              </p>
              <p className="bee-display leading-none mt-1 break-words text-[clamp(3.6rem,9vw,9.5rem)]">{contestant}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {turn.doubled && (
                  <span className="inline-flex items-center gap-2 bee-anim-pulse rounded-full bg-[var(--bee-gold)] text-[var(--bee-ink)] px-5 py-2 bee-display text-[clamp(1.4rem,2.6vw,2.4rem)] border-[3px] border-[var(--bee-ink)]">
                    <Token available size="sm" label={false} /> Double Word is on
                  </span>
                )}
                {turn.distraction && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-[var(--bee-ink)] text-[var(--bee-cream)] px-4 py-2 bee-display text-[clamp(1.2rem,2.2vw,2rem)] bee-anim-wobble">
                    🎪 {turn.distraction}
                  </span>
                )}
              </div>
            </div>
            <div className="min-h-[3rem]">
              <Status game={game} team={team} />
            </div>
          </div>
        </TimerFill>

        {next && turn.stage !== 'resolved' && (
          <p className="text-[clamp(1rem,1.8vw,1.6rem)] text-[var(--bee-dim)]">
            Up next: <span className="text-[var(--bee-cream)] bee-display">{next.team.name}</span>
            {!kids && <> · <span className="text-[var(--bee-cream)]">{contestantName(next.team, next.playerIndex)}</span></>}
          </p>
        )}
      </section>

      <aside className="min-h-0">
        <p className="bee-label mb-3 text-[clamp(0.9rem,1.5vw,1.3rem)]">Leaderboard</p>
        <Leaderboard game={game} size="lg" activeTeamId={team.id} showPlayers={!kids} />
      </aside>
    </div>
  )
}

/**
 * The word is the show. It runs the full width of the screen, sized to fill
 * it, with the contestant and clock above and the standings below.
 */
function WordStage({
  game,
  turn,
  team,
  contestant,
  word,
  next,
}: {
  game: GameState
  turn: Turn
  team: Team
  contestant: string
  word: Word
  next: ReturnType<typeof upNext>
}) {
  const color = teamColor(team.color)
  const kids = game.settings.mode === 'kids'
  // Bebas Neue runs about 0.47em per letter with this tracking, so this keeps
  // the word on one line inside 90% of the screen, capped by height.
  const vw = Math.min(21, 185 / Math.max(4, word.word.length)).toFixed(2)
  const extras = Boolean((turn.showDefinition && word.definition) || (turn.showSentence && word.sentence))

  return (
    <div className="flex-1 flex flex-col gap-[clamp(0.6rem,1.4vw,1.25rem)] min-h-0">
      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        <Pill tone="gold">
          Turn {turn.number} of {totalTurns(game)}
        </Pill>
        <Pill>{game.settings.pointsPerWord} pts a word</Pill>
        {turn.doubled && (
          <span className="inline-flex items-center gap-2 bee-anim-pulse rounded-full bg-[var(--bee-gold)] text-[var(--bee-ink)] px-4 py-1 bee-display text-[clamp(1rem,1.8vw,1.6rem)] tracking-wider border-2 border-[var(--bee-ink)]">
            <Token available size="sm" label={false} /> Double Word: 2× or −{game.settings.pointsPerWord}
          </span>
        )}
        {turn.distraction && (
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--bee-ink)] text-[var(--bee-cream)] px-3 py-1 bee-display text-base tracking-wider bee-anim-wobble">
            🎪 {turn.distraction}
          </span>
        )}
      </div>

      <TimerFill
        timer={game.timer}
        enabled={game.settings.timedRounds}
        bg={color.bg}
        fg={color.fg}
        className="rounded-2xl border-[3px] border-[var(--bee-ink)] px-4 md:px-6 py-3"
        style={{ boxShadow: '0 5px 0 var(--bee-ink)' }}
      >
        <p className="bee-label text-[clamp(0.85rem,1.3vw,1.2rem)]" style={{ color: 'inherit', opacity: 0.8 }}>
          {kids ? 'Now spelling' : `Now spelling for ${team.name}`}
        </p>
        <p className="bee-display text-[clamp(2rem,4.2vw,4.2rem)] leading-none break-words">{contestant}</p>
      </TimerFill>

      <div key={word.id} className="bee-plate bee-marquee flex-1 grid place-items-center text-center px-[clamp(1rem,3vw,3rem)] py-[clamp(1rem,2.5vw,2.5rem)] bee-anim-pop min-h-0">
        <div className="min-w-0 max-w-full">
          <p className="bee-label text-[clamp(0.9rem,1.5vw,1.4rem)]" style={{ color: 'var(--bee-ink)', opacity: 0.6 }}>
            {word.partOfSpeech || 'The word'}
          </p>
          <FitWord word={word.word} size={`clamp(3rem, min(${vw}vw, ${extras ? 30 : 42}vh), 26rem)`} />
          {word.pronunciation && <p className="font-mono text-[clamp(1.1rem,2vw,2rem)] mt-2 opacity-80">{word.pronunciation}</p>}
          {extras && (
            <div className="mt-3 pt-3 border-t-2 border-[rgba(14,9,33,0.2)] grid gap-1 text-[clamp(1.1rem,2.1vw,2.1rem)] leading-snug max-w-[40ch] mx-auto" style={{ textWrap: 'balance' }}>
              {turn.showDefinition && word.definition && <p>{word.definition}</p>}
              {turn.showSentence && word.sentence && <p className="opacity-85">“{word.sentence}”</p>}
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_auto] items-center gap-3">
        <div className="min-h-[2.5rem]">
          <Status game={game} team={team} compact={turn.stage !== 'resolved'} />
        </div>
        {next && turn.stage !== 'resolved' && (
          <p className="text-[clamp(0.9rem,1.5vw,1.3rem)] text-[var(--bee-dim)] lg:text-right">
            Up next: <span className="text-[var(--bee-cream)] bee-display">{next.team.name}</span>
            {!kids && <> · <span className="text-[var(--bee-cream)]">{contestantName(next.team, next.playerIndex)}</span></>}
          </p>
        )}
      </div>

      <BoardStrip game={game} activeTeamId={team.id} />
    </div>
  )
}

/**
 * The word at its largest size that still fits on one line. The CSS size is
 * an estimate for the display face; this measures the real rendering, so a
 * fallback font (or an offline laptop) never clips a letter.
 */
function FitWord({ word, size }: { word: string; size: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    const el = ref.current
    const parent = el?.parentElement
    if (!el || !parent) return
    const fit = () => {
      el.style.fontSize = size
      const base = Number.parseFloat(getComputedStyle(el).fontSize)
      const available = parent.clientWidth
      const width = el.scrollWidth
      if (width > available && width > 0) el.style.fontSize = `${Math.floor(base * (available / width) * 0.97)}px`
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(parent)
    void document.fonts?.ready.then(fit)
    return () => observer.disconnect()
  }, [word, size])
  return (
    <p ref={ref} className="bee-display leading-none tracking-wider whitespace-nowrap" style={{ fontSize: size }}>
      {word}
    </p>
  )
}

/** The standings in one row, for screens where the word needs the room. */
function BoardStrip({ game, activeTeamId }: { game: GameState; activeTeamId: string }) {
  const rows = standings(game)
  return (
    <ol className="flex flex-wrap justify-center gap-2 md:gap-3" aria-label="Leaderboard">
      {rows.map((row) => {
        const color = teamColor(row.team.color)
        const active = row.team.id === activeTeamId
        return (
          <li
            key={row.team.id}
            className="flex items-center gap-2 md:gap-3 rounded-full border-[3px] pl-2 pr-4 py-1"
            style={{
              background: active ? color.bg : 'var(--bee-surface)',
              color: active ? color.fg : 'var(--bee-cream)',
              borderColor: active ? 'var(--bee-cream)' : 'var(--bee-ink)',
              boxShadow: '0 4px 0 var(--bee-ink)',
            }}
          >
            <span className="bee-rank" aria-label={`Rank ${row.rank}`}>
              {row.rank}
            </span>
            {!active && <TeamSwatch team={row.team} size="sm" />}
            <span className="bee-display text-[clamp(1.1rem,2vw,1.9rem)] whitespace-nowrap">{row.team.name}</span>
            {game.settings.doubleWordEnabled && <Token available={Boolean(game.tokens[row.team.id])} size="sm" label={false} />}
            <span className="bee-score text-[clamp(1.6rem,3vw,2.8rem)]" aria-label={`${row.score} points`}>
              {row.score}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function Status({ game, team, compact = false }: { game: GameState; team: Team; compact?: boolean }) {
  const turn = game.turn
  if (!turn) return null
  const big = compact ? 'bee-display text-[clamp(1.5rem,3vw,3rem)] leading-none' : 'bee-display text-[clamp(2rem,4.5vw,4.5rem)] leading-none'
  switch (turn.stage) {
    case 'ready':
      return <p className={`${big} opacity-80`}>Waiting for the word…</p>
    case 'revealed':
      return <p className={`${big} bee-anim-blink`}>Spell it!</p>
    case 'resolved': {
      if (turn.outcome === 'skipped') return <p className={`${big} opacity-80`}>Word skipped</p>
      if (turn.outcome === 'correct') {
        return (
          <p className={`${big} bee-anim-pop`} style={{ color: 'var(--bee-green)' }}>
            ✓ Correct! {formatPoints(turn.pointsAwarded)} for {team.name}
          </p>
        )
      }
      return (
        <p className={`${big} bee-anim-shake`} style={{ color: 'var(--bee-red-soft)' }}>
          ✕ {turn.doubled ? `Missed. ${formatPoints(turn.pointsAwarded)} for ${team.name}` : 'Missed. No points'}
        </p>
      )
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
            <p className="bee-display text-[clamp(1.4rem,3vw,3rem)] opacity-80">{game.settings.mode === 'kids' ? '⭐ Winner ⭐' : 'Champions'}</p>
            <p className="bee-display text-[clamp(4rem,10vw,11rem)] leading-none">{winner.name}</p>
            {game.settings.mode !== 'kids' && <p className="text-[clamp(1.1rem,2.2vw,2rem)] mt-2">{winner.players.join(' · ')}</p>}
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
