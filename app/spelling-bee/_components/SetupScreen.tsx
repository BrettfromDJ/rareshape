'use client'

import { useState } from 'react'
import { MAX_KIDS, MAX_TEAMS, TEAM_COLORS, kidTeam, nextTeamColor, teamColor, uid } from '../_lib/defaults'
import { totalTurns, wordCounts } from '../_lib/engine'
import { plural, shuffle } from '../_lib/format'
import { primeAudio } from '../_lib/sound'
import { resetAll, useBee, useDispatch } from '../_lib/store'
import type { Settings, Team } from '../_lib/types'
import { AudienceHelp, POPUP_BLOCKED, openAudienceWindow } from './TopBar'
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
  const [audienceHelp, setAudienceHelp] = useState(false)
  const [confirm, setConfirm] = useState<'reset' | { removeTeam: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const counts = wordCounts(words, game.usedWordIds)
  const unused = counts.left
  const wordsNeeded = totalTurns(game)
  const kids = game.settings.mode === 'kids'
  const who = kids ? 'kid' : 'team'
  const hasHistory = game.log.length > 0 || undoDepth > 0

  const say = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 3000)
  }

  const settings = (patch: Partial<Settings>) => dispatch({ type: 'settings', patch })
  const setTeams = (teams: Team[]) => dispatch({ type: 'teams', teams })

  const start = () => {
    primeAudio()
    if (game.teams.length === 0) return setError(kids ? 'Add at least one kid.' : 'Add at least one team.')
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
              const result = openAudienceWindow()
              if (result === 'blocked') say(POPUP_BLOCKED)
              if (result === 'framed') setAudienceHelp(true)
            }}
          >
            ⧉ Open audience window
          </button>
        </div>
      </header>

      <main className="flex-1 px-5 md:px-8 pb-32 grid gap-6 lg:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr]">
        {/* Event ------------------------------------------------------------ */}
        <section className="bee-card p-5 flex flex-col gap-4 xl:col-span-3 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className="bee-label">Who is playing</span>
            <div className="flex gap-2" role="radiogroup" aria-label="Game mode">
              <button type="button" role="radio" aria-checked={!kids} className={`bee-btn ${kids ? 'bee-btn-ghost' : 'bee-btn-gold'}`} onClick={() => dispatch({ type: 'mode', mode: 'adults' })}>
                🍻 Adults · in teams
              </button>
              <button type="button" role="radio" aria-checked={kids} className={`bee-btn ${kids ? 'bee-btn-gold' : 'bee-btn-ghost'}`} onClick={() => dispatch({ type: 'mode', mode: 'kids' })}>
                ⭐ Kids · everyone for themselves
              </button>
            </div>
            <span className="bee-hint">{kids ? 'Short words, no teams, no timer, no Double Word. Each mode keeps its own word bank and line-up.' : 'Teams, the full word bank, and all the rules below.'}</span>
          </div>
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
        {kids ? (
          <KidsEditor teams={game.teams} onChange={setTeams} />
        ) : (
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
        )}

        {/* Game ------------------------------------------------------------- */}
        <section className="bee-card p-5 flex flex-col gap-4">
          <h2 className="bee-display text-3xl">The game</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="bee-field">
              <span className="bee-label">{kids ? 'Words each kid spells' : 'Words each person spells'}</span>
              <input type="number" min={1} max={20} className="bee-input bee-input-lg" value={game.settings.timesEach} onChange={(changeEvent) => settings({ timesEach: Math.min(20, Math.max(1, int(changeEvent.target.value, game.settings.timesEach))) })} />
            </label>
            <label className="bee-field">
              <span className="bee-label">Points per word</span>
              <input type="number" min={0} max={99} className="bee-input bee-input-lg" value={game.settings.pointsPerWord} onChange={(changeEvent) => settings({ pointsPerWord: Math.max(0, int(changeEvent.target.value, game.settings.pointsPerWord)) })} />
            </label>
          </div>
          <p className="bee-hint">
            {kids ? 'Kids take turns in order' : 'Teams take turns in a loop'} until everyone has spelled {plural(game.settings.timesEach, 'word')}. That is {plural(wordsNeeded, 'turn')} in all
            {!kids && game.teams.some((team) => team.players.length === 0) ? '; a team with no players listed gets one turn per go.' : '.'}
          </p>
          <div className="bee-toggle-row">
            <div>
              <div className="font-semibold text-lg">Final round is worth double</div>
              <div className="bee-hint">Everyone&rsquo;s last word pays {game.settings.pointsPerWord * 2} instead of {game.settings.pointsPerWord}. Announced on both screens when it starts.</div>
            </div>
            <input type="checkbox" className="bee-check" checked={game.settings.finalRoundDouble} onChange={(changeEvent) => settings({ finalRoundDouble: changeEvent.target.checked })} aria-label="Final round is worth double" />
          </div>
          <div className="bee-toggle-row">
            <div>
              <div className="font-semibold text-lg">Distractions</div>
              <div className="bee-hint">Every contestant gets a ridiculous task before their word: oven mitts, one leg, a British accent.</div>
            </div>
            <input type="checkbox" className="bee-check" checked={game.settings.distractions} onChange={(changeEvent) => settings({ distractions: changeEvent.target.checked })} aria-label="Enable distractions" />
          </div>
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
              <div className="font-semibold text-lg">Timed turns</div>
              <div className="bee-hint">A countdown the host starts after reading the word.</div>
            </div>
            <input type="checkbox" className="bee-check" checked={game.settings.timedRounds} onChange={(changeEvent) => settings({ timedRounds: changeEvent.target.checked })} aria-label="Enable timed turns" />
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
          <div className="grid grid-cols-2 gap-2">
            <div className="bee-card-flat p-3 text-center">
              <div className="bee-score text-4xl">{counts.left}</div>
              <div className="bee-label">Unused</div>
            </div>
            <div className="bee-card-flat p-3 text-center">
              <div className="bee-score text-4xl">{counts.total}</div>
              <div className="bee-label">In the bank</div>
            </div>
          </div>
          <p className="bee-hint">
            This setup needs about {plural(wordsNeeded, 'word')}. {unused} unused words are available
            {unused < wordsNeeded ? ' — fewer than needed, so add more before you start.' : '.'}
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
            <Pill>{plural(words.length, 'word')} in the {kids ? 'kids' : 'adult'} bank</Pill>
            <Pill>{plural(game.teams.length, who)}</Pill>
          </div>
          <button type="button" className="bee-btn bee-btn-sm bee-btn-red self-start" onClick={() => setConfirm('reset')}>
            Reset all stored data
          </button>
        </section>
      </main>

      <footer className="fixed bottom-0 inset-x-0 z-30 border-t-4 border-[var(--bee-ink)] bg-[var(--bee-bg-2)] px-5 md:px-8 py-4 flex flex-wrap items-center gap-4">
        <div className="text-lg">
          <span className="bee-display text-2xl">{plural(game.teams.length, who)}</span> · <span className="bee-display text-2xl">{plural(wordsNeeded, 'turn')}</span> ·{' '}
          <span className="bee-display text-2xl">{game.settings.pointsPerWord} {game.settings.pointsPerWord === 1 ? 'pt' : 'pts'} a word</span>
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
      {audienceHelp && <AudienceHelp onClose={() => setAudienceHelp(false)} />}
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

