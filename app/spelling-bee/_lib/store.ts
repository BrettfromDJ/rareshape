'use client'

/**
 * One in-memory copy of the game, mirrored to localStorage on every change and
 * announced over a BroadcastChannel so a second window (the audience screen)
 * stays in step. There is no backend: the browser is the whole stack.
 */
import { useCallback, useSyncExternalStore } from 'react'
import { CHANNEL_NAME, STORAGE_KEYS, UNDO_DEPTH, defaultGame, defaultSettings, idleTimer } from './defaults'
import { UNDOABLE, reduce, type Action } from './engine'
import type { GameState, Mode, Prefs, Word } from './types'
import { BANK_VERSION, KIDS_BANK_VERSION, defaultKidsWords, defaultWords } from './words'

type Listener = () => void

type Banks = Record<Mode, Word[]>

interface Snapshot {
  game: GameState
  /** The word bank for the game's current mode. */
  words: Word[]
  banks: Banks
  prefs: Prefs
  undoDepth: number
  storageError: string | null
  ready: boolean
}

type Message =
  | { kind: 'game'; game: GameState }
  | { kind: 'words'; banks: Banks }
  | { kind: 'prefs'; prefs: Prefs }
  | { kind: 'hello' }

const DEFAULT_PREFS: Prefs = { muted: false, audienceSound: false }

const SERVER_SNAPSHOT: Snapshot = {
  game: defaultGame(),
  words: [],
  banks: { adults: [], kids: [] },
  prefs: DEFAULT_PREFS,
  undoDepth: 0,
  storageError: null,
  ready: false,
}

let snapshot: Snapshot = SERVER_SNAPSHOT
let undoStack: GameState[] = []
let channel: BroadcastChannel | null = null
let booted = false
const listeners = new Set<Listener>()

// ---------------------------------------------------------------------------
// Validation. Stored data is untrusted: it may be from an older build, an
// edited devtools value or an imported file.
// ---------------------------------------------------------------------------

export function isWord(value: unknown): value is Word {
  if (!value || typeof value !== 'object') return false
  const word = value as Record<string, unknown>
  return (
    typeof word.id === 'string' &&
    typeof word.word === 'string' &&
    word.word.trim().length > 0 &&
    typeof word.definition === 'string' &&
    typeof word.sentence === 'string' &&
    typeof word.partOfSpeech === 'string'
  )
}

function isGame(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false
  const game = value as Record<string, unknown>
  return (
    game.version === 1 &&
    typeof game.phase === 'string' &&
    Array.isArray(game.teams) &&
    Array.isArray(game.log) &&
    typeof game.settings === 'object' &&
    game.settings !== null
  )
}

/** Fills in any field a newer build added, so an older save still loads. */
function normalizeGame(game: GameState): GameState {
  const base = defaultGame()
  const settings = { ...defaultSettings(), ...game.settings }
  const legacy = game as GameState & { rounds?: unknown; interlude?: unknown }
  // A game saved by a build that still had rounds cannot continue; it goes
  // back to setup with its teams, settings and word bank intact.
  const fromRounds = legacy.rounds !== undefined || legacy.interlude !== undefined
  delete legacy.rounds
  delete legacy.interlude
  const phase = fromRounds && game.phase !== 'setup' ? 'setup' : game.phase
  return {
    ...base,
    ...game,
    phase,
    settings,
    scores: game.scores ?? {},
    tokens: game.tokens ?? {},
    rotation: game.rotation ?? {},
    turnsTaken: game.turnsTaken ?? {},
    usedWordIds: Array.isArray(game.usedWordIds) ? game.usedWordIds : [],
    finalOrder: Array.isArray(game.finalOrder) ? game.finalOrder : [],
    savedTeams: { adults: game.savedTeams?.adults ?? [], kids: game.savedTeams?.kids ?? [] },
    timer: game.timer ?? idleTimer(settings.timerSeconds * 1000),
    // Saves from before steals were removed can sit in a steal stage.
    turn: fromRounds ? null : game.turn && String(game.turn.stage).startsWith('steal') ? { ...game.turn, stage: 'resolved' } : game.turn,
    tiebreak: fromRounds ? null : game.tiebreak,
  }
}

