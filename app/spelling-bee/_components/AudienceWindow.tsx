'use client'

import { useMounted } from '../_lib/hooks'
import { primeAudio } from '../_lib/sound'
import { setPrefs, useBee } from '../_lib/store'
import { AudienceScreen } from './AudienceScreen'
import { Celebrations } from './Celebrations'

/**
 * The audience route, opened in its own window and mirrored from the host's.
 * Sound is off here by default so a laptop next to the TV does not echo.
 */
export function AudienceWindow() {
  const mounted = useMounted()
  const { game, ready, prefs } = useBee()

  if (!mounted || !ready) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <p className="bee-label">Connecting to the host…</p>
      </div>
    )
  }

  return (
    <>
      <AudienceScreen
        game={game}
        soundOn={prefs.audienceSound}
        onToggleSound={() => {
          primeAudio()
          setPrefs({ audienceSound: !prefs.audienceSound })
        }}
      />
      <Celebrations game={game} sound={prefs.audienceSound} rain={game.phase === 'results'} />
    </>
  )
}
