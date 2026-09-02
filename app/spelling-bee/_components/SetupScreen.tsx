'use client'

import { useState } from 'react'
import { MAX_ROUNDS, MAX_TEAMS, TEAM_COLORS, defaultRounds, nextTeamColor, teamColor, uid } from '../_lib/defaults'
import { difficultyLabel, wordCounts } from '../_lib/engine'
import { plural, shuffle } from '../_lib/format'
import { primeAudio } from '../_lib/sound'
import { resetAll, useBee, useDispatch } from '../_lib/store'
import type { RoundConfig, RoundDifficulty, Settings, Team } from '../_lib/types'
import { DIFFICULTIES } from '../_lib/types'
import { POPUP_BLOCKED, openAudienceWindow } from './TopBar'
import { Confirm, Pill, Toast } from './ui'
import { WordBank } from './WordBank'

const int = (value: string, fallback: number): number => {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function SetupScreen() {
  const { game, words, undoDepth } = useBee()
  const dispatch = useDispatch()
  const [bankOpen, setBankOpen] = useState(false)
  const [confirm, setConfirm] = useState<'reset' | { removeTeam: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const counts = wordCounts(words, game.usedWordIds)
  const unused = DIFFICULTIES.reduce((sum, level) => sum + counts[level].left, 0)
  const wordsNeeded = game.rounds.reduce((sum, round) => sum + round.turnsPerTeam * game.teams.length, 0)
  const hasHistory = game.log.length > 0 || undoDepth > 0

  const say = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 3000)
  }

  const settings = (patch: Partial<Settings>) => dispatch({ type: 'settings', patch })
  const setTeams = (teams: Team[]) => dispatch({ type: 'teams', teams })
  const setRounds = (rounds: RoundConfig[]) => dispatch({ type: 'rounds', rounds })

  const start = () => {
    primeAudio()
    if (game.teams.length === 0) return setError('Add at least one team.')
    if (game.rounds.length === 0) return setError('Add at least one round.')
    if (game.rounds.some((round) => round.turnsPerTeam < 1)) return setError('Every round needs at least one turn per team.')
    if (unused === 0) return setError('The word bank has no unused words. Restore some or add new ones.')
    const teams = game.teams.map((team, index) => ({ ...team, name: team.name.trim() || `Team ${index + 1}` }))
    setTeams(teams)
    setError(null)
    dispatch({ type: 'start' })
  }

  return (
    <div className="bee-screen min-h-dvh flex flex-col">
      <header className="px-5 md:px-8 pt-6 pb-4 flex flex-wrap items-end gap-4">
        <div>
          <p className="bee-label">Game setup</p>
          <h1 className="bee-display text-5xl md:text-7xl text-[var(--bee-gold)]">{game.settings.eventName}</h1>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" className="bee-btn bee-btn-sm bee-btn-ghost" onClick={() => setBankOpen(true)}>
            Word bank
          </button>
          <button
            type="button"
            className="bee-btn bee-btn-sm bee-btn-teal"
            onClick={() => {
              if (!openAudienceWindow()) say(POPUP_BLOCKED)
            }}
          >
            ⧉ Open audience window
          </button>
        </div>
      </header>

      <main className="flex-1 px-5 md:px-8 pb-32 grid gap-6 lg:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr]">
        {/* Event ------------------------------------------------------------ */}
        <section className="bee-card p-5 flex flex-col gap-4 xl:col-span-3 lg:col-span-2">
          <div className="grid md:grid-cols-2 gap-4">
            <label className="bee-field">
              <span className="bee-label">Event name</span>
              <input className="bee-input bee-input-lg" value={game.settings.eventName} onChange={(changeEvent) => settings({ eventName: changeEvent.target.value })} onBlur={() => settings({})} />
            </label>
            <label className="bee-field">
              <span className="bee-label">Trophy title</span>
              <input className="bee-input bee-input-lg" value={game.settings.trophyTitle} onChange={(changeEvent) => settings({ trophyTitle: changeEvent.target.value })} onBlur={() => settings({})} />
            </label>
          </div>
        </section>

        {/* Teams ------------------------------------------------------------ */}
        <section className="bee-card p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <h2 className="bee-display text-3xl">Teams</h2>
            <span className="bee-hint">{plural(game.teams.length, 'team')}</span>
            <div className="ml-auto flex gap-2">
              <button type="button" className="bee-btn bee-btn-sm bee-btn-ghost" disabled={game.teams.length < 2} onClick={() => setTeams(shuffle(game.teams))}>
                🎲 Shuffle order
              </button>
              <button
                type="button"
                className="bee-btn bee-btn-sm bee-btn-gold"
                disabled={game.teams.length >= MAX_TEAMS}
                onClick={() =>
                  setTeams([...game.teams, { id: uid('team'), name: `Team ${game.teams.length + 1}`, color: nextTeamColor(game.teams.map((team) => team.color)), players: [] }])
                }
              >
                + Team
              </button>
            </div>
          </div>
          {game.teams.length === 0 && <p className="bee-hint">No teams yet. Add one, or three.</p>}
          <div className="flex flex-col gap-3">
            {game.teams.map((team, index) => (
              <TeamEditor
                key={team.id}
                team={team}
                index={index}
                onChange={(next) => setTeams(game.teams.map((item) => (item.id === team.id ? next : item)))}
                onRemove={() => (team.players.length ? setConfirm({ removeTeam: team.id }) : setTeams(game.teams.filter((item) => item.id !== team.id)))}
              />
            ))}
          </div>
        </section>

        {/* Rounds ----------------------------------------------------------- */}
        <section className="bee-card p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <h2 className="bee-display text-3xl">Rounds</h2>
            <span className="bee-hint">{plural(game.rounds.length, 'round')}</span>
            <div className="ml-auto flex gap-2">
              <button type="button" className="bee-btn bee-btn-sm bee-btn-ghost" onClick={() => setRounds(defaultRounds())}>
                Defaults
              </button>
              <button
                type="button"
                className="bee-btn bee-btn-sm bee-btn-gold"
                disabled={game.rounds.length >= MAX_ROUNDS}
                onClick={() => {
                  const last = game.rounds[game.rounds.length - 1]
                  setRounds([
                    ...game.rounds,
                    { id: uid('round'), name: `Round ${game.rounds.length + 1}`, points: (last?.points ?? 0) + 1, difficulty: last?.difficulty ?? 'medium', distraction: false, turnsPerTeam: last?.turnsPerTeam ?? 3 },
                  ])
                }}
              >
                + Round
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {game.rounds.map((round, index) => (
              <div key={round.id} className="bee-card-flat p-3 grid gap-3">
                <div className="flex items-center gap-2">
                  <span className="bee-rank">{index + 1}</span>
                  <label className="flex-1">
                    <span className="sr-only">Round name</span>
                    <input className="bee-input" value={round.name} onChange={(changeEvent) => setRounds(game.rounds.map((item) => (item.id === round.id ? { ...item, name: changeEvent.target.value } : item)))} />
                  </label>
                  <button type="button" className="bee-btn bee-btn-sm bee-btn-ghost" aria-label={`Remove ${round.name}`} disabled={game.rounds.length <= 1} onClick={() => setRounds(game.rounds.filter((item) => item.id !== round.id))}>
                    ✕
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                  <label className="bee-field">
                    <span className="bee-label">Points</span>
                    <input type="number" min={0} max={99} className="bee-input" value={round.points} onChange={(changeEvent) => setRounds(game.rounds.map((item) => (item.id === round.id ? { ...item, points: Math.max(0, int(changeEvent.target.value, item.points)) } : item)))} />
                  </label>
                  <label className="bee-field">
                    <span className="bee-label">Words each</span>
                    <input type="number" min={1} max={20} className="bee-input" value={round.turnsPerTeam} onChange={(changeEvent) => setRounds(game.rounds.map((item) => (item.id === round.id ? { ...item, turnsPerTeam: Math.max(1, int(changeEvent.target.value, item.turnsPerTeam)) } : item)))} />
                  </label>
                  <label className="bee-field">
                    <span className="bee-label">Difficulty</span>
                    <select className="bee-select" value={round.difficulty} onChange={(changeEvent) => setRounds(game.rounds.map((item) => (item.id === round.id ? { ...item, difficulty: changeEvent.target.value as RoundDifficulty } : item)))}>
                      {[...DIFFICULTIES, 'mixed' as const].map((level) => (
                        <option key={level} value={level}>
                          {difficultyLabel(level)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="bee-field items-start">
                    <span className="bee-label">Distraction</span>
                    <input type="checkbox" className="bee-check" checked={round.distraction} onChange={(changeEvent) => setRounds(game.rounds.map((item) => (item.id === round.id ? { ...item, distraction: changeEvent.target.checked } : item)))} />
                  </label>
                </div>
              </div>
            ))}
          </div>
          <p className="bee-hint">A distraction round hands every contestant a ridiculous task before their word. Recommended for exactly one round.</p>
        </section>

        {/* Rules ------------------------------------------------------------ */}
        <section className="bee-card p-5 flex flex-col gap-1">
          <h2 className="bee-display text-3xl mb-2">Rules</h2>

          <div className="bee-toggle-row">
            <div>
              <div className="font-semibold text-lg">Double Word tokens</div>
              <div className="bee-hint">One per team. Play it before the word: double points if right, minus the word&rsquo;s value if wrong.</div>
            </div>
            <input type="checkbox" className="bee-check" checked={game.settings.doubleWordEnabled} onChange={(changeEvent) => settings({ doubleWordEnabled: changeEvent.target.checked })} aria-label="Enable Double Word tokens" />
          </div>

          <div className="bee-toggle-row">
            <div>
              <div className="font-semibold text-lg">Timed rounds</div>
              <div className="bee-hint">A countdown the host starts after reading the word.</div>
            </div>
            <input type="checkbox" className="bee-check" checked={game.settings.timedRounds} onChange={(changeEvent) => settings({ timedRounds: changeEvent.target.checked })} aria-label="Enable timed rounds" />
          </div>
          {game.settings.timedRounds && (
            <label className="bee-field py-3 border-b border-[var(--bee-line)]">
              <span className="bee-label">Timer (seconds)</span>
              <input type="number" min={5} max={300} className="bee-input" value={game.settings.timerSeconds} onChange={(changeEvent) => settings({ timerSeconds: Math.min(300, Math.max(5, int(changeEvent.target.value, game.settings.timerSeconds))) })} />
            </label>
          )}

          <div className="bee-toggle-row">
            <div>
              <div className="font-semibold text-lg">Show the word on the audience screen</div>
              <div className="bee-hint">For contestants who face away from the TV. The word appears big once you reveal it.</div>
            </div>
            <input type="checkbox" className="bee-check" checked={game.settings.audienceShowsWord} onChange={(changeEvent) => settings({ audienceShowsWord: changeEvent.target.checked })} aria-label="Show the word on the audience screen" />
          </div>

          <div className="bee-toggle-row">
            <div>
              <div className="font-semibold text-lg">Rotate players automatically</div>
              <div className="bee-hint">Off means the host picks who spells at the start of each turn. Either way, the app suggests who is due.</div>
            </div>
            <input type="checkbox" className="bee-check" checked={game.settings.autoRotate} onChange={(changeEvent) => settings({ autoRotate: changeEvent.target.checked })} aria-label="Rotate players automatically" />
          </div>
        </section>

        {/* Words ------------------------------------------------------------ */}
        <section className="bee-card p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <h2 className="bee-display text-3xl">Words</h2>
            <button type="button" className="bee-btn bee-btn-sm bee-btn-gold ml-auto" onClick={() => setBankOpen(true)}>
              Manage word bank
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {DIFFICULTIES.map((level) => (
              <div key={level} className="bee-card-flat p-3 text-center">
                <div className="bee-score text-4xl">{counts[level].left}</div>
                <div className="bee-label">{difficultyLabel(level)}</div>
                <div className="bee-hint text-xs">of {counts[level].total}</div>
              </div>
            ))}
          </div>
          <p className="bee-hint">
            This setup needs about {plural(wordsNeeded, 'word')}. {unused} unused words are available
            {unused < wordsNeeded ? ' — fewer than needed, so rounds may borrow from neighbouring levels.' : '.'}
            {game.usedWordIds.length > 0 && ` ${plural(game.usedWordIds.length, 'word is', 'words are')} marked used from earlier games.`}
          </p>
          {game.usedWordIds.length > 0 && (
            <button type="button" className="bee-btn bee-btn-sm bee-btn-ghost self-start" onClick={() => dispatch({ type: 'restore-all-words' })}>
              Restore all used words
            </button>
          )}
        </section>

        {/* Data ------------------------------------------------------------- */}
        <section className="bee-card p-5 flex flex-col gap-3">
          <h2 className="bee-display text-3xl">This browser</h2>
          <p className="bee-hint">
            Everything is stored in this browser only: no accounts, no server, no internet needed. Setup, scores and the word bank survive a refresh.
            {hasHistory && ' A previous game is still in memory.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Pill>{plural(words.length, 'word')} in bank</Pill>
            <Pill>{plural(game.teams.length, 'team')}</Pill>
          </div>
          <button type="button" className="bee-btn bee-btn-sm bee-btn-red self-start" onClick={() => setConfirm('reset')}>
            Reset all stored data
          </button>
        </section>
      </main>

      <footer className="fixed bottom-0 inset-x-0 z-30 border-t-4 border-[var(--bee-ink)] bg-[var(--bee-bg-2)] px-5 md:px-8 py-4 flex flex-wrap items-center gap-4">
        <div className="text-lg">
          <span className="bee-display text-2xl">{plural(game.teams.length, 'team')}</span> · <span className="bee-display text-2xl">{plural(game.rounds.length, 'round')}</span> ·{' '}
          <span className="bee-display text-2xl">{plural(wordsNeeded, 'word')}</span>
          {game.settings.timedRounds && <span className="bee-hint"> · {game.settings.timerSeconds}s clock</span>}
        </div>
        {error && (
          <p role="alert" className="text-[var(--bee-red-soft)] font-semibold">
            {error}
          </p>
        )}
        <button type="button" className="bee-btn bee-btn-lg bee-btn-gold ml-auto" onClick={start}>
          Save setup &amp; start the bee →
        </button>
      </footer>

      {bankOpen && <WordBank onClose={() => setBankOpen(false)} />}
      {confirm === 'reset' && (
        <Confirm
          title="Erase everything?"
          body="Teams, settings, scores, history and any custom words are removed from this browser. There is no undo."
          confirmLabel="Erase all data"
          danger
          onConfirm={() => {
            resetAll()
            say('All stored data was erased')
          }}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm && confirm !== 'reset' && (
        <Confirm
          title="Remove this team?"
          body={`${game.teams.find((team) => team.id === confirm.removeTeam)?.name ?? 'The team'} and its players are removed from the setup.`}
          confirmLabel="Remove team"
          danger
          onConfirm={() => setTeams(game.teams.filter((team) => team.id !== confirm.removeTeam))}
          onClose={() => setConfirm(null)}
        />
      )}
      {toast && <Toast message={toast} />}
    </div>
  )
}

function TeamEditor({ team, index, onChange, onRemove }: { team: Team; index: number; onChange: (team: Team) => void; onRemove: () => void }) {
  const [draft, setDraft] = useState('')
  const color = teamColor(team.color)

  const addPlayer = () => {
    const name = draft.trim()
    if (!name) return
    onChange({ ...team, players: [...team.players, name] })
    setDraft('')
  }

  return (
    <div className="bee-card-flat p-3 grid gap-3" style={{ borderColor: color.bg }}>
      <div className="flex items-center gap-2">
        <span className="bee-rank" style={{ background: color.bg, color: color.fg }}>
          {index + 1}
        </span>
        <label className="flex-1">
          <span className="sr-only">Team name</span>
          <input className="bee-input bee-input-lg" value={team.name} placeholder={`Team ${index + 1}`} onChange={(changeEvent) => onChange({ ...team, name: changeEvent.target.value })} />
        </label>
        <button type="button" className="bee-btn bee-btn-sm bee-btn-ghost" onClick={onRemove} aria-label={`Remove ${team.name || `team ${index + 1}`}`}>
          ✕
        </button>
      </div>

      <fieldset className="flex flex-wrap gap-2 items-center">
        <legend className="bee-label mb-1">Color: {color.name}</legend>
        {TEAM_COLORS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={team.color === option.id}
            aria-label={option.name}
            title={option.name}
            className="w-9 h-9 rounded-full border-[3px] grid place-items-center bee-display text-lg"
            style={{ background: option.bg, color: option.fg, borderColor: team.color === option.id ? 'var(--bee-cream)' : 'var(--bee-ink)', transform: team.color === option.id ? 'scale(1.15)' : undefined }}
            onClick={() => onChange({ ...team, color: option.id })}
          >
            {team.color === option.id ? '✓' : ''}
          </button>
        ))}
      </fieldset>

      <div>
        <div className="bee-label mb-1">Players</div>
        <ul className="flex flex-wrap gap-2 mb-2">
          {team.players.length === 0 && <li className="bee-hint">Nobody yet. Add names below; they rotate in this order.</li>}
          {team.players.map((player, playerIndex) => (
            <li key={`${player}-${playerIndex}`} className="inline-flex items-center gap-1 rounded-full bg-[var(--bee-ink)] pl-3 pr-1 py-1 text-base">
              {player}
              <button
                type="button"
                className="w-7 h-7 rounded-full grid place-items-center hover:bg-[var(--bee-surface-2)]"
                aria-label={`Remove ${player}`}
                onClick={() => onChange({ ...team, players: team.players.filter((_, i) => i !== playerIndex) })}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <label className="flex-1">
            <span className="sr-only">Add a player to {team.name}</span>
            <input
              className="bee-input"
              placeholder="Add a player and press Enter"
              value={draft}
              onChange={(changeEvent) => setDraft(changeEvent.target.value)}
              onKeyDown={(keyEvent) => {
                if (keyEvent.key === 'Enter') {
                  keyEvent.preventDefault()
                  addPlayer()
                }
              }}
            />
          </label>
          <button type="button" className="bee-btn bee-btn-sm bee-btn-ghost" onClick={addPlayer} disabled={!draft.trim()}>
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
