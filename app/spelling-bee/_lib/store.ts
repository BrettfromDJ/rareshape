'use client'

/**
 * One in-memory copy of the game, mirrored to localStorage on every change and
 * announced over a BroadcastChannel so a second window (the audience screen)
 * stays in step. There is no backend: the browser is the whole stack.
 */
import { useCallback, useSyncExternalStore } from 'react'
import { CHANNEL_NAME, STORAGE_KEYS, UNDO_DEPTH, defaultGame, defaultSettings, idleTimer } from './defaults'
import { UNDOABLE, reduce, type Action } from './engine'
import type { GameState, Prefs, Word } from './types'
import { DIFFICULTIES } from './types'
import { defaultWords } from './words'

type Listener = () => void

interface Snapshot {
  game: GameState
  words: Word[]
  prefs: Prefs
  undoDepth: number
  storageError: string | null
  ready: boolean
}

type Message =
  | { kind: 'game'; game: GameState }
  | { kind: 'words'; words: Word[] }
  | { kind: 'prefs'; prefs: Prefs }
  | { kind: 'hello' }

const DEFAULT_PREFS: Prefs = { muted: false, audienceSound: false }

const SERVER_SNAPSHOT: Snapshot = {
  game: defaultGame(),
  words: [],
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
    typeof word.partOfSpeech === 'string' &&
    DIFFICULTIES.includes(word.difficulty as Word['difficulty'])
  )
}

function isGame(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false
  const game = value as Record<string, unknown>
  return (
    game.version === 1 &&
    typeof game.phase === 'string' &&
    Array.isArray(game.teams) &&
    Array.isArray(game.rounds) &&
    Array.isArray(game.log) &&
    typeof game.settings === 'object' &&
    game.settings !== null
  )
}

/** Fills in any field a newer build added, so an older save still loads. */
function normalizeGame(game: GameState): GameState {
  const base = defaultGame()
  const settings = { ...defaultSettings(), ...game.settings }
  return {
    ...base,
    ...game,
    settings,
    scores: game.scores ?? {},
    tokens: game.tokens ?? {},
    rotation: game.rotation ?? {},
    turnsTaken: game.turnsTaken ?? {},
    usedWordIds: Array.isArray(game.usedWordIds) ? game.usedWordIds : [],
    finalOrder: Array.isArray(game.finalOrder) ? game.finalOrder : [],
    timer: game.timer ?? idleTimer(settings.timerSeconds * 1000),
    // Saves from before steals were removed can sit in a steal stage.
    turn: game.turn && String(game.turn.stage).startsWith('steal') ? { ...game.turn, stage: 'resolved' } : game.turn,
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
  snapshot = { ...snapshot, ...patch }
  emit()
}

function boot(): void {
  if (booted || typeof window === 'undefined') return
  booted = true

  const game = read(STORAGE_KEYS.game, isGame)
  const words = read(STORAGE_KEYS.words, (value): value is Word[] => Array.isArray(value) && value.every(isWord))
  const prefs = read(STORAGE_KEYS.prefs, (value): value is Prefs => typeof value === 'object' && value !== null)
  const undo = read(STORAGE_KEYS.undo, (value): value is GameState[] => Array.isArray(value) && value.every(isGame))
  undoStack = undo ?? []

  const initialWords = words ?? defaultWords()
  if (!words) write(STORAGE_KEYS.words, initialWords)

  snapshot = {
    game: game ? normalizeGame(game) : defaultGame(),
    words: initialWords,
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
      else if (data.kind === 'words' && Array.isArray(data.words) && data.words.every(isWord)) set({ words: data.words })
      else if (data.kind === 'prefs' && data.prefs) set({ prefs: { ...DEFAULT_PREFS, ...data.prefs } })
      else if (data.kind === 'hello') {
        channel?.postMessage({ kind: 'game', game: snapshot.game } satisfies Message)
        channel?.postMessage({ kind: 'words', words: snapshot.words } satisfies Message)
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
    } else if (storageEvent.key === STORAGE_KEYS.words) {
      const next = read(STORAGE_KEYS.words, (value): value is Word[] => Array.isArray(value) && value.every(isWord))
      if (next) set({ words: next })
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

export function setWords(words: Word[]): void {
  boot()
  const error = write(STORAGE_KEYS.words, words)
  set({ words, storageError: error })
  channel?.postMessage({ kind: 'words', words } satisfies Message)
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
  const words = defaultWords()
  write(STORAGE_KEYS.words, words)
  snapshot = { game: defaultGame(), words, prefs: DEFAULT_PREFS, undoDepth: 0, storageError: null, ready: true }
  emit()
  channel?.postMessage({ kind: 'game', game: snapshot.game } satisfies Message)
  channel?.postMessage({ kind: 'words', words } satisfies Message)
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
