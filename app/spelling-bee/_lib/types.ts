/**
 * Every type the spelling bee shares between the store, the reducer and the
 * screens. The game is a plain JSON document so that it can live in
 * localStorage and be mirrored to a second window unchanged.
 */

export type Difficulty = 'easy' | 'medium' | 'hard' | 'nightmare'
export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'nightmare']

export type RoundDifficulty = Difficulty | 'mixed'

export interface Word {
  id: string
  word: string
  difficulty: Difficulty
  definition: string
  partOfSpeech: string
  sentence: string
  pronunciation?: string
  /** Added by the host rather than shipped with the app. */
  custom?: boolean
}

export type TeamColorId =
  | 'cherry'
  | 'marigold'
  | 'lime'
  | 'teal'
  | 'sky'
  | 'grape'
  | 'flamingo'
  | 'tangerine'

export interface Team {
  id: string
  name: string
  color: TeamColorId
  players: string[]
}

export interface RoundConfig {
  id: string
  name: string
  points: number
  difficulty: RoundDifficulty
  /** A distraction is assigned before every word in this round. */
  distraction: boolean
  turnsPerTeam: number
}

export interface Settings {
  eventName: string
  trophyTitle: string
  doubleWordEnabled: boolean
  timedRounds: boolean
  timerSeconds: number
  autoRotate: boolean
  /** Show the word on the audience screen once revealed. For contestants who face away from the TV. */
  audienceShowsWord: boolean
}

export type Phase = 'setup' | 'playing' | 'tiebreaker' | 'results'

export type TurnStage = 'ready' | 'revealed' | 'resolved'

export type Outcome = 'correct' | 'incorrect' | 'skipped'

export interface TimerState {
  running: boolean
  /** Epoch ms the timer hits zero, while running. */
  endsAt: number | null
  /** Milliseconds left, while paused. */
  remainingMs: number
  durationMs: number
  /** Set once the host window has observed the timer hit zero. */
  expired: boolean
}

export interface Turn {
  number: number
  roundIndex: number
  indexInRound: number
  teamId: string
  playerIndex: number
  wordId: string | null
  /** Why no word could be drawn, when wordId is null. */
  wordNote: string | null
  stage: TurnStage
  doubled: boolean
  distraction: string | null
  showDefinition: boolean
  showSentence: boolean
  outcome: Outcome | null
  pointsAwarded: number
}

export type LogKind = 'turn' | 'adjust' | 'skip' | 'tiebreak' | 'token'

export interface LogEntry {
  id: string
  at: number
  kind: LogKind
  roundIndex: number
  teamId: string
  playerName?: string
  wordId?: string
  word?: string
  difficulty?: Difficulty
  outcome?: Outcome
  points: number
  doubled?: boolean
  distraction?: string
  text?: string
}

export interface Interlude {
  kind: 'round-complete'
  roundIndex: number
}

export interface TiebreakState {
  teamIds: string[]
  wordId: string | null
  wordNote: string | null
  revealed: boolean
  marks: Record<string, boolean>
  /** Everyone missed: the host picks the closest attempt. */
  picking: boolean
  wordNumber: number
}

export type EventType =
  | 'reveal'
  | 'correct'
  | 'incorrect'
  | 'token'
  | 'round-complete'
  | 'winner'
  | 'time-up'
  | 'tiebreak'

export interface GameEvent {
  id: string
  type: EventType
  teamId?: string
  at: number
}

export interface GameState {
  version: 1
  phase: Phase
  settings: Settings
  teams: Team[]
  rounds: RoundConfig[]
  scores: Record<string, number>
  /** Double Word token still available, per team. */
  tokens: Record<string, boolean>
  /** Next player index per team. */
  rotation: Record<string, number>
  /** Player indices that have taken a turn, per team. */
  turnsTaken: Record<string, number[]>
  usedWordIds: string[]
  turn: Turn | null
  interlude: Interlude | null
  timer: TimerState
  log: LogEntry[]
  tiebreak: TiebreakState | null
  winnerId: string | null
  /** Order teams finished in, once the game is over. */
  finalOrder: string[]
  paused: boolean
  startedAt: number | null
  endedAt: number | null
  lastEvent: GameEvent | null
  lastDistraction: string | null
}

export interface Prefs {
  muted: boolean
  audienceSound: boolean
}
