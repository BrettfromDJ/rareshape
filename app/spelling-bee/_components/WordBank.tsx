'use client'

import { useMemo, useRef, useState } from 'react'
import { saveTextFile } from '../_lib/download'
import { isWord, setWords, useBee, useDispatch } from '../_lib/store'
import type { Word } from '../_lib/types'
import { defaultWords, wordId } from '../_lib/words'
import { Confirm, Dialog, Pill, Toast } from './ui'

type Status = 'all' | 'unused' | 'used'

const EMPTY: Omit<Word, 'id'> = { word: '', definition: '', partOfSpeech: '', sentence: '', pronunciation: '' }

/** Splits a pasted list on new lines, commas and semicolons. */
function splitWords(text: string): string[] {
  const seen = new Set<string>()
  return text
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter((item) => {
      const key = item.toLowerCase()
      if (!item || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

/** Search, filter, add, edit, delete, restore, import and export the word bank. */
export function WordBank({ onClose }: { onClose: () => void }) {
  const { words, game } = useBee()
  const dispatch = useDispatch()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<Status>('all')
  const [editing, setEditing] = useState<Word | 'new' | null>(null)
  const [quick, setQuick] = useState('')
  const [confirm, setConfirm] = useState<'reset' | 'clear' | { deleteId: string } | null>(null)
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
      .filter((word) => status === 'all' || (status === 'used') === used.has(word.id))
      .filter((word) => !q || word.word.toLowerCase().includes(q) || word.definition.toLowerCase().includes(q))
      .sort((a, b) => a.word.localeCompare(b.word))
  }, [words, query, status, used])

  const quickAdd = () => {
    const names = splitWords(quick)
    if (names.length === 0) return
    const taken = new Set(words.map((word) => word.word.toLowerCase()))
    const ids = new Set(words.map((word) => word.id))
    const fresh: Word[] = []
    let skipped = 0
    for (const name of names) {
      if (taken.has(name.toLowerCase())) {
        skipped += 1
        continue
      }
      let id = wordId(name)
      if (ids.has(id)) id = `${id}-${Date.now().toString(36)}`
      ids.add(id)
      taken.add(name.toLowerCase())
      fresh.push({ id, word: name, definition: '', partOfSpeech: '', sentence: '', custom: true })
    }
    if (fresh.length) setWords([...words, ...fresh])
    setQuick('')
    say(
      fresh.length === 0
        ? 'Already in the bank'
        : `Added ${fresh.length === 1 ? `“${fresh[0]?.word}”` : `${fresh.length} words`}${skipped ? `, skipped ${skipped} already in the bank` : ''}`,
    )
  }

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
      if (incoming.length === 0) throw new Error('No valid words found. Each entry needs at least a "word".')
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
    <Dialog title={game.settings.mode === 'kids' ? 'Kids word bank' : 'Adult word bank'} onClose={onClose} wide>
      <form
        className="bee-card-flat p-3 mb-4 grid gap-2"
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault()
          quickAdd()
        }}
      >
        <label className="bee-field">
          <span className="bee-label">Add words</span>
          <textarea
            className="bee-textarea bee-input-lg"
            rows={Math.min(8, Math.max(2, quick.split('\n').length))}
            placeholder={'Paste your list here, one word per line\n(or type a word and press Enter)'}
            spellCheck
            lang="en"
            value={quick}
            onChange={(changeEvent) => setQuick(changeEvent.target.value)}
            onKeyDown={(keyEvent) => {
              if (keyEvent.key === 'Enter' && !keyEvent.shiftKey) {
                keyEvent.preventDefault()
                quickAdd()
              }
            }}
            data-autofocus="true"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="bee-btn bee-btn-gold" disabled={!quick.trim()}>
            + Add {splitWords(quick).length > 1 ? `${splitWords(quick).length} words` : 'word'}
          </button>
          <p className="bee-hint">Commas, semicolons or new lines all separate words. Shift+Enter adds a line by hand. Duplicates are skipped.</p>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <label className="flex-1 min-w-[12rem]">
          <span className="sr-only">Search words</span>
          <input className="bee-input" placeholder="Search words or definitions" value={query} onChange={(changeEvent) => setQuery(changeEvent.target.value)} />
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
        <button type="button" className="bee-btn bee-btn-sm bee-btn-ghost" onClick={() => setEditing('new')}>
          + Add with details
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
        <button type="button" className="bee-btn bee-btn-sm bee-btn-red" disabled={words.length === 0} onClick={() => setConfirm('clear')}>
          Delete all words
        </button>
      </div>

      <p className="bee-hint mb-2">
        Showing {filtered.length} of {words.length}. Used words are skipped for the rest of this game unless you restore them.
      </p>

      <ul className="flex flex-col gap-2 max-h-[50vh] overflow-auto pr-1">
        {filtered.length === 0 && (
          <li className="bee-hint py-6 text-center">
            {words.length === 0 ? 'The bank is empty. Type a word above, or import a JSON file.' : 'No words match.'}
          </li>
        )}
        {filtered.map((word) => {
          const isUsed = used.has(word.id)
          return (
            <li key={word.id} className="bee-card-flat flex flex-wrap items-center gap-3 px-3 py-2">
              <span className="bee-display text-2xl min-w-[10rem]">{word.word}</span>
              {isUsed && <Pill>Used</Pill>}
              {word.custom && <Pill>Custom</Pill>}
              <span className="bee-hint flex-1 min-w-[10rem] truncate">{word.definition || 'No definition'}</span>
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
      {confirm === 'clear' && (
        <Confirm
          title="Delete every word?"
          body={`All ${words.length} words go, built-in and custom alike, so you can build your own list. "Reset to built-in list" brings the original words back if you ever want them.`}
          confirmLabel="Delete all words"
          danger
          onConfirm={() => {
            setWords([])
            dispatch({ type: 'restore-all-words' })
            say('Word bank emptied')
          }}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm && confirm !== 'reset' && confirm !== 'clear' && (
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
    let id = initial?.id ?? wordId(word)
    if (!initial && existing.some((item) => item.id === id)) id = `${id}-${Date.now().toString(36)}`
    onSave({
      id,
      word,
      definition: draft.definition.trim(),
      partOfSpeech: draft.partOfSpeech.trim(),
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
        <label className="bee-field">
          <span className="bee-label">Word</span>
          <input className="bee-input bee-input-lg" value={draft.word} onChange={(changeEvent) => update({ word: changeEvent.target.value })} data-autofocus="true" spellCheck lang="en" required />
        </label>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="bee-field">
            <span className="bee-label">Part of speech (optional)</span>
            <input className="bee-input" value={draft.partOfSpeech} onChange={(changeEvent) => update({ partOfSpeech: changeEvent.target.value })} placeholder="noun" />
          </label>
          <label className="bee-field">
            <span className="bee-label">Pronunciation (optional)</span>
            <input className="bee-input" value={draft.pronunciation ?? ''} onChange={(changeEvent) => update({ pronunciation: changeEvent.target.value })} placeholder="ne-SESS-uh-ree" />
          </label>
        </div>
        <label className="bee-field">
          <span className="bee-label">Definition (optional)</span>
          <input className="bee-input" value={draft.definition} onChange={(changeEvent) => update({ definition: changeEvent.target.value })} />
        </label>
        <label className="bee-field">
          <span className="bee-label">Example sentence (optional)</span>
          <textarea className="bee-textarea" rows={2} value={draft.sentence} onChange={(changeEvent) => update({ sentence: changeEvent.target.value })} />
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
