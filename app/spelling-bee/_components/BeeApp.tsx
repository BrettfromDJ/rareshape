'use client'

import { useCallback, useState } from 'react'
import { AUDIENCE_MODE_KEY } from '../_lib/defaults'
import { useMounted } from '../_lib/hooks'
import { useBee } from '../_lib/store'
import { AudienceScreen } from './AudienceScreen'
import { HostScreen } from './HostScreen'
import { ResultsScreen } from './ResultsScreen'
import { SetupScreen } from './SetupScreen'
import { TiebreakerScreen } from './TiebreakerScreen'
import { Celebrations } from './Celebrations'
import { Toast } from './ui'

function readAudienceMode(): boolean {
  try {
    return typeof window !== 'undefined' && window.sessionStorage.getItem(AUDIENCE_MODE_KEY) === '1'
  } catch {
    return false
  }
}

function writeAudienceMode(on: boolean): void {
  try {
    if (on) window.sessionStorage.setItem(AUDIENCE_MODE_KEY, '1')
    else window.sessionStorage.removeItem(AUDIENCE_MODE_KEY)
  } catch {
    // Session storage is a convenience; the mode still works without it.
  }
}

/**
 * The host's window. Routes on the game phase and hosts the one-screen
 * audience mode, which is remembered per tab so a tab left on the TV survives
 * a refresh in audience mode.
 */
export function BeeApp() {
  const mounted = useMounted()
  const { game, ready, prefs, storageError } = useBee()
  const [audienceMode, setAudienceMode] = useState(readAudienceMode)
  const exitAudience = useCallback(() => {
    writeAudienceMode(false)
    setAudienceMode(false)
  }, [])
  const enterAudience = useCallback(() => {
    writeAudienceMode(true)
    setAudienceMode(true)
  }, [])

  if (!mounted || !ready) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <p className="bee-label">Setting the stage…</p>
      </div>
    )
  }

  if (audienceMode) {
    return (
      <>
        <AudienceScreen game={game} onExit={exitAudience} />
        <Celebrations game={game} sound={!prefs.muted} rain={game.phase === 'results'} />
      </>
    )
  }

  return (
    <>
      {game.phase === 'setup' && <SetupScreen />}
      {game.phase === 'playing' && <HostScreen onAudienceMode={enterAudience} />}
      {game.phase === 'tiebreaker' && <TiebreakerScreen onAudienceMode={enterAudience} />}
      {game.phase === 'results' && <ResultsScreen onAudienceMode={enterAudience} />}
      {game.phase !== 'setup' && <Celebrations game={game} sound={!prefs.muted} rain={game.phase === 'results'} />}
      {storageError && <Toast tone="danger" message={`This browser could not save the game: ${storageError}`} />}
    </>
  )
}