function read<T>(key: string, guard: (value: unknown) => value is T): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return guard(parsed) ? parsed : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown): string | null {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return null
  } catch (cause) {
    return cause instanceof Error ? cause.message : 'Could not save to this browser'
  }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function emit(): void {
  for (const listener of listeners) listener()
}

function set(patch: Partial<Snapshot>): void {
  const next = { ...snapshot, ...patch }
  next.words = next.banks[next.game.settings.mode] ?? []
  snapshot = next
  emit()
}

const isBank = (value: unknown): value is Word[] => Array.isArray(value) && value.every(isWord)
const isBanks = (value: unknown): value is Banks =>
  typeof value === 'object' && value !== null && isBank((value as Banks).adults) && isBank((value as Banks).kids)

const BANK_KEYS: Record<Mode, { words: string; version: string; current: number; builtIn: () => Word[] }> = {
  adults: { words: STORAGE_KEYS.words, version: STORAGE_KEYS.bankVersion, current: BANK_VERSION, builtIn: defaultWords },
  kids: { words: STORAGE_KEYS.kidsWords, version: STORAGE_KEYS.kidsBankVersion, current: KIDS_BANK_VERSION, builtIn: defaultKidsWords },
}

function readBanks(): Banks {
  return {
    adults: migrateBank('adults', read(STORAGE_KEYS.words, isBank)),
    kids: migrateBank('kids', read(STORAGE_KEYS.kidsWords, isBank)),
  }
}

/**
 * The built-in list changes between builds. A saved bank from an older list
 * is swapped for the current one, keeping words the host added themselves.
 */
function migrateBank(mode: Mode, stored: Word[] | null): Word[] {
  const keys = BANK_KEYS[mode]
  let version = 0
  try {
    version = Number(window.localStorage.getItem(keys.version) ?? 0)
  } catch {
    version = 0
  }
  if (stored && version === keys.current) return stored
  const builtIn = keys.builtIn()
  const names = new Set(builtIn.map((word) => word.word.toLowerCase()))
  const custom = (stored ?? []).filter((word) => word.custom && !names.has(word.word.toLowerCase()))
  const merged = [...builtIn, ...custom]
  write(keys.words, merged)
  write(keys.version, keys.current)
  return merged
}

function boot(): void {
  if (booted || typeof window === 'undefined') return
  booted = true

  const game = read(STORAGE_KEYS.game, isGame)
  const prefs = read(STORAGE_KEYS.prefs, (value): value is Prefs => typeof value === 'object' && value !== null)
  const undo = read(STORAGE_KEYS.undo, (value): value is GameState[] => Array.isArray(value) && value.every(isGame))
  undoStack = undo ?? []

  const banks = readBanks()
  const initial = game ? normalizeGame(game) : defaultGame()

  snapshot = {
    game: initial,
    words: banks[initial.settings.mode],
    banks,
    prefs: { ...DEFAULT_PREFS, ...(prefs ?? {}) },
    undoDepth: undoStack.length,
    storageError: null,
    ready: true,
  }

  try {
    channel = new BroadcastChannel(CHANNEL_NAME)
    channel.onmessage = (message: MessageEvent<Message>) => {
      const data = message.data
      if (!data || typeof data !== 'object') return
      if (data.kind === 'game' && isGame(data.game)) set({ game: normalizeGame(data.game) })
      else if (data.kind === 'words' && isBanks(data.banks)) set({ banks: data.banks })
      else if (data.kind === 'prefs' && data.prefs) set({ prefs: { ...DEFAULT_PREFS, ...data.prefs } })
      else if (data.kind === 'hello') {
        channel?.postMessage({ kind: 'game', game: snapshot.game } satisfies Message)
        channel?.postMessage({ kind: 'words', banks: snapshot.banks } satisfies Message)
      }
    }
    channel.postMessage({ kind: 'hello' } satisfies Message)
  } catch {
    channel = null
  }

  // Same-origin windows also see each other's localStorage writes. This is the
  // fallback when BroadcastChannel is unavailable, and a second signal when it is.
  window.addEventListener('storage', (storageEvent) => {
    if (storageEvent.key === STORAGE_KEYS.game) {
      const next = read(STORAGE_KEYS.game, isGame)
      if (next) set({ game: normalizeGame(next) })
    } else if (storageEvent.key === STORAGE_KEYS.words || storageEvent.key === STORAGE_KEYS.kidsWords) {
      const mode: Mode = storageEvent.key === STORAGE_KEYS.words ? 'adults' : 'kids'
      const next = read(BANK_KEYS[mode].words, isBank)
      if (next) set({ banks: { ...snapshot.banks, [mode]: next } })
    } else if (storageEvent.key === STORAGE_KEYS.prefs) {
      const next = read(STORAGE_KEYS.prefs, (value): value is Prefs => typeof value === 'object' && value !== null)
      if (next) set({ prefs: { ...DEFAULT_PREFS, ...next } })
    }
  })

  queueMicrotask(emit)
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  boot()
  return () => listeners.delete(listener)
}

