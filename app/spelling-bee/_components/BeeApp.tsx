'use client'

import { useCallback, useState } from 'react'
import { useMounted } from '../_lib/hooks'
import { useBee } from '../_lib/store'
import { AudienceScreen } from './AudienceScreen'
import { HostScreen } from './HostScreen'
import { ResultsScreen } from './ResultsScreen'
import { SetupScreen } from './SetupScreen'
import { TiebreakerScreen } from './TiebreakerScreen'
import { Celebrations } from './Celebrations'
import { Toast } from './ui'

/** The host's window. Routes on the game phase and hosts the one-screen audience mode. */
export function BeeApp() {
  const mounted = useMounted()
  const { game, ready, prefs, storageError } = useBee()
  const [audienceMode, setAudienceMode] = useState(false)
  const exitAudience = useCallback(() => setAudienceMode(false), [])
  const enterAudience = useCallback(() => setAudienceMode(true), [])

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
