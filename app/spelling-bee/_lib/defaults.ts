import type { GameState, RoundConfig, Settings, Team, TeamColorId, TimerState } from './types'

export const STORAGE_KEYS = {
  game: 'rareshape.bee.v1.game',
  words: 'rareshape.bee.v1.words',
  undo: 'rareshape.bee.v1.undo',
  prefs: 'rareshape.bee.v1.prefs',
} as const

export const CHANNEL_NAME = 'rareshape.bee.v1'

export const DEFAULT_EVENT_NAME = 'The Williams Land Spelling Bee'
export const DEFAULT_TROPHY_TITLE = 'Most Literate Adult on the Land'

export const MAX_TEAMS = 8
export const MAX_ROUNDS = 8
export const UNDO_DEPTH = 40

export interface TeamColor {
  id: TeamColorId
  name: string
  /** The team's fill. */
  bg: string
  /** Text drawn on top of the fill. */
  fg: string
  /** A light tint for large backgrounds. */
  soft: string
}

export const TEAM_COLORS: TeamColor[] = [
  { id: 'cherry', name: 'Cherry', bg: '#ff3d5a', fg: '#1b0a10', soft: '#ffd6dd' },
  { id: 'marigold', name: 'Marigold', bg: '#ffc531', fg: '#1d1400', soft: '#fff0c2' },
  { id: 'lime', name: 'Lime', bg: '#9bea3c', fg: '#0f1a03', soft: '#e3ffc2' },
  { id: 'teal', name: 'Teal', bg: '#26d7c3', fg: '#03211d', soft: '#c8fff7' },
  { id: 'sky', name: 'Sky', bg: '#5cc8ff', fg: '#04192a', soft: '#d3f0ff' },
  { id: 'grape', name: 'Grape', bg: '#b57bff', fg: '#160830', soft: '#e8d7ff' },
  { id: 'flamingo', name: 'Flamingo', bg: '#ff7ac3', fg: '#28061a', soft: '#ffd9ee' },
  { id: 'tangerine', name: 'Tangerine', bg: '#ff8a3d', fg: '#231000', soft: '#ffe0cc' },
]

export function teamColor(id: TeamColorId): TeamColor {
  return TEAM_COLORS.find((color) => color.id === id) ?? (TEAM_COLORS[0] as TeamColor)
}

let counter = 0
export function uid(prefix = 'id'): string {
  counter += 1
  const random = Math.random().toString(36).slice(2, 8)
  return `${prefix}-${Date.now().toString(36)}-${random}-${counter.toString(36)}`
}

export function defaultSettings(): Settings {
  return {
    eventName: DEFAULT_EVENT_NAME,
    trophyTitle: DEFAULT_TROPHY_TITLE,
    stealsEnabled: true,
    stealMode: 'buzz',
    stealPoints: 1,
    stealWorth: 'fixed',
    stealPenalty: 1,
    stealTimerSeconds: 15,
    doubleWordEnabled: true,
    timedRounds: true,
    timerSeconds: 30,
    autoRotate: true,
  }
}

export function defaultRounds(): RoundConfig[] {
  return [
    { id: uid('round'), name: 'Round 1', points: 1, difficulty: 'easy', distraction: false, turnsPerTeam: 3 },
    { id: uid('round'), name: 'Round 2', points: 2, difficulty: 'medium', distraction: false, turnsPerTeam: 3 },
    { id: uid('round'), name: 'Round 3', points: 3, difficulty: 'hard', distraction: true, turnsPerTeam: 3 },
    { id: uid('round'), name: 'Final round', points: 5, difficulty: 'nightmare', distraction: false, turnsPerTeam: 2 },
  ]
}

export function defaultTeams(): Team[] {
  return [
    { id: uid('team'), name: 'The Porch Sitters', color: 'marigold', players: ['Brett', 'Dana'] },
    { id: uid('team'), name: 'Cooler Heads', color: 'teal', players: ['Tyler', 'Meg'] },
    { id: uid('team'), name: 'Grill Sergeants', color: 'cherry', players: ['Uncle Rick', 'Aunt Carol'] },
  ]
}

export function idleTimer(durationMs = 30_000): TimerState {
  return { running: false, endsAt: null, remainingMs: durationMs, durationMs, expired: false }
}

export function defaultGame(): GameState {
  const settings = defaultSettings()
  return {
    version: 1,
    phase: 'setup',
    settings,
    teams: defaultTeams(),
    rounds: defaultRounds(),
    scores: {},
    tokens: {},
    rotation: {},
    turnsTaken: {},
    usedWordIds: [],
    turn: null,
    interlude: null,
    timer: idleTimer(settings.timerSeconds * 1000),
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

/**
 * Where the audience view lives. The site serves it at /spelling-bee/audience;
 * a single-file build of the app sets `data-bee-audience-href` on <html> to
 * point somewhere else (the same page with a hash, for instance).
 */
export function audienceHref(): string {
  if (typeof document === 'undefined') return '/spelling-bee/audience'
  const override = document.documentElement.dataset.beeAudienceHref
  if (override) return override
  return `${window.location.pathname.replace(/\/+$/, '')}/audience`
}

export const AUDIENCE_MODE_KEY = 'rareshape.bee.v1.audienceMode'

export function nextTeamColor(taken: TeamColorId[]): TeamColorId {
  const free = TEAM_COLORS.find((color) => !taken.includes(color.id))
  return (free ?? TEAM_COLORS[taken.length % TEAM_COLORS.length] ?? TEAM_COLORS[0]!).id
}
