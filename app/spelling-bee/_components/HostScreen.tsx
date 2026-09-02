'use client'

import { useEffect, useRef, useState } from 'react'
import { teamColor } from '../_lib/defaults'
import { contestantName, currentRound, difficultyLabel, standings, teamById, turnsInRound, upNext, wordById } from '../_lib/engine'
import { formatPoints } from '../_lib/format'
import { useShortcuts } from '../_lib/hooks'
import { canSpeak, playCue, primeAudio, speak } from '../_lib/sound'
import { setPrefs, undo, useBee, useDispatch } from '../_lib/store'
import type { GameState, Team, Word } from '../_lib/types'
import { HistoryList } from './History'
import { Leaderboard } from './Leaderboard'
import { TimerRing } from './TimerRing'
import { TopBar } from './TopBar'
import { Dialog, Kbd, Pill, TeamChip, Toast, Token } from './ui'
import { WordBank } from './WordBank'

type DialogKind = 'end' | 'adjust' | 'history' | 'bank' | 'help' | null

const SHORTCUTS: Array<[string, string]> = [
  ['R', 'Reveal word'],
  ['Space', 'Start / pause timer'],
  ['T', 'Reset timer'],
  ['C', 'Correct'],
  ['X', 'Incorrect'],
  ['N', 'Next contestant'],
  ['P', 'Say the word'],
  ['D', 'Definition'],
  ['S', 'Sentence'],
  ['2', 'Double Word'],
  ['W', 'Replace word'],
  ['K', 'Skip word'],
  ['Z', 'Undo'],
  ['M', 'Mute'],
  ['A', 'Audience mode'],
  ['?', 'This list'],
]

/**
 * Drives the countdown from the host window: ticks in the last seconds, a
 * warning at ten, and the expiry action when it hits zero.
 */
function useTimerDriver(game: GameState, muted: boolean) {
  const dispatch = useDispatch()
  const lastSecond = useRef<number | null>(null)
  const warned = useRef<number | null>(null)
  useEffect(() => {
    if (!game.timer.running || !game.timer.endsAt) return
    const endsAt = game.timer.endsAt
    const id = window.setInterval(() => {
      const left = endsAt - Date.now()
      if (left <= 0) {
        dispatch({ type: 'timer-expired' })
        return
      }
      const second = Math.ceil(left / 1000)
      if (second <= 10 && warned.current !== endsAt) {
        warned.current = endsAt
        playCue('warning', muted)
      }
      if (second <= 5 && lastSecond.current !== second) {
        lastSecond.current = second
        playCue('tick', muted)
      }
    }, 100)
    return () => window.clearInterval(id)
  }, [game.timer.running, game.timer.endsAt, muted, dispatch])
}

