/**
 * Pure game logic. Every host action is a plain object handed to `reduce`,
 * which returns the next state. Nothing here touches the DOM, so the store can
 * snapshot states for undo and mirror them to a second window.
 */
import { DEFAULT_EVENT_NAME, DEFAULT_TROPHY_TITLE, idleTimer, uid } from './defaults'
import { pickDistraction } from './distractions'
import type {
  EventType,
  GameState,
  LogEntry,
  Outcome,
  Settings,
  Team,
  TiebreakState,
  Turn,
  Word,
} from './types'

export type Action =
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'teams'; teams: Team[] }
  | { type: 'start' }
  | { type: 'reveal' }
  | { type: 'toggle-definition' }
  | { type: 'toggle-sentence' }
  | { type: 'timer-start' }
  | { type: 'timer-pause' }
  | { type: 'timer-reset' }
  | { type: 'timer-expired' }
  | { type: 'mark'; result: 'correct' | 'incorrect' }
  | { type: 'skip' }
  | { type: 'replace' }
  | { type: 'activate-token' }
  | { type: 'set-contestant'; playerIndex: number }
  | { type: 'next' }
  | { type: 'adjust'; teamId: string; delta: number; reason: string }
  | { type: 'pause'; paused: boolean }
  | { type: 'end' }
  | { type: 'tiebreak-reveal' }
  | { type: 'tiebreak-mark'; teamId: string; correct: boolean }
  | { type: 'tiebreak-resolve' }
  | { type: 'tiebreak-pick'; teamId: string }
  | { type: 'restore-word'; wordId: string }
  | { type: 'restore-all-words' }
  | { type: 'mark-words-used'; wordIds: string[] }
  | { type: 'rematch' }
  | { type: 'new-game' }
  | { type: 'to-setup' }
  | { type: 'clear-event' }

/** Actions that push an undo snapshot before they run. */
export const UNDOABLE: ReadonlySet<Action['type']> = new Set<Action['type']>([
  'reveal',
  'mark',
  'skip',
  'replace',
  'activate-token',
  'set-contestant',
  'next',
  'adjust',
  'end',
  'tiebreak-reveal',
  'tiebreak-mark',
  'tiebreak-resolve',
  'tiebreak-pick',
  'restore-word',
  'restore-all-words',
])

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export interface Standing {
  team: Team
  score: number
  rank: number
}

export function standings(state: GameState): Standing[] {
  const sorted = [...state.teams].sort((a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0))
  const rows: Standing[] = []
  sorted.forEach((team, index) => {
    const score = state.scores[team.id] ?? 0
    const previous = rows[index - 1]
    const rank = previous && previous.score === score ? previous.rank : index + 1
    rows.push({ team, score, rank })
  })
  if (state.finalOrder.length) {
    const order = new Map(state.finalOrder.map((id, index) => [id, index]))
    rows.sort((a, b) => (order.get(a.team.id) ?? 99) - (order.get(b.team.id) ?? 99))
    rows.forEach((row, index) => {
      row.rank = index + 1
    })
  }
  return rows
}

export function teamById(state: GameState, id: string | null | undefined): Team | undefined {
  return state.teams.find((team) => team.id === id)
}

export function wordById(words: Word[], id: string | null | undefined): Word | undefined {
  return words.find((word) => word.id === id)
}

export function contestantName(team: Team | undefined, playerIndex: number): string {
  if (!team) return 'Nobody'
  return team.players[playerIndex] ?? 'Anyone on the team'
}

/** Words a team spells over the game: every player goes `timesEach` times. */
export function turnsForTeam(team: Team, settings: Settings): number {
  return Math.max(1, team.players.length) * Math.max(1, settings.timesEach)
}

/**
 * The order of play: teams take turns in a loop, each team dropping out once
 * everyone on it has had their go. Derived from setup, so nothing is stored.
 */
export function schedule(state: GameState): string[] {
  const order: string[] = []
  const longest = Math.max(0, ...state.teams.map((team) => turnsForTeam(team, state.settings)))
  for (let pass = 0; pass < longest; pass += 1) {
    for (const team of state.teams) {
      if (pass < turnsForTeam(team, state.settings)) order.push(team.id)
    }
  }
  return order
}

