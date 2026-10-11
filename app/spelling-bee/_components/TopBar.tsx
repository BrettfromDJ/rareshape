'use client'

import { useState, type ReactNode } from 'react'
import { audienceHref } from '../_lib/defaults'
import { primeAudio } from '../_lib/sound'
import { setPrefs, undo, useBee } from '../_lib/store'
import type { GameState } from '../_lib/types'
import { Dialog, Kbd, Toast } from './ui'

export type AudienceOpen = 'opened' | 'blocked' | 'framed'

/** True when the page runs inside another page, such as a hosted artifact viewer. */
function framed(): boolean {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

/**
 * Opens the audience view in a second window. On the site that is the
 * audience route. Inside a hosted frame the frame's own address refuses to
 * open on its own, so the host page is opened instead and the person
 * switches that tab to audience mode by hand.
 */
export function openAudienceWindow(): AudienceOpen {
  if (framed()) {
    const host = document.referrer
    if (host && /^https:\/\/[^/]*claude\.ai\//.test(host)) window.open(host, '_blank')
    return 'framed'
  }
  const opened = window.open(audienceHref(), 'rareshape-bee-audience')
  return opened ? 'opened' : 'blocked'
}

export const POPUP_BLOCKED =
  'The browser blocked the pop-up. Open this page in a second tab or on the TV and press Audience mode there.'

/** The steps for a hosted page, where a second window cannot open by itself. */
export function AudienceHelp({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Put the audience on the TV" onClose={onClose}>
      <ol className="grid gap-3 text-lg list-decimal pl-6">
        <li>
          <strong>Open this same page in a second tab.</strong> A new tab may have just opened for you; if not, copy this page&rsquo;s address into one.
        </li>
        <li>
          <strong>Move that tab to the TV.</strong> Drag it to the TV&rsquo;s desktop with the laptop set as an extended display, or cast just that tab.
        </li>
        <li>
          <strong>Press Audience mode there</strong> (or the <kbd className="bee-kbd">A</kbd> key) and make it full screen. It stays in step with this screen and never shows anything the host sees first.
        </li>
      </ol>
      <p className="bee-hint mt-4">Sound is off on the audience tab to begin with. Use its Sound button if the TV should carry the bells and buzzers.</p>
      <div className="flex justify-end mt-5">
        <button type="button" className="bee-btn bee-btn-gold" onClick={onClose} data-autofocus="true">
          Got it
        </button>
      </div>
    </Dialog>
  )
}

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
  const [help, setHelp] = useState(false)

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
            const result = openAudienceWindow()
            if (result === 'blocked') say(POPUP_BLOCKED)
            if (result === 'framed') setHelp(true)
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
      {help && <AudienceHelp onClose={() => setHelp(false)} />}
    </header>
  )
}