export function HostScreen({ onAudienceMode }: { onAudienceMode: () => void }) {
  const { game, words, prefs } = useBee()
  const dispatch = useDispatch()
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [toast, setToast] = useState<string | null>(null)
  useTimerDriver(game, prefs.muted)

  const turn = game.turn
  const round = currentRound(game)
  const team = teamById(game, turn?.teamId)
  const word = wordById(words, turn?.wordId)
  const stage = turn?.stage ?? null
  const timed = game.settings.timedRounds

  const say = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 3000)
  }

  const pronounce = () => {
    if (!word) return
    if (!speak(word.word)) say('This browser has no speech engine. Use the pronunciation guide instead.')
  }

  const toggleTimer = () => {
    if (!timed) return
    dispatch({ type: game.timer.running ? 'timer-pause' : 'timer-start' })
  }

  const act = (fn: () => void) => () => {
    primeAudio()
    fn()
  }

  const resume = () => dispatch({ type: 'pause', paused: false })

  useShortcuts(
    game.paused ? { escape: resume, space: resume } : {
      r: stage === 'ready' && word ? act(() => dispatch({ type: 'reveal' })) : undefined,
      space: stage === 'revealed' || stage === 'steal-attempt' ? act(toggleTimer) : undefined,
      t: timed ? () => dispatch({ type: 'timer-reset' }) : undefined,
      c: stage === 'revealed' ? act(() => dispatch({ type: 'mark', result: 'correct' })) : stage === 'steal-attempt' ? act(() => dispatch({ type: 'steal-mark', result: 'correct' })) : undefined,
      x: stage === 'revealed' ? act(() => dispatch({ type: 'mark', result: 'incorrect' })) : stage === 'steal-attempt' ? act(() => dispatch({ type: 'steal-mark', result: 'incorrect' })) : undefined,
      n: stage === 'resolved' ? act(() => dispatch({ type: 'next' })) : game.interlude ? act(() => dispatch({ type: 'start-round' })) : undefined,
      d: stage === 'revealed' ? () => dispatch({ type: 'toggle-definition' }) : undefined,
      s: stage === 'revealed' ? () => dispatch({ type: 'toggle-sentence' }) : undefined,
      p: stage === 'revealed' || stage === 'steal-attempt' || stage === 'steal-select' ? pronounce : undefined,
      '2': stage === 'ready' ? act(() => dispatch({ type: 'activate-token' })) : undefined,
      w: stage === 'ready' || stage === 'revealed' ? () => dispatch({ type: 'replace' }) : undefined,
      k: stage === 'ready' || stage === 'revealed' ? () => dispatch({ type: 'skip' }) : undefined,
      z: () => undo() && say('Undid the last action'),
      'mod+z': () => undo() && say('Undid the last action'),
      m: () => {
        primeAudio()
        setPrefs({ muted: !prefs.muted })
      },
      a: onAudienceMode,
      '?': () => setDialog('help'),
      'shift+/': () => setDialog('help'),
    },
    dialog === null,
  )

  const next = upNext(game)
  const color = team ? teamColor(team.color) : null

  return (
    <div className="bee-screen min-h-dvh flex flex-col gap-4 p-4 md:p-6">
      <TopBar
        game={game}
        onAudienceMode={onAudienceMode}
        extra={
          <>
            <button type="button" className="bee-btn bee-btn-sm bee-btn-ghost" onClick={() => setDialog('adjust')}>
              Scores ±
            </button>
            <button type="button" className="bee-btn bee-btn-sm bee-btn-ghost" onClick={() => setDialog('history')}>
              History
            </button>
            <button type="button" className="bee-btn bee-btn-sm bee-btn-ghost" onClick={() => setDialog('bank')}>
              Words
            </button>
            <button type="button" className="bee-btn bee-btn-sm bee-btn-ghost" onClick={() => setDialog('help')} aria-label="Keyboard shortcuts">
              ?
            </button>
            <button type="button" className="bee-btn bee-btn-sm bee-btn-ghost" onClick={() => dispatch({ type: 'pause', paused: true })}>
              ⏸ Pause
            </button>
            <button type="button" className="bee-btn bee-btn-sm bee-btn-red" onClick={() => setDialog('end')}>
              End game
            </button>
          </>
        }
      >
        {round && (
          <>
            <Pill tone="gold">{round.name}</Pill>
            <Pill>{round.points} pts</Pill>
            <Pill>{difficultyLabel(round.difficulty)}</Pill>
            {turn && (
              <Pill>
                Turn {turn.indexInRound + 1}/{turnsInRound(game, round)}
              </Pill>
            )}
          </>
        )}
      </TopBar>

      <main className="flex-1 grid lg:grid-cols-[1.55fr_1fr] gap-4 min-h-0">
        <section className="flex flex-col gap-4 min-w-0">
          {game.interlude && round && <RoundComplete game={game} onStart={act(() => dispatch({ type: 'start-round' }))} />}

          {!game.interlude && turn && team && color && round && (
            <>
              <div key={turn.number} className="bee-card p-4 md:p-5 bee-anim-rise" style={{ background: color.bg, color: color.fg }}>
                <div className="flex flex-wrap items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="bee-label" style={{ color: 'inherit', opacity: 0.75 }}>
                      Now spelling for {team.name}
                    </p>
                    {stage === 'ready' && team.players.length > 0 ? (
                      <label className="block mt-1">
                        <span className="sr-only">Contestant</span>
                        <select
                          className="bee-select text-3xl md:text-4xl w-auto max-w-full uppercase"
                          style={{ background: 'var(--bee-ink)', color: 'var(--bee-cream)', minHeight: '3.6rem', fontFamily: 'var(--bee-display)', letterSpacing: '0.02em' }}
                          value={turn.playerIndex}
                          onChange={(changeEvent) => dispatch({ type: 'set-contestant', playerIndex: Number(changeEvent.target.value) })}
                        >
                          {team.players.map((player, index) => (
                            <option key={`${player}-${index}`} value={index}>
                              {player}
                              {index === (game.rotation[team.id] ?? 0) ? ' (due)' : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <p className="bee-display text-4xl md:text-6xl leading-none mt-1 break-words">{contestantName(team, turn.playerIndex)}</p>
                    )}
                    {next && (
                      <p className="mt-2 text-base opacity-85">
                        Up next: <strong>{next.team.name}</strong> · {contestantName(next.team, next.playerIndex)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {game.settings.doubleWordEnabled && (
                      <div className={`flex items-center gap-2 ${turn.doubled ? 'bee-anim-spin-in' : ''}`}>
                        <Token available={turn.doubled || Boolean(game.tokens[team.id])} size="md" label={false} />
                        <span className="bee-display text-xl">{turn.doubled ? 'Double Word is on' : game.tokens[team.id] ? 'Token in hand' : 'Token used'}</span>
                      </div>
                    )}
                    {turn.distraction && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-[var(--bee-ink)] text-[var(--bee-cream)] px-4 py-2 bee-display text-xl bee-anim-wobble">
                        🎪 {turn.distraction}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <WordCard game={game} word={word} onPronounce={pronounce} />

              <ActionPanel game={game} team={team} word={word} onPronounce={pronounce} act={act} />
            </>
          )}

          {!game.interlude && !turn && (
            <div className="bee-card p-6">
              <p className="text-lg mb-4">The game has no current turn. This should not happen; you can end the game or go back to setup.</p>
              <div className="flex gap-3">
                <button type="button" className="bee-btn bee-btn-gold" onClick={() => dispatch({ type: 'end' })}>
                  End game
                </button>
                <button type="button" className="bee-btn bee-btn-ghost" onClick={() => dispatch({ type: 'to-setup' })}>
                  Back to setup
                </button>
              </div>
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-4 min-w-0">
          <div>
            <p className="bee-label mb-2">Leaderboard</p>
            <Leaderboard game={game} activeTeamId={team?.id ?? null} />
          </div>
          <div className="bee-card-flat p-3 hidden lg:block">
            <p className="bee-label mb-2">Shortcuts</p>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {SHORTCUTS.slice(0, 8).map(([key, label]) => (
                <li key={key} className="flex items-center gap-2">
                  <Kbd>{key}</Kbd> {label}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </main>

      {game.paused && (
        <div className="bee-scrim" role="dialog" aria-modal="true" aria-label="Game paused">
          <div className="text-center">
            <p className="bee-display text-8xl md:text-9xl text-[var(--bee-gold)] bee-anim-pop">Paused</p>
            <p className="bee-hint text-lg mb-6">The audience screen shows an intermission card.</p>
            <button type="button" className="bee-btn bee-btn-xl bee-btn-gold" onClick={() => dispatch({ type: 'pause', paused: false })} autoFocus>
              ▶ Resume <Kbd>Esc</Kbd>
            </button>
          </div>
        </div>
      )}

      {dialog === 'end' && (
        <Dialog title="End the game?" onClose={() => setDialog(null)} tone="danger">
          <p className="text-lg mb-6">Scores stand as they are. A tie at the top goes straight to sudden death; otherwise it&rsquo;s the results screen.</p>
          <div className="flex flex-wrap gap-3 justify-end">
            <button type="button" className="bee-btn bee-btn-ghost" onClick={() => setDialog(null)} data-autofocus="true">
              Keep playing
            </button>
            <button
              type="button"
              className="bee-btn bee-btn-ghost"
              onClick={() => {
                setDialog(null)
                dispatch({ type: 'to-setup' })
              }}
            >
              Quit to setup
            </button>
            <button
              type="button"
              className="bee-btn bee-btn-red"
              onClick={() => {
                setDialog(null)
                dispatch({ type: 'end' })
              }}
            >
              End &amp; show results
            </button>
          </div>
        </Dialog>
      )}
      {dialog === 'adjust' && <AdjustScores game={game} onClose={() => setDialog(null)} />}
      {dialog === 'history' && (
        <Dialog title="Game history" onClose={() => setDialog(null)} wide>
          <div className="max-h-[60vh] overflow-auto pr-1">
            <HistoryList game={game} />
          </div>
        </Dialog>
      )}
      {dialog === 'bank' && <WordBank onClose={() => setDialog(null)} />}
      {dialog === 'help' && (
        <Dialog title="Keyboard shortcuts" onClose={() => setDialog(null)}>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-base">
            {SHORTCUTS.map(([key, label]) => (
              <li key={key} className="flex items-center gap-3">
                <Kbd>{key}</Kbd> {label}
              </li>
            ))}
          </ul>
          <p className="bee-hint mt-4">Shortcuts pause while a dialog is open or a field has focus.</p>
        </Dialog>
      )}
      {toast && <Toast message={toast} />}
    </div>
  )
}

// ---------------------------------------------------------------------------

function WordCard({ game, word, onPronounce }: { game: GameState; word: Word | undefined; onPronounce: () => void }) {
  const dispatch = useDispatch()
  const turn = game.turn
  if (!turn) return null

  if (turn.stage === 'ready') {
    return (
      <div className="bee-plate p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1">
          <p className="bee-label" style={{ color: 'var(--bee-ink)', opacity: 0.6 }}>
            The word is hidden
          </p>
          <p className="text-lg mt-1">
            {word ? (
              <>
                A <strong>{difficultyLabel(word.difficulty).toLowerCase()}</strong> word is loaded. Reveal it when the contestant is ready; the audience screen never shows it.
              </>
            ) : (
              turn.wordNote ?? 'No word could be drawn.'
            )}
          </p>
          {word && turn.wordNote && <p className="mt-1 text-sm opacity-70">{turn.wordNote}</p>}
        </div>
        <button type="button" className="bee-btn bee-btn-xl bee-btn-gold" disabled={!word} onClick={() => dispatch({ type: 'reveal' })}>
          👁 Reveal word <Kbd>R</Kbd>
        </button>
      </div>
    )
  }

  if (!word) return null
  return (
    <div className="bee-plate p-5 md:p-6 bee-anim-pop">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex-1 min-w-0">
          <p className="bee-label" style={{ color: 'var(--bee-ink)', opacity: 0.6 }}>
            Host only · {difficultyLabel(word.difficulty)} · {word.partOfSpeech}
          </p>
          <p className="bee-display text-[clamp(3rem,6.5vw,6.5rem)] leading-none tracking-wider break-words mt-1">{word.word}</p>
          {word.pronunciation && <p className="font-mono text-lg mt-2 opacity-80">{word.pronunciation}</p>}
        </div>
        <div className="flex flex-col gap-2">
          <button type="button" className="bee-btn bee-btn-sm" onClick={onPronounce} disabled={!canSpeak()} title={canSpeak() ? 'Read the word aloud' : 'Speech is not available in this browser'}>
            🔁 Say it <Kbd>P</Kbd>
          </button>
          <button type="button" className="bee-btn bee-btn-sm" aria-pressed={turn.showDefinition} onClick={() => dispatch({ type: 'toggle-definition' })}>
            📖 Definition <Kbd>D</Kbd>
          </button>
          <button type="button" className="bee-btn bee-btn-sm" aria-pressed={turn.showSentence} onClick={() => dispatch({ type: 'toggle-sentence' })}>
            💬 Sentence <Kbd>S</Kbd>
          </button>
        </div>
      </div>
      {(turn.showDefinition || turn.showSentence) && (
        <div className="mt-4 pt-4 border-t-2 border-[rgba(14,9,33,0.2)] grid gap-2 text-xl md:text-2xl leading-snug">
          {turn.showDefinition && (
            <p>
              <span className="bee-label" style={{ color: 'var(--bee-ink)', opacity: 0.6 }}>
                Definition ·{' '}
              </span>
              {word.definition}
            </p>
          )}
          {turn.showSentence && (
            <p>
              <span className="bee-label" style={{ color: 'var(--bee-ink)', opacity: 0.6 }}>
                Sentence ·{' '}
              </span>
              “{word.sentence}”
            </p>
          )}
        </div>
      )}
      {turn.wordNote && <p className="mt-3 text-sm opacity-70">{turn.wordNote}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------

function ActionPanel({ game, team, word, onPronounce, act }: { game: GameState; team: Team; word: Word | undefined; onPronounce: () => void; act: (fn: () => void) => () => void }) {
  const dispatch = useDispatch()
  const turn = game.turn
  const round = currentRound(game)
  if (!turn || !round) return null
  const timed = game.settings.timedRounds
  const others = game.teams.filter((item) => item.id !== team.id)
  const stealWorth = game.settings.stealWorth === 'word' ? round.points : game.settings.stealPoints
  const stealer = teamById(game, turn.stealTeamId)

  const timerControls = timed && (
    <div className="flex items-center gap-4">
      <TimerRing timer={game.timer} size={150} />
      <div className="flex flex-col gap-2">
        <button type="button" className="bee-btn bee-btn-teal" onClick={act(() => dispatch({ type: game.timer.running ? 'timer-pause' : 'timer-start' }))}>
          {game.timer.running ? '⏸ Pause' : game.timer.remainingMs < game.timer.durationMs && game.timer.remainingMs > 0 ? '▶ Resume' : '▶ Start timer'} <Kbd>Space</Kbd>
        </button>
        <button type="button" className="bee-btn bee-btn-sm bee-btn-ghost" onClick={() => dispatch({ type: 'timer-reset' })}>
          ↺ Reset <Kbd>T</Kbd>
        </button>
      </div>
    </div>
  )

  switch (turn.stage) {
    case 'ready':
      return (
        <div className="bee-card p-4 flex flex-wrap items-center gap-3">
          {game.settings.doubleWordEnabled && (
            <button type="button" className="bee-btn bee-btn-gold" disabled={!game.tokens[team.id] || turn.doubled} onClick={act(() => dispatch({ type: 'activate-token' }))}>
              <Token available={Boolean(game.tokens[team.id])} size="sm" label={false} /> Play Double Word <Kbd>2</Kbd>
            </button>
          )}
          <button type="button" className="bee-btn bee-btn-ghost" onClick={() => dispatch({ type: 'replace' })}>
            🔄 Replace word <Kbd>W</Kbd>
          </button>
          <button type="button" className="bee-btn bee-btn-ghost" onClick={() => dispatch({ type: 'skip' })}>
            ⏭ Skip word <Kbd>K</Kbd>
          </button>
          <p className="bee-hint basis-full">
            Double Word must be played before the word is revealed. Replace draws a fresh word; Skip ends the turn with no points.
          </p>
        </div>
      )

    case 'revealed':
      return (
        <div className="bee-card p-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-4">
            {timerControls}
            <div className="flex-1 grid grid-cols-2 gap-3 min-w-[18rem]">
              <button type="button" className="bee-btn bee-btn-xl bee-btn-green" onClick={act(() => dispatch({ type: 'mark', result: 'correct' }))}>
                ✓ Correct <Kbd>C</Kbd>
              </button>
              <button type="button" className="bee-btn bee-btn-xl bee-btn-red" onClick={act(() => dispatch({ type: 'mark', result: 'incorrect' }))}>
                ✕ Wrong <Kbd>X</Kbd>
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="bee-btn bee-btn-sm bee-btn-ghost" onClick={() => dispatch({ type: 'replace' })}>
              🔄 Replace word <Kbd>W</Kbd>
            </button>
            <button type="button" className="bee-btn bee-btn-sm bee-btn-ghost" onClick={() => dispatch({ type: 'skip' })}>
              ⏭ Skip word <Kbd>K</Kbd>
            </button>
            <span className="bee-hint self-center ml-auto">
              Worth {turn.doubled ? `${round.points * 2} (doubled), or −${round.points} if missed` : `${round.points} ${round.points === 1 ? 'point' : 'points'}`}
              {game.timer.expired ? " · Time's up" : ''}
            </span>
          </div>
        </div>
      )

    case 'steal-select':
      return (
        <div className="bee-card p-4 flex flex-col gap-3 bee-anim-shake" style={{ borderColor: 'var(--bee-red)' }}>
          <p className="bee-display text-3xl text-[var(--bee-red-soft)]">
            Missed{turn.doubled ? ` (−${round.points}, Double Word)` : ''}. Steal for {stealWorth} {stealWorth === 1 ? 'point' : 'points'}!
          </p>
          <p className="text-lg">{game.settings.stealMode === 'written' ? 'Every other team writes their spelling. Pick the team that got it, or nobody.' : 'Which team is buzzing in?'}</p>
          <div className="flex flex-wrap gap-3">
            {others.map((other) => {
              const c = teamColor(other.color)
              return (
                <button
                  key={other.id}
                  type="button"
                  className="bee-btn bee-btn-lg"
                  style={{ background: c.bg, color: c.fg }}
                  onClick={act(() => dispatch(game.settings.stealMode === 'written' ? { type: 'steal-written', winnerId: other.id } : { type: 'steal-select', teamId: other.id }))}
                >
                  {other.name}
                </button>
              )
            })}
            <button
              type="button"
              className="bee-btn bee-btn-lg bee-btn-ghost"
              onClick={act(() => dispatch(game.settings.stealMode === 'written' ? { type: 'steal-written', winnerId: null } : { type: 'steal-select', teamId: null }))}
            >
              {game.settings.stealMode === 'written' ? 'Nobody got it' : 'No steal'}
            </button>
            <button type="button" className="bee-btn bee-btn-sm bee-btn-ghost self-center" onClick={onPronounce} disabled={!canSpeak()}>
              🔁 Say it again
            </button>
          </div>
        </div>
      )

    case 'steal-attempt':
      return (
        <div className="bee-card p-4 flex flex-col gap-4" style={{ borderColor: 'var(--bee-gold)' }}>
          <div className="flex flex-wrap items-center gap-3">
            <p className="bee-display text-3xl">Steal attempt:</p>
            {stealer && <TeamChip team={stealer} className="text-2xl" />}
            <span className="bee-hint">for {stealWorth} {stealWorth === 1 ? 'point' : 'points'}</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {timerControls}
            <div className="flex-1 grid grid-cols-2 gap-3 min-w-[18rem]">
              <button type="button" className="bee-btn bee-btn-xl bee-btn-green" onClick={act(() => dispatch({ type: 'steal-mark', result: 'correct' }))}>
                ✓ Stolen! <Kbd>C</Kbd>
              </button>
              <button type="button" className="bee-btn bee-btn-xl bee-btn-red" onClick={act(() => dispatch({ type: 'steal-mark', result: 'incorrect' }))}>
                ✕ Missed <Kbd>X</Kbd>
              </button>
            </div>
          </div>
        </div>
      )

    case 'resolved': {
      const isLast = turn.roundIndex === game.rounds.length - 1 && turn.indexInRound === turnsInRound(game, round) - 1
      const tone = turn.outcome === 'correct' ? 'var(--bee-green)' : turn.outcome === 'incorrect' ? 'var(--bee-red-soft)' : 'var(--bee-dim)'
      return (
        <div className="bee-card p-4 flex flex-wrap items-center gap-4" style={{ borderColor: tone }}>
          <div className="flex-1 min-w-[14rem]">
            <p className="bee-display text-3xl" style={{ color: tone }}>
              {turn.outcome === 'correct' && `Correct! ${formatPoints(turn.pointsAwarded)} for ${team.name}`}
              {turn.outcome === 'incorrect' && (turn.doubled ? `Missed. ${formatPoints(turn.pointsAwarded)} for ${team.name}` : `Missed. No points for ${team.name}`)}
              {turn.outcome === 'skipped' && 'Word skipped. No points.'}
            </p>
            {turn.stealOutcome === 'correct' && stealer && (
              <p className="bee-display text-2xl text-[var(--bee-green)]">
                {stealer.name} stole it for {formatPoints(turn.stealPointsAwarded)}!
              </p>
            )}
            {turn.stealOutcome === 'incorrect' && stealer && <p className="bee-display text-2xl text-[var(--bee-dim)]">{stealer.name} missed the steal.</p>}
            {word && turn.outcome !== 'skipped' && <p className="bee-hint mt-1">The word was “{word.word}”.</p>}
          </div>
          <button type="button" className="bee-btn bee-btn-xl bee-btn-gold" onClick={act(() => dispatch({ type: 'next' }))}>
            {isLast ? 'Finish the game' : 'Next contestant'} → <Kbd>N</Kbd>
          </button>
        </div>
      )
    }
    default:
      return null
  }
}

// ---------------------------------------------------------------------------

function RoundComplete({ game, onStart }: { game: GameState; onStart: () => void }) {
  const round = currentRound(game)
  const nextRound = game.rounds[(game.interlude?.roundIndex ?? 0) + 1]
  const rows = standings(game)
  const leaders = rows.filter((row) => row.rank === 1)
  return (
    <div className="bee-card p-6 md:p-8 text-center bee-anim-pop">
      <p className="bee-label">That&rsquo;s the end of</p>
      <p className="bee-display text-6xl md:text-8xl text-[var(--bee-gold)]">{round?.name}</p>
      {leaders.length > 0 && (
        <p className="text-xl mt-3">
          {leaders.length > 1 ? 'Tied at the top: ' : 'In the lead: '}
          <span className="bee-display text-2xl">{leaders.map((row) => row.team.name).join(' & ')}</span> with {leaders[0]?.score}
        </p>
      )}
      {nextRound && (
        <p className="bee-hint mt-2">
          Next: {nextRound.name} · {nextRound.points} pts a word · {difficultyLabel(nextRound.difficulty)} words{nextRound.distraction ? ' · distractions on' : ''}
        </p>
      )}
      <button type="button" className="bee-btn bee-btn-xl bee-btn-gold mt-6" onClick={onStart}>
        {nextRound ? `Start ${nextRound.name}` : 'See the results'} → <Kbd>N</Kbd>
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------

function AdjustScores({ game, onClose }: { game: GameState; onClose: () => void }) {
  const dispatch = useDispatch()
  const [reason, setReason] = useState('')
  const [custom, setCustom] = useState<Record<string, string>>({})
  const adjust = (teamId: string, delta: number) => {
    if (!delta) return
    dispatch({ type: 'adjust', teamId, delta, reason: reason || 'Host adjustment' })
  }
  return (
    <Dialog title="Adjust scores" onClose={onClose}>
      <label className="bee-field mb-4">
        <span className="bee-label">Reason (shows in the history)</span>
        <input className="bee-input" value={reason} onChange={(changeEvent) => setReason(changeEvent.target.value)} placeholder="Judge's ruling, bribe, heckling penalty…" />
      </label>
      <ul className="flex flex-col gap-3">
        {game.teams.map((team) => {
          const c = teamColor(team.color)
          return (
            <li key={team.id} className="bee-card-flat p-3 flex flex-wrap items-center gap-3">
              <span className="bee-display text-2xl flex-1 min-w-[8rem]" style={{ color: c.bg }}>
                {team.name}
              </span>
              <span className="bee-score text-4xl w-16 text-right">{game.scores[team.id] ?? 0}</span>
              <button type="button" className="bee-btn bee-btn-sm bee-btn-red" onClick={() => adjust(team.id, -1)} aria-label={`Subtract one point from ${team.name}`}>
                −1
              </button>
              <button type="button" className="bee-btn bee-btn-sm bee-btn-green" onClick={() => adjust(team.id, 1)} aria-label={`Add one point to ${team.name}`}>
                +1
              </button>
              <input
                type="number"
                className="bee-input w-24"
                aria-label={`Custom change for ${team.name}`}
                placeholder="±"
                value={custom[team.id] ?? ''}
                onChange={(changeEvent) => setCustom({ ...custom, [team.id]: changeEvent.target.value })}
              />
              <button
                type="button"
                className="bee-btn bee-btn-sm bee-btn-ghost"
                onClick={() => {
                  adjust(team.id, Number.parseInt(custom[team.id] ?? '', 10) || 0)
                  setCustom({ ...custom, [team.id]: '' })
                }}
              >
                Apply
              </button>
            </li>
          )
        })}
      </ul>
      <p className="bee-hint mt-4">Every change is logged and can be undone.</p>
    </Dialog>
  )
}