export function totalTurns(state: GameState): number {
  return schedule(state).length
}

/** Which team spells the turn after this one, so the host can announce it. */
export function upNext(state: GameState): { team: Team; playerIndex: number } | null {
  const turn = state.turn
  if (!turn) return null
  const team = teamById(state, schedule(state)[turn.number])
  if (!team) return null
  const playerIndex =
    team.id === turn.teamId
      ? team.players.length
        ? (turn.playerIndex + 1) % team.players.length
        : -1
      : (state.rotation[team.id] ?? 0)
  return { team, playerIndex }
}

export function wordCounts(words: Word[], usedIds: string[]): { total: number; left: number } {
  const used = new Set(usedIds)
  return { total: words.length, left: words.filter((word) => !used.has(word.id)).length }
}

// ---------------------------------------------------------------------------
// Word drawing
// ---------------------------------------------------------------------------

function draw(words: Word[], usedIds: string[], exclude: string[] = []): { wordId: string | null; note: string | null } {
  const blocked = new Set([...usedIds, ...exclude])
  const fresh = words.filter((word) => !blocked.has(word.id))
  if (fresh.length === 0) {
    return { wordId: null, note: 'Every word in the bank has been used. Restore some words or add new ones.' }
  }
  const pick = fresh[Math.floor(Math.random() * fresh.length)] as Word
  return { wordId: pick.id, note: null }
}

// ---------------------------------------------------------------------------
// Turn construction
// ---------------------------------------------------------------------------

function makeTurn(state: GameState, words: Word[], number: number): { turn: Turn; lastDistraction: string | null } {
  const team = teamById(state, schedule(state)[number - 1]) as Team
  const playerIndex = team.players.length ? (state.rotation[team.id] ?? 0) % team.players.length : -1
  const drawn = draw(words, state.usedWordIds)
  const distraction = state.settings.distractions ? pickDistraction(state.lastDistraction) : null
  return {
    turn: {
      number,
      teamId: team.id,
      playerIndex,
      wordId: drawn.wordId,
      wordNote: drawn.note,
      stage: 'ready',
      doubled: false,
      distraction,
      showDefinition: false,
      showSentence: false,
      outcome: null,
      pointsAwarded: 0,
    },
    lastDistraction: distraction ?? state.lastDistraction,
  }
}

function event(type: EventType, teamId?: string): GameState['lastEvent'] {
  return { id: uid('ev'), type, at: Date.now(), ...(teamId ? { teamId } : {}) }
}

function logEntry(partial: Omit<LogEntry, 'id' | 'at'>): LogEntry {
  return { id: uid('log'), at: Date.now(), ...partial }
}

function addScore(state: GameState, teamId: string, delta: number): Record<string, number> {
  return { ...state.scores, [teamId]: (state.scores[teamId] ?? 0) + delta }
}

function markUsed(state: GameState, wordId: string | null): string[] {
  if (!wordId || state.usedWordIds.includes(wordId)) return state.usedWordIds
  return [...state.usedWordIds, wordId]
}

function freshScores(teams: Team[]): Record<string, number> {
  return Object.fromEntries(teams.map((team) => [team.id, 0]))
}

function freshTokens(teams: Team[], enabled: boolean): Record<string, boolean> {
  return Object.fromEntries(teams.map((team) => [team.id, enabled]))
}

function beginGame(state: GameState, words: Word[], keepUsed: boolean): GameState {
  const base: GameState = {
    ...state,
    phase: 'playing',
    scores: freshScores(state.teams),
    tokens: freshTokens(state.teams, state.settings.doubleWordEnabled),
    rotation: Object.fromEntries(state.teams.map((team) => [team.id, 0])),
    turnsTaken: Object.fromEntries(state.teams.map((team) => [team.id, []])),
    usedWordIds: keepUsed ? state.usedWordIds : [],
    turn: null,
    timer: idleTimer(state.settings.timerSeconds * 1000),
    log: [],
    tiebreak: null,
    winnerId: null,
    finalOrder: [],
    paused: false,
    startedAt: Date.now(),
    endedAt: null,
    lastEvent: null,
    lastDistraction: null,
  }
  const first = makeTurn(base, words, 1)
  return { ...base, turn: first.turn, lastDistraction: first.lastDistraction }
}