function getSnapshot(): Snapshot {
  return snapshot
}

function getServerSnapshot(): Snapshot {
  return SERVER_SNAPSHOT
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

function persistUndo(): void {
  write(STORAGE_KEYS.undo, undoStack)
}

function commitGame(game: GameState): void {
  const error = write(STORAGE_KEYS.game, game)
  set({ game, undoDepth: undoStack.length, storageError: error })
  channel?.postMessage({ kind: 'game', game } satisfies Message)
}

export function dispatch(action: Action): void {
  boot()
  const before = snapshot.game
  const after = reduce(before, action, snapshot.words)
  if (after === before) return
  if (UNDOABLE.has(action.type)) {
    undoStack = [...undoStack, before].slice(-UNDO_DEPTH)
    persistUndo()
  }
  commitGame(after)
}

/** Restores the state before the last undoable action. */
export function undo(): boolean {
  boot()
  const previous = undoStack[undoStack.length - 1]
  if (!previous) return false
  undoStack = undoStack.slice(0, -1)
  persistUndo()
  // The timer is wall-clock based, so a restored running timer would resume
  // mid-count. Undo always brings it back paused.
  const restored: GameState = previous.timer.running
    ? { ...previous, timer: { ...previous.timer, running: false, endsAt: null } }
    : previous
  commitGame({ ...restored, lastEvent: null })
  return true
}

export function clearUndo(): void {
  undoStack = []
  persistUndo()
  set({ undoDepth: 0 })
}

/** Replaces the word bank of the game's current mode. */
export function setWords(words: Word[]): void {
  boot()
  const mode = snapshot.game.settings.mode
  const error = write(BANK_KEYS[mode].words, words)
  const banks = { ...snapshot.banks, [mode]: words }
  set({ banks, storageError: error })
  channel?.postMessage({ kind: 'words', banks } satisfies Message)
}

export function setPrefs(patch: Partial<Prefs>): void {
  boot()
  const prefs = { ...snapshot.prefs, ...patch }
  write(STORAGE_KEYS.prefs, prefs)
  set({ prefs })
  channel?.postMessage({ kind: 'prefs', prefs } satisfies Message)
}

/** Wipes everything the app has stored in this browser. */
export function resetAll(): void {
  boot()
  for (const key of Object.values(STORAGE_KEYS)) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // Nothing to do: the key is gone or storage is unavailable.
    }
  }
  undoStack = []
  const banks = readBanks()
  const game = defaultGame()
  snapshot = { game, words: banks[game.settings.mode], banks, prefs: DEFAULT_PREFS, undoDepth: 0, storageError: null, ready: true }
  emit()
  channel?.postMessage({ kind: 'game', game } satisfies Message)
  channel?.postMessage({ kind: 'words', banks } satisfies Message)
}

export function replaceGame(game: GameState): void {
  boot()
  undoStack = []
  persistUndo()
  commitGame(normalizeGame(game))
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useBee(): Snapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function useDispatch(): (action: Action) => void {
  return useCallback((action: Action) => dispatch(action), [])
}
