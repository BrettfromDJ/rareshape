'use client'

import { useMemo, useRef, useState } from 'react'
import { saveTextFile } from '../_lib/download'
import { difficultyLabel } from '../_lib/engine'
import { isWord, setWords, useBee, useDispatch } from '../_lib/store'
import type { Difficulty, Word } from '../_lib/types'
import { DIFFICULTIES } from '../_lib/types'
import { defaultWords, wordId } from '../_lib/words'
import { Confirm, Dialog, Pill, Toast } from './ui'

type Status = 'all' | 'unused' | 'used'

const EMPTY: Omit<Word, 'id'> = { word: '', difficulty: 'medium', definition: '', partOfSpeech: 'noun', sentence: '', pronunciation: '' }

/** Search, filter, add, edit, delete, restore, import and export the word bank. */
export function WordBank({ onClose }: { onClose: () => void }) {
  const { words, game } = useBee()
  const dispatch = useDispatch()
  const [query, setQuery] = useState('')
  const [difficulty, setDifficulty] = useState<'all' | Difficulty>('all')
  const [status, setStatus] = useState<Status>('all')
  const [editing, setEditing] = useState<Word | 'new' | null>(null)
  const [confirm, setConfirm] = useState<'reset' | { deleteId: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const used = useMemo(() => new Set(game.usedWordIds), [game.usedWordIds])

  const say = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 3500)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return words
      .filter((word) => difficulty === 'all' || word.difficulty === difficulty)
      .filter((word) => status === 'all' || (status === 'used') === used.has(word.id))
      .filter((word) => !q || word.word.toLowerCase().includes(q) || word.definition.toLowerCase().includes(q))
      .sort((a, b) => DIFFICULTIES.indexOf(a.difficulty) - DIFFICULTIES.indexOf(b.difficulty) || a.word.localeCompare(b.word))
  }, [words, query, difficulty, status, used])

  const save = (word: Word) => {
    const exists = words.some((item) => item.id === word.id)
    setWords(exists ? words.map((item) => (item.id === word.id ? word : item)) : [...words, word])
    setEditing(null)
    say(exists ? `Saved “${word.word}”` : `Added “${word.word}”`)
  }

  const remove = (id: string) => {
    const target = words.find((item) => item.id === id)
    setWords(words.filter((item) => item.id !== id))
    if (used.has(id)) dispatch({ type: 'restore-word', wordId: id })
    say(target ? `Deleted “${target.word}”` : 'Deleted')
  }

  const exportJson = async () => {
    const payload = {
      app: 'rareshape-spelling-bee',
      exportedAt: new Date().toISOString(),
      words: words.map((word) => ({ ...word, used: used.has(word.id) })),
    }
    const outcome = await saveTextFile('spelling-bee-words.json', JSON.stringify(payload, null, 2))
    if (outcome === 'saved') say(`Exported ${words.length} words`)
    else if (outcome === 'declined') say('Export cancelled')
    else say('Saving files is not available in this view')
  }

  const importJson = async (file: File) => {
    try {
      const parsed: unknown = JSON.parse(await file.text())
      const list: unknown = Array.isArray(parsed) ? parsed : (parsed as { words?: unknown })?.words
      if (!Array.isArray(list)) throw new Error('Expected a JSON array of words, or an object with a "words" array.')
      const incoming: Word[] = []
      const usedIds: string[] = []
      let skipped = 0
      for (const raw of list) {
        if (!raw || typeof raw !== 'object') {
          skipped += 1
          continue
        }
        const item = raw as Record<string, unknown>
        const candidate = {
          id: typeof item.id === 'string' && item.id ? item.id : wordId(String(item.word ?? '')),
          word: String(item.word ?? '').trim(),
          difficulty: item.difficulty,
          definition: String(item.definition ?? ''),
          partOfSpeech: String(item.partOfSpeech ?? ''),
          sentence: String(item.sentence ?? ''),
          ...(typeof item.pronunciation === 'string' && item.pronunciation ? { pronunciation: item.pronunciation } : {}),
          custom: true,
        }
        if (!isWord(candidate)) {
          skipped += 1
          continue
        }
        incoming.push(candidate)
        if (item.used === true) usedIds.push(candidate.id)
      }
      if (incoming.length === 0) throw new Error('No valid words found. Each needs word, difficulty, definition, partOfSpeech and sentence.')
      const byId = new Map(words.map((word) => [word.id, word]))
      for (const word of incoming) byId.set(word.id, { ...(byId.get(word.id) ?? {}), ...word })
      setWords([...byId.values()])
      if (usedIds.length) dispatch({ type: 'mark-words-used', wordIds: usedIds })
      say(`Imported ${incoming.length} words${skipped ? `, skipped ${skipped} invalid` : ''}`)
    } catch (cause) {
      say(`Import failed: ${cause instanceof Error ? cause.message : 'unreadable file'}`)
    }
  }

  return (
    <Dialog title="Word bank" onClose={onClose} wide>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <label className="flex-1 min-w-[12rem]">
          <span className="sr-only">Search words</span>
          <input className="bee-input" placeholder="Search words or definitions" value={query} onChange={(changeEvent) => setQuery(changeEvent.target.value)} />
        </label>
        <label className="bee-field">
          <span className="sr-only">Difficulty</span>
          <select className="bee-select w-auto" value={difficulty} onChange={(changeEvent) => setDifficulty(changeEvent.target.value as 'all' | Difficulty)}>
            <option value="all">All levels</option>
            {DIFFICULTIES.map((level) => (
              <option key={level} value={level}>
                {difficultyLabel(level)}
              </option>
            ))}
          </select>
        </label>
        <label className="bee-field">
          <span className="sr-only">Used status</span>
          <select className="bee-select w-auto" value={status} onChange={(changeEvent) => setStatus(changeEvent.target.value as Status)}>
            <option value="all">Used and unused</option>
            <option value="unused">Unused only</option>
            <option value="used">Used only</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button type="button" className="bee-btn bee-btn-sm bee-btn-gold" onClick={() => setEditing('new')}>
          + Add word
        </button>
        <button type="button" className="bee-btn bee-btn-sm bee-btn-ghost" onClick={() => fileRef.current?.click()}>
          Import JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Import words from a JSON file"
          onChange={(changeEvent) => {
            const file = changeEvent.target.files?.[0]
            if (file) void importJson(file)
            changeEvent.target.value = ''
          }}
        />
        <button type="button" className="bee-btn bee-btn-sm bee-btn-ghost" onClick={() => void exportJson()}>
          Export JSON
        </button>
        <button
          type="button"
          className="bee-btn bee-btn-sm bee-btn-ghost"
          disabled={game.usedWordIds.length === 0}
          onClick={() => {
            dispatch({ type: 'restore-all-words' })
            say('Every word is available again')
          }}
        >
          Restore all used ({game.usedWordIds.length})
        </button>
        <button type="button" className="bee-btn bee-btn-sm bee-btn-ghost ml-auto" onClick={() => setConfirm('reset')}>
          Reset to built-in list
        </button>
      </div>

      <p className="bee-hint mb-2">
        Showing {filtered.length} of {words.length}. Used words are skipped for the rest of this game unless you restore them.
      </p>

      <ul className="flex flex-col gap-2 max-h-[50vh] overflow-auto pr-1">
        {filtered.length === 0 && <li className="bee-hint py-6 text-center">No words match.</li>}
        {filtered.map((word) => {
          const isUsed = used.has(word.id)
          return (
            <li key={word.id} className="bee-card-flat flex flex-wrap items-center gap-3 px-3 py-2">
              <span className="bee-display text-2xl min-w-[10rem]">{word.word}</span>
              <Pill tone={word.difficulty === 'nightmare' ? 'red' : word.difficulty === 'hard' ? 'gold' : word.difficulty === 'medium' ? 'teal' : 'green'}>
                {difficultyLabel(word.difficulty)}
              </Pill>
              {isUsed && <Pill>Used</Pill>}
              {word.custom && <Pill>Custom</Pill>}
              <span className="bee-hint flex-1 min-w-[10rem] truncate">{word.definition}</span>
              <span className="flex gap-2">
                {isUsed && (
                  <button type="button" className="bee-btn bee-btn-sm bee-btn-ghost" onClick={() => dispatch({ type: 'restore-word', wordId: word.id })}>
                    Restore
                  </button>
                )}
                <button type="button" className="bee-btn bee-btn-sm bee-btn-ghost" onClick={() => setEditing(word)}>
                  Edit
                </button>
                <button type="button" className="bee-btn bee-btn-sm bee-btn-ghost" onClick={() => setConfirm({ deleteId: word.id })} aria-label={`Delete ${word.word}`}>
                  ✕
                </button>
              </span>
            </li>
          )
        })}
      </ul>

      {editing && <WordForm initial={editing === 'new' ? null : editing} existing={words} onSave={save} onClose={() => setEditing(null)} />}
      {confirm === 'reset' && (
        <Confirm
          title="Reset the word bank?"
          body="Custom words and edits are removed and the built-in list comes back. Words used this game stay marked as used."
          confirmLabel="Reset word bank"
          danger
          onConfirm={() => {
            setWords(defaultWords())
            say('Word bank reset')
          }}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm && confirm !== 'reset' && (
        <Confirm
          title="Delete this word?"
          body={`“${words.find((word) => word.id === confirm.deleteId)?.word ?? ''}” is removed from the bank.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => remove(confirm.deleteId)}
          onClose={() => setConfirm(null)}
        />
      )}
      {toast && <Toast message={toast} />}
    </Dialog>
  )
}

function WordForm({ initial, existing, onSave, onClose }: { initial: Word | null; existing: Word[]; onSave: (word: Word) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<Omit<Word, 'id'>>(initial ? { ...EMPTY, ...initial } : EMPTY)
  const [error, setError] = useState<string | null>(null)
  const update = (patch: Partial<Omit<Word, 'id'>>) => setDraft((current) => ({ ...current, ...patch }))

  const submit = () => {
    const word = draft.word.trim()
    if (!word) return setError('The word itself is required.')
    if (!draft.definition.trim()) return setError('Give it a short definition so the host can read one.')
    if (!draft.sentence.trim()) return setError('Add an example sentence. Funny is encouraged.')
    let id = initial?.id ?? wordId(word)
    if (!initial && existing.some((item) => item.id === id)) id = `${id}-${Date.now().toString(36)}`
    onSave({
      id,
      word,
      difficulty: draft.difficulty,
      definition: draft.definition.trim(),
      partOfSpeech: draft.partOfSpeech.trim() || 'noun',
      sentence: draft.sentence.trim(),
      ...(draft.pronunciation?.trim() ? { pronunciation: draft.pronunciation.trim() } : {}),
      ...(initial ? (initial.custom ? { custom: true } : {}) : { custom: true }),
    })
  }

  return (
    <Dialog title={initial ? `Edit “${initial.word}”` : 'Add a word'} onClose={onClose}>
      <form
        className="grid gap-3"
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault()
          submit()
        }}
      >
        <div className="grid sm:grid-cols-[1fr_auto] gap-3">
          <label className="bee-field">
            <span className="bee-label">Word</span>
            <input className="bee-input bee-input-lg" value={draft.word} onChange={(changeEvent) => update({ word: changeEvent.target.value })} data-autofocus="true" required />
          </label>
          <label className="bee-field">
            <span className="bee-label">Difficulty</span>
            <select className="bee-select" value={draft.difficulty} onChange={(changeEvent) => update({ difficulty: changeEvent.target.value as Difficulty })}>
              {DIFFICULTIES.map((level) => (
                <option key={level} value={level}>
                  {difficultyLabel(level)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="bee-field">
            <span className="bee-label">Part of speech</span>
            <input className="bee-input" value={draft.partOfSpeech} onChange={(changeEvent) => update({ partOfSpeech: changeEvent.target.value })} placeholder="noun" />
          </label>
          <label className="bee-field">
            <span className="bee-label">Pronunciation (optional)</span>
            <input className="bee-input" value={draft.pronunciation ?? ''} onChange={(changeEvent) => update({ pronunciation: changeEvent.target.value })} placeholder="ne-SESS-uh-ree" />
          </label>
        </div>
        <label className="bee-field">
          <span className="bee-label">Definition</span>
          <input className="bee-input" value={draft.definition} onChange={(changeEvent) => update({ definition: changeEvent.target.value })} required />
        </label>
        <label className="bee-field">
          <span className="bee-label">Example sentence</span>
          <textarea className="bee-textarea" rows={2} value={draft.sentence} onChange={(changeEvent) => update({ sentence: changeEvent.target.value })} required />
        </label>
        {error && (
          <p role="alert" className="text-[var(--bee-red-soft)] font-medium">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3 mt-2">
          <button type="button" className="bee-btn bee-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="bee-btn bee-btn-gold">
            {initial ? 'Save word' : 'Add word'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