// ---------------------------------------------------------------------------
// Resolution helpers
// ---------------------------------------------------------------------------

function resolveTurn(state: GameState, words: Word[], outcome: Outcome): GameState {
  const turn = state.turn as Turn
  const team = teamById(state, turn.teamId)
  const word = wordById(words, turn.wordId)
  const base = Math.max(0, state.settings.pointsPerWord)
  let points = 0
  if (outcome === 'correct') points = turn.doubled ? base * 2 : base
  if (outcome === 'incorrect') points = turn.doubled ? -base : 0

  const entry = logEntry({
    kind: outcome === 'skipped' ? 'skip' : 'turn',
    teamId: turn.teamId,
    playerName: contestantName(team, turn.playerIndex),
    ...(word ? { wordId: word.id, word: word.word } : {}),
    outcome,
    points,
    doubled: turn.doubled,
    ...(turn.distraction ? { distraction: turn.distraction } : {}),
  })

  return {
    ...state,
    scores: addScore(state, turn.teamId, points),
    usedWordIds: outcome === 'skipped' ? state.usedWordIds : markUsed(state, turn.wordId),
    log: [...state.log, entry],
    timer: { ...state.timer, running: false, endsAt: null, remainingMs: state.timer.running ? Math.max(0, (state.timer.endsAt ?? 0) - Date.now()) : state.timer.remainingMs },
    turn: { ...turn, outcome, pointsAwarded: points, stage: 'resolved' },
    lastEvent: outcome === 'correct' ? event('correct', turn.teamId) : outcome === 'incorrect' ? event('incorrect', turn.teamId) : state.lastEvent,
  }
}

function advance(state: GameState, words: Word[]): GameState {
  const turn = state.turn as Turn
  const team = teamById(state, turn.teamId) as Team
  const taken = state.turnsTaken[team.id] ?? []
  const rotation = { ...state.rotation }
  if (team.players.length) rotation[team.id] = (turn.playerIndex + 1) % team.players.length
  const next: GameState = {
    ...state,
    rotation,
    turnsTaken: { ...state.turnsTaken, [team.id]: turn.playerIndex >= 0 ? [...taken, turn.playerIndex] : taken },
    timer: idleTimer(state.settings.timerSeconds * 1000),
  }
  if (turn.number < totalTurns(state)) {
    const made = makeTurn(next, words, turn.number + 1)
    return { ...next, turn: made.turn, lastDistraction: made.lastDistraction, lastEvent: null }
  }
  return finish(next, words)
}

function tiebreakRound(state: GameState, words: Word[], teamIds: string[], wordNumber: number, exclude: string[] = []): TiebreakState {
  const drawn = draw(words, state.usedWordIds, exclude)
  return { teamIds, wordId: drawn.wordId, wordNote: drawn.note, revealed: false, marks: {}, picking: false, wordNumber }
}

function finish(state: GameState, words: Word[]): GameState {
  const rows = standings({ ...state, finalOrder: [] })
  const top = rows[0]
  const tied = top ? rows.filter((row) => row.score === top.score) : []
  const cleared: GameState = {
    ...state,
    turn: null,
    timer: { ...state.timer, running: false, endsAt: null },
  }
  if (tied.length > 1 && state.teams.length > 1) {
    return {
      ...cleared,
      phase: 'tiebreaker',
      tiebreak: tiebreakRound(cleared, words, tied.map((row) => row.team.id), 1),
      lastEvent: event('tiebreak'),
    }
  }
  return crown(cleared, top?.team.id ?? null, null)
}

