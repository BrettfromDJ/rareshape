'use client'

import { useState } from 'react'
import { teamColor } from '../_lib/defaults'
import { teamById, wordById } from '../_lib/engine'
import { useShortcuts } from '../_lib/hooks'
import { canSpeak, primeAudio, speak } from '../_lib/sound'
import { undo, useBee, useDispatch } from '../_lib/store'
import type { Team } from '../_lib/types'
import { Leaderboard } from './Leaderboard'
import { TimerRing } from './TimerRing'
import { TopBar } from './TopBar'
import { Kbd, Pill, Toast } from './ui'

/** Sudden death for tied teams: one word, whiteboards, until one team stands. */
export function TiebreakerScreen({ onAudienceMode }: { onAudienceMode: () => void }) {
  const { game, words } = useBee()
  const dispatch = useDispatch()
  const [toast, setToast] = useState<string | null>(null)
  const tb = game.tiebreak
  const word = wordById(words, tb?.wordId)
  const teams = (tb?.teamIds ?? []).map((id) => teamById(game, id)).filter((team): team is Team => Boolean(team))
  const allMarked = Boolean(tb) && teams.every((team) => tb?.marks[team.id] !== undefined)
  const timed = game.settings.timedRounds

  const say = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 3000)
  }

  useShortcuts({
    r: tb && !tb.revealed && word ? () => dispatch({ type: 'tiebreak-reveal' }) : undefined,
    space: timed && tb?.revealed ? () => dispatch({ type: game.timer.running ? 'timer-pause' : 'timer-start' }) : undefined,
    t: timed ? () => dispatch({ type: 'timer-reset' }) : undefined,
    p: word && tb?.revealed ? () => speak(word.word) : undefined,
    z: () => undo() && say('Undid the last action'),
    'mod+z': () => undo() && say('Undid the last action'),
    a: onAudienceMode,
  })

  if (!tb) return null

  return (
    <div className="bee-screen min-h-dvh flex flex-col gap-4 p-4 md:p-6">
      <TopBar game={game} onAudienceMode={onAudienceMode}>
        <Pill tone="red">Sudden death</Pill>
        <Pill>Word {tb.wordNumber}</Pill>
        <Pill>{teams.length} teams tied</Pill>
      </TopBar>

      <main className="flex-1 grid lg:grid-cols-[1.55fr_1fr] gap-4">
        <section className="flex flex-col gap-4">
          <div className="bee-card p-5">
            <p className="bee-label">Tiebreaker</p>
            <p className="bee-display text-5xl md:text-6xl text-[var(--bee-red-soft)]">Whiteboards up</p>
            <p className="text-lg mt-2">
              Every tied team writes the same word. One team right wins. Several right: another word. Nobody right: you pick who got closest.
            </p>
          </div>

          {!tb.revealed ? (
            <div className="bee-plate p-5 flex flex-wrap items-center gap-4">
              <p className="flex-1 text-lg">{word ? 'A word is loaded. Reveal it when the boards are ready.' : (tb.wordNote ?? 'No word could be drawn. Restore words in the word bank.')}</p>
              <button type="button" className="bee-btn bee-btn-xl bee-btn-gold" disabled={!word} onClick={() => { primeAudio(); dispatch({ type: 'tiebreak-reveal' }) }}>
                👁 Reveal word <Kbd>R</Kbd>
              </button>
            </div>
          ) : (
            word && (
              <div className="bee-plate p-5 bee-anim-pop">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="bee-label" style={{ color: 'var(--bee-ink)', opacity: 0.6 }}>
                      Host only · {word.difficulty} · {word.partOfSpeech}
                    </p>
                    <p className="bee-display text-[clamp(3rem,6.5vw,6.5rem)] leading-none tracking-wider break-words">{word.word}</p>
                    {word.pronunciation && <p className="font-mono text-lg mt-1 opacity-80">{word.pronunciation}</p>}
                    <p className="text-xl mt-3">{word.definition}</p>
                    <p className="text-xl mt-1 opacity-80">“{word.sentence}”</p>
                    {tb.wordNote && <p className="text-sm mt-2 opacity-70">{tb.wordNote}</p>}
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    {timed && <TimerRing timer={game.timer} size={140} />}
                    <div className="flex gap-2">
                      {timed && (
                        <button type="button" className="bee-btn bee-btn-sm bee-btn-teal" onClick={() => dispatch({ type: game.timer.running ? 'timer-pause' : 'timer-start' })}>
                          {game.timer.running ? '⏸' : '▶'} <Kbd>Space</Kbd>
                        </button>
                      )}
                      <button type="button" className="bee-btn bee-btn-sm" onClick={() => speak(word.word)} disabled={!canSpeak()}>
                        🔁 Say it
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          )}

          {tb.revealed && !tb.picking && (
            <div className="bee-card p-4 flex flex-col gap-3">
              <p className="bee-label">Mark each team</p>
              {teams.map((team) => {
                const c = teamColor(team.color)
                const mark = tb.marks[team.id]
                return (
                  <div key={team.id} className="flex flex-wrap items-center gap-3">
                    <span className="bee-display text-3xl flex-1 min-w-[10rem]" style={{ color: c.bg }}>
                      {team.name}
                    </span>
                    <button type="button" className={`bee-btn ${mark === true ? 'bee-btn-green' : 'bee-btn-ghost'}`} aria-pressed={mark === true} onClick={() => dispatch({ type: 'tiebreak-mark', teamId: team.id, correct: true })}>
                      ✓ Correct
                    </button>
                    <button type="button" className={`bee-btn ${mark === false ? 'bee-btn-red' : 'bee-btn-ghost'}`} aria-pressed={mark === false} onClick={() => dispatch({ type: 'tiebreak-mark', teamId: team.id, correct: false })}>
                      ✕ Wrong
                    </button>
                  </div>
                )
              })}
              <button type="button" className="bee-btn bee-btn-xl bee-btn-gold self-end mt-2" disabled={!allMarked} onClick={() => { primeAudio(); dispatch({ type: 'tiebreak-resolve' }) }}>
                Lock in results →
              </button>
            </div>
          )}

          {tb.picking && (
            <div className="bee-card p-4 flex flex-col gap-3" style={{ borderColor: 'var(--bee-gold)' }}>
              <p className="bee-display text-3xl">Nobody got it. Who spelled the most of it correctly?</p>
              <div className="flex flex-wrap gap-3">
                {teams.map((team) => {
                  const c = teamColor(team.color)
                  return (
                    <button key={team.id} type="button" className="bee-btn bee-btn-lg" style={{ background: c.bg, color: c.fg }} onClick={() => { primeAudio(); dispatch({ type: 'tiebreak-pick', teamId: team.id }) }}>
                      {team.name} wins
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </section>

        <aside>
          <p className="bee-label mb-2">Standings</p>
          <Leaderboard game={game} showPlayers={false} />
        </aside>
      </main>
      {toast && <Toast message={toast} />}
    </div>
  )
}
