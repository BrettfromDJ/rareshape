'use client'

import { useState, type ReactNode } from 'react'
import { audienceHref } from '../_lib/defaults'
import { primeAudio } from '../_lib/sound'
import { setPrefs, undo, useBee } from '../_lib/store'
import type { GameState } from '../_lib/types'
import { Kbd, Toast } from './ui'

/** Opens the audience route in its own window. Returns false when a pop-up blocker refused. */
export function openAudienceWindow(): boolean {
  const opened = window.open(audienceHref(), 'rareshape-bee-audience')
  return Boolean(opened)
}

export const POPUP_BLOCKED =
  'The browser blocked the pop-up. Open this page in a second tab or on the TV and press Audience mode there.'

export function TopBar({
  game,
  children,
  extra,
  onAudienceMode,
  showUndo = true,
}: {
  game: GameState
  children?: ReactNode
  extra?: ReactNode
  onAudienceMode?: () => void
  showUndo?: boolean
}) {
  const { prefs, undoDepth } = useBee()
  const [toast, setToast] = useState<string | null>(null)

  const say = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 3200)
  }

  return (
    <header className="flex flex-wrap items-center gap-2 md:gap-3">
      <h1 className="bee-display text-2xl md:text-3xl text-[var(--bee-gold)] truncate max-w-[40vw]">{game.settings.eventName}</h1>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {extra}
        {showUndo && (
          <button
            type="button"
            className="bee-btn bee-btn-sm bee-btn-ghost"
            disabled={undoDepth === 0}
            onClick={() => {
              if (undo()) say('Undid the last action')
            }}
            title="Undo the last scoring or turn action"
          >
            ↶ Undo <Kbd>Z</Kbd>
          </button>
        )}
        <button
          type="button"
          className="bee-btn bee-btn-sm bee-btn-ghost"
          aria-pressed={prefs.muted}
          onClick={() => {
            primeAudio()
            setPrefs({ muted: !prefs.muted })
          }}
          title={prefs.muted ? 'Sound is off' : 'Sound is on'}
        >
          {prefs.muted ? '🔇 Muted' : '🔊 Sound'} <Kbd>M</Kbd>
        </button>
        <button
          type="button"
          className="bee-btn bee-btn-sm bee-btn-teal"
          onClick={() => {
            if (!openAudienceWindow()) say(POPUP_BLOCKED)
          }}
          title="Open the audience view in a second window to drag onto the TV"
        >
          ⧉ Audience window
        </button>
        {onAudienceMode && (
          <button type="button" className="bee-btn bee-btn-sm bee-btn-teal" onClick={onAudienceMode} title="Switch this screen to the audience-safe display">
            📺 Audience mode <Kbd>A</Kbd>
          </button>
        )}
      </div>
      {toast && <Toast message={toast} />}
    </header>
  )
}