function crown(state: GameState, winnerId: string | null, tiebreakOrder: string[] | null): GameState {
  const rows = standings({ ...state, finalOrder: [] })
  let order = rows.map((row) => row.team.id)
  if (winnerId) {
    order = [winnerId, ...order.filter((id) => id !== winnerId)]
    if (tiebreakOrder) {
      // Teams knocked out of the tiebreaker later rank above those knocked out earlier.
      const stage = new Map(tiebreakOrder.map((id, index) => [id, index]))
      const topScore = state.scores[winnerId] ?? 0
      const tiedIds = rows.filter((row) => row.score === topScore).map((row) => row.team.id)
      const tiedSorted = [...tiedIds].sort((a, b) => (stage.get(a) ?? 999) - (stage.get(b) ?? 999))
      order = [winnerId, ...tiedSorted.filter((id) => id !== winnerId), ...order.filter((id) => !tiedIds.includes(id))]
    }
  }
  return {
    ...state,
    phase: 'results',
    winnerId,
    finalOrder: order,
    endedAt: Date.now(),
    tiebreak: null,
    lastEvent: winnerId ? event('winner', winnerId) : state.lastEvent,
  }
}

// ---------------------------------------------------------------------------
// The reducer
// ---------------------------------------------------------------------------

export function reduce(state: GameState, action: Action, words: Word[]): GameState {
  switch (action.type) {
    case 'settings': {
      const settings = { ...state.settings, ...action.patch }
      if (!settings.eventName.trim()) settings.eventName = DEFAULT_EVENT_NAME
      if (!settings.trophyTitle.trim()) settings.trophyTitle = DEFAULT_TROPHY_TITLE
      const timer =
        state.phase === 'setup' ? idleTimer(settings.timerSeconds * 1000) : state.timer
      return { ...state, settings, timer }
    }
    case 'teams':
      return { ...state, teams: action.teams }
    case 'start': {
      if (state.teams.length === 0 || totalTurns(state) === 0) return state
      return beginGame(state, words, true)
    }

    case 'reveal': {
      const turn = state.turn
      if (!turn || turn.stage !== 'ready' || !turn.wordId) return state
      return {
        ...state,
        turn: { ...turn, stage: 'revealed' },
        usedWordIds: markUsed(state, turn.wordId),
        timer: idleTimer(state.settings.timerSeconds * 1000),
        lastEvent: event('reveal', turn.teamId),
      }
    }

    case 'toggle-definition':
      return state.turn ? { ...state, turn: { ...state.turn, showDefinition: !state.turn.showDefinition } } : state
    case 'toggle-sentence':
      return state.turn ? { ...state, turn: { ...state.turn, showSentence: !state.turn.showSentence } } : state

    case 'timer-start': {
      if (state.timer.running) return state
      const remaining = state.timer.remainingMs > 0 ? state.timer.remainingMs : state.timer.durationMs
      return { ...state, timer: { ...state.timer, running: true, endsAt: Date.now() + remaining, remainingMs: remaining, expired: false } }
    }
    case 'timer-pause': {
      if (!state.timer.running) return state
      const remaining = Math.max(0, (state.timer.endsAt ?? Date.now()) - Date.now())
      return { ...state, timer: { ...state.timer, running: false, endsAt: null, remainingMs: remaining } }
    }
    case 'timer-reset':
      return { ...state, timer: { ...state.timer, running: false, endsAt: null, remainingMs: state.timer.durationMs, expired: false } }
    case 'timer-expired': {
      if (!state.timer.running) return state
      return {
        ...state,
        timer: { ...state.timer, running: false, endsAt: null, remainingMs: 0, expired: true },
        lastEvent: event('time-up'),
      }
    }

    case 'mark': {
      const turn = state.turn
      if (!turn || turn.stage !== 'revealed') return state
      return resolveTurn(state, words, action.result)
    }

    case 'skip': {
      const turn = state.turn
      if (!turn || (turn.stage !== 'ready' && turn.stage !== 'revealed')) return state
      const resolved = resolveTurn(state, words, 'skipped')
      // A skipped word that was already read aloud stays used; one that was
      // never revealed goes back to the bank.
      return { ...resolved, usedWordIds: turn.stage === 'ready' ? state.usedWordIds : markUsed(state, turn.wordId) }
    }

    case 'replace': {
      const turn = state.turn
      if (!turn || (turn.stage !== 'ready' && turn.stage !== 'revealed')) return state
      const exclude = turn.wordId ? [turn.wordId] : []
      const drawn = draw(words, state.usedWordIds, exclude)
      if (!drawn.wordId) return { ...state, turn: { ...turn, wordNote: drawn.note } }
      const wasRevealed = turn.stage === 'revealed'
      return {
        ...state,
        usedWordIds: wasRevealed ? [...markUsed(state, turn.wordId), drawn.wordId] : state.usedWordIds,
        turn: { ...turn, wordId: drawn.wordId, wordNote: drawn.note, showDefinition: false, showSentence: false },
        timer: idleTimer(state.settings.timerSeconds * 1000),
      }
    }

    case 'activate-token': {
      const turn = state.turn
      if (!turn || turn.stage !== 'ready' || turn.doubled) return state
      if (!state.settings.doubleWordEnabled || !state.tokens[turn.teamId]) return state
      const team = teamById(state, turn.teamId)
      return {
        ...state,
        tokens: { ...state.tokens, [turn.teamId]: false },
        turn: { ...turn, doubled: true },
        log: [
          ...state.log,
          logEntry({
            kind: 'token',
            teamId: turn.teamId,
            playerName: contestantName(team, turn.playerIndex),
            points: 0,
            text: 'Double Word token activated',
          }),
        ],
        lastEvent: event('token', turn.teamId),
      }
    }

    case 'set-contestant': {
      const turn = state.turn
      if (!turn || turn.stage !== 'ready') return state
      const team = teamById(state, turn.teamId)
      if (!team || action.playerIndex < 0 || action.playerIndex >= team.players.length) return state
      return { ...state, turn: { ...turn, playerIndex: action.playerIndex } }
    }

    case 'next': {
      const turn = state.turn
      if (!turn || turn.stage !== 'resolved') return state
      return advance(state, words)
    }

    case 'adjust': {
      if (!teamById(state, action.teamId) || !Number.isFinite(action.delta) || action.delta === 0) return state
      return {
        ...state,
        scores: addScore(state, action.teamId, action.delta),
        log: [
          ...state.log,
          logEntry({
            kind: 'adjust',
            teamId: action.teamId,
            points: action.delta,
            text: action.reason.trim() || 'Manual adjustment',
          }),
        ],
      }
    }

    case 'pause':
      if (action.paused && state.timer.running) {
        const remaining = Math.max(0, (state.timer.endsAt ?? Date.now()) - Date.now())
        return { ...state, paused: true, timer: { ...state.timer, running: false, endsAt: null, remainingMs: remaining } }
      }
      return { ...state, paused: action.paused }

    case 'end':
      if (state.phase !== 'playing') return state
      return finish(state, words)

    case 'tiebreak-reveal': {
      const tb = state.tiebreak
      if (!tb || !tb.wordId) return state
      return {
        ...state,
        tiebreak: { ...tb, revealed: true },
        usedWordIds: markUsed(state, tb.wordId),
      }
    }
    case 'tiebreak-mark': {
      const tb = state.tiebreak
      if (!tb || !tb.teamIds.includes(action.teamId)) return state
      return { ...state, tiebreak: { ...tb, marks: { ...tb.marks, [action.teamId]: action.correct } } }
    }
    case 'tiebreak-resolve': {
      const tb = state.tiebreak
      if (!tb) return state
      const word = wordById(words, tb.wordId)
      const entries = tb.teamIds.map((teamId) =>
        logEntry({
          kind: 'tiebreak',
          teamId,
          ...(word ? { wordId: word.id, word: word.word } : {}),
          outcome: tb.marks[teamId] ? 'correct' : 'incorrect',
          points: 0,
          text: `Tiebreaker word ${tb.wordNumber}`,
        }),
      )
      const logged: GameState = { ...state, log: [...state.log, ...entries] }
      const correct = tb.teamIds.filter((id) => tb.marks[id])
      if (correct.length === 1) {
        const order = tb.teamIds.filter((id) => id !== correct[0])
        return crown(logged, correct[0] as string, [...order, correct[0] as string].reverse())
      }
      if (correct.length === 0) {
        return { ...logged, tiebreak: { ...tb, picking: true } }
      }
      return {
        ...logged,
        tiebreak: tiebreakRound(logged, words, correct, tb.wordNumber + 1),
        lastEvent: event('tiebreak'),
      }
    }
    case 'tiebreak-pick': {
      const tb = state.tiebreak
      if (!tb || !tb.teamIds.includes(action.teamId)) return state
      return crown(state, action.teamId, [...tb.teamIds.filter((id) => id !== action.teamId), action.teamId].reverse())
    }

    case 'restore-word':
      return { ...state, usedWordIds: state.usedWordIds.filter((id) => id !== action.wordId) }
    case 'restore-all-words':
      return { ...state, usedWordIds: [] }
    case 'mark-words-used':
      return { ...state, usedWordIds: [...new Set([...state.usedWordIds, ...action.wordIds])] }

    case 'rematch':
      return beginGame(state, words, true)

    case 'new-game': {
      const fresh = { ...state, phase: 'setup' as const }
      return {
        ...fresh,
        scores: {},
        tokens: {},
        rotation: {},
        turnsTaken: {},
        usedWordIds: [],
        turn: null,
        timer: idleTimer(state.settings.timerSeconds * 1000),
        log: [],
        tiebreak: null,
        winnerId: null,
        finalOrder: [],
        paused: false,
        startedAt: null,
        endedAt: null,
        lastEvent: null,
        lastDistraction: null,
      }
    }

    case 'to-setup':
      return {
        ...state,
        phase: 'setup',
        turn: null,
        tiebreak: null,
        paused: false,
        timer: idleTimer(state.settings.timerSeconds * 1000),
        lastEvent: null,
      }

    case 'clear-event':
      return state.lastEvent ? { ...state, lastEvent: null } : state

    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export interface TeamStats {
  team: Team
  score: number
  rank: number
  correct: number
  incorrect: number
  accuracy: number | null
  tokenLeft: boolean
}

export interface GameStats {
  teams: TeamStats[]
  totalCorrect: number
  totalIncorrect: number
  mostMissed: { word: string; misses: number } | null
  longestWord: { word: string; team: Team } | null
  tokensLeft: Team[]
  durationMs: number | null
}

export function gameStats(state: GameState): GameStats {
  const rows = standings(state)
  const teams: TeamStats[] = rows.map((row) => {
    const entries = state.log.filter((entry) => entry.teamId === row.team.id && entry.kind === 'turn')
    const correct = entries.filter((entry) => entry.outcome === 'correct').length
    const incorrect = entries.filter((entry) => entry.outcome === 'incorrect').length
    return {
      team: row.team,
      score: row.score,
      rank: row.rank,
      correct,
      incorrect,
      accuracy: correct + incorrect ? correct / (correct + incorrect) : null,
      tokenLeft: Boolean(state.tokens[row.team.id]),
    }
  })

  const spelled = state.log.filter((entry) => entry.kind === 'turn' && entry.outcome === 'correct' && entry.word)

  const misses = new Map<string, number>()
  for (const entry of state.log) {
    if (entry.kind === 'turn' && entry.outcome === 'incorrect' && entry.word) {
      misses.set(entry.word, (misses.get(entry.word) ?? 0) + 1)
    }
  }
  const mostMissed = [...misses.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]

  const longest = [...spelled].sort((a, b) => (b.word?.length ?? 0) - (a.word?.length ?? 0))[0]

  return {
    teams,
    totalCorrect: teams.reduce((sum, row) => sum + row.correct, 0),
    totalIncorrect: teams.reduce((sum, row) => sum + row.incorrect, 0),
    mostMissed: mostMissed ? { word: mostMissed[0], misses: mostMissed[1] } : null,
    longestWord:
      longest && longest.word && teamById(state, longest.teamId) ? { word: longest.word, team: teamById(state, longest.teamId) as Team } : null,
    tokensLeft: state.teams.filter((team) => state.tokens[team.id]),
    durationMs: state.startedAt && state.endedAt ? state.endedAt - state.startedAt : null,
  }
}
