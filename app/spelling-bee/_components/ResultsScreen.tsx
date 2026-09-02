'use client'

import { useMemo, useState } from 'react'
import { teamColor } from '../_lib/defaults'
import { gameStats, teamById } from '../_lib/engine'
import { formatDuration, ordinal, plural } from '../_lib/format'
import { useShortcuts } from '../_lib/hooks'
import { primeAudio } from '../_lib/sound'
import { useBee, useDispatch } from '../_lib/store'
import { HistoryList, PrintSummary } from './History'
import { TopBar } from './TopBar'
import { Confirm, Dialog, Token } from './ui'

export function ResultsScreen({ onAudienceMode }: { onAudienceMode: () => void }) {
  const { game } = useBee()
  const dispatch = useDispatch()
  const [dialog, setDialog] = useState<'history' | 'rematch' | 'new' | 'setup' | null>(null)
  const stats = useMemo(() => gameStats(game), [game])
  const winner = teamById(game, game.winnerId)
  const color = winner ? teamColor(winner.color) : null

  useShortcuts({ a: onAudienceMode }, dialog === null)

  return (
    <div className="bee-screen min-h-dvh flex flex-col gap-4 p-4 md:p-6">
      <TopBar game={game} onAudienceMode={onAudienceMode} showUndo={false} />

      <main className="grid lg:grid-cols-[1.3fr_1fr] gap-4 items-start">
        <section className="flex flex-col gap-4">
          <div className="text-center">
            <p className="bee-label text-lg">{game.settings.trophyTitle}</p>
            {winner && color ? (
              <div className="bee-marquee inline-block mt-4 px-8 py-6 md:px-14 md:py-8 bee-anim-pop" style={{ background: color.bg, color: color.fg }}>
                <p className="bee-display text-2xl md:text-3xl opacity-80">🏆 Champions 🏆</p>
                <p className="bee-display text-[clamp(3.5rem,8vw,8rem)] leading-none">{winner.name}</p>
                <p className="text-xl mt-2">{winner.players.join(' · ') || 'A team of mystery'}</p>
                <p className="bee-score text-5xl mt-3">{game.scores[winner.id] ?? 0} pts</p>
              </div>
            ) : (
              <p className="bee-display text-6xl mt-4">No winner recorded</p>
            )}
          </div>

          <ol className="flex flex-col gap-2 mt-2">
            {stats.teams.map((row, index) => (
              <li key={row.team.id} className="bee-card-flat flex flex-wrap items-center gap-3 px-4 py-3 bee-anim-rise" style={{ animationDelay: `${index * 80}ms` }}>
                <span className="bee-rank" style={index === 0 ? { background: 'var(--bee-gold)', color: 'var(--bee-ink)' } : undefined}>
                  {row.rank}
                </span>
                <span className="bee-display text-3xl flex-1 min-w-[10rem]" style={{ color: teamColor(row.team.color).bg }}>
                  {row.team.name}
                </span>
                <span className="bee-hint">{ordinal(row.rank)}</span>
                <span className="text-base bee-tabular">
                  {row.correct} ✓ · {row.incorrect} ✕ · {row.accuracy === null ? '—' : `${Math.round(row.accuracy * 100)}%`}
                </span>
                {game.settings.doubleWordEnabled && <Token available={row.tokenLeft} size="sm" label={false} />}
                <span className="bee-score text-5xl w-20 text-right">{row.score}</span>
              </li>
            ))}
          </ol>
        </section>

        <aside className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Correct" value={String(stats.totalCorrect)} />
            <Stat label="Missed" value={String(stats.totalIncorrect)} />
            <Stat label="Hardest word spelled" value={stats.hardestWord ? stats.hardestWord.word : '—'} detail={stats.hardestWord ? `${stats.hardestWord.difficulty} · ${stats.hardestWord.team.name}` : 'Nobody got a hard one'} />
            <Stat label="Most missed" value={stats.mostMissed ? stats.mostMissed.word : '—'} detail={stats.mostMissed ? `missed ${plural(stats.mostMissed.misses, 'time')}` : 'Nothing was missed twice'} />
            <Stat label="Biggest steal" value={stats.biggestSteal ? `+${stats.biggestSteal.points}` : '—'} detail={stats.biggestSteal ? `${stats.biggestSteal.team.name} took “${stats.biggestSteal.word}” from ${stats.biggestSteal.from.name}` : 'No successful steals'} />
            <Stat label="Tokens unused" value={String(stats.tokensLeft.length)} detail={stats.tokensLeft.length ? stats.tokensLeft.map((team) => team.name).join(', ') : 'Everyone played theirs'} />
          </div>
          {stats.durationMs !== null && <p className="bee-hint text-center">The whole thing took {formatDuration(stats.durationMs)}.</p>}

          <div className="bee-card p-4 grid gap-2">
            <button type="button" className="bee-btn bee-btn-lg bee-btn-gold" onClick={() => setDialog('rematch')}>
              🔁 Rematch, same teams
            </button>
            <button type="button" className="bee-btn bee-btn-ghost" onClick={() => setDialog('history')}>
              📜 Review the game
            </button>
            <button type="button" className="bee-btn bee-btn-ghost" onClick={() => window.print()}>
              🖨 Print summary
            </button>
            <button type="button" className="bee-btn bee-btn-ghost" onClick={() => setDialog('setup')}>
              ⚙ Back to setup
            </button>
            <button type="button" className="bee-btn bee-btn-ghost" onClick={() => setDialog('new')}>
              ✨ New game
            </button>
          </div>
        </aside>
      </main>

      <PrintSummary game={game} stats={stats} />

      {dialog === 'history' && (
        <Dialog title="Every turn" onClose={() => setDialog(null)} wide>
          <div className="max-h-[60vh] overflow-auto pr-1">
            <HistoryList game={game} />
          </div>
        </Dialog>
      )}
      {dialog === 'rematch' && (
        <Confirm
          title="Start a rematch?"
          body="Same teams, same rules, scores back to zero. Words already used stay out of the draw. These results are cleared, so print first if you want them."
          confirmLabel="Start rematch"
          onConfirm={() => {
            primeAudio()
            dispatch({ type: 'rematch' })
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'setup' && (
        <Confirm
          title="Back to setup?"
          body="Teams, rules and the word bank are kept so you can tweak them. These results are cleared."
          confirmLabel="Go to setup"
          onConfirm={() => dispatch({ type: 'to-setup' })}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'new' && (
        <Confirm
          title="Create a new game?"
          body="Opens setup with every word available again. Teams and rules stay as they are for editing; these results are cleared."
          confirmLabel="New game"
          onConfirm={() => dispatch({ type: 'new-game' })}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="bee-card-flat p-3">
      <p className="bee-label">{label}</p>
      <p className="bee-display text-3xl md:text-4xl mt-1 break-words">{value}</p>
      {detail && <p className="bee-hint text-sm mt-1">{detail}</p>}
    </div>
  )
}