/** Kids mode: one name per line, each a team of one with its own colour. */
function KidsEditor({ teams, onChange }: { teams: Team[]; onChange: (teams: Team[]) => void }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const names = draft
      .split(/[\n,;]+/)
      .map((name) => name.trim())
      .filter(Boolean)
    if (!names.length) return
    let next = teams
    for (const name of names) {
      if (next.length >= MAX_KIDS) break
      next = [...next, kidTeam(name, next.map((team) => team.color))]
    }
    onChange(next)
    setDraft('')
  }
  return (
    <section className="bee-card p-5 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h2 className="bee-display text-3xl">Kids</h2>
        <span className="bee-hint">{plural(teams.length, 'kid')}</span>
        <button type="button" className="bee-btn bee-btn-sm bee-btn-ghost ml-auto" disabled={teams.length < 2} onClick={() => onChange(shuffle(teams))}>
          🎲 Shuffle order
        </button>
      </div>
      <div className="flex gap-2">
        <label className="flex-1">
          <span className="sr-only">Add a kid</span>
          <input
            className="bee-input bee-input-lg"
            placeholder="Add a name and press Enter"
            value={draft}
            onChange={(changeEvent) => setDraft(changeEvent.target.value)}
            onKeyDown={(keyEvent) => {
              if (keyEvent.key === 'Enter') {
                keyEvent.preventDefault()
                add()
              }
            }}
          />
        </label>
        <button type="button" className="bee-btn bee-btn-gold" onClick={add} disabled={!draft.trim() || teams.length >= MAX_KIDS}>
          + Add
        </button>
      </div>
      {teams.length === 0 && <p className="bee-hint">Nobody yet. Add the kids in the order they should go; paste several names separated by commas.</p>}
      <ol className="flex flex-col gap-2">
        {teams.map((team, index) => {
          const color = teamColor(team.color)
          return (
            <li key={team.id} className="bee-card-flat flex items-center gap-3 px-3 py-2" style={{ borderColor: color.bg }}>
              <span className="bee-rank" style={{ background: color.bg, color: color.fg }}>
                {index + 1}
              </span>
              <input
                className="bee-input bee-input-lg flex-1"
                aria-label={`Kid ${index + 1} name`}
                value={team.name}
                onChange={(changeEvent) => onChange(teams.map((item) => (item.id === team.id ? { ...item, name: changeEvent.target.value, players: [changeEvent.target.value] } : item)))}
              />
              <button type="button" className="bee-btn bee-btn-sm bee-btn-ghost" aria-label={`Remove ${team.name}`} onClick={() => onChange(teams.filter((item) => item.id !== team.id))}>
                ✕
              </button>
            </li>
          )
        })}
      </ol>
    </section>
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
