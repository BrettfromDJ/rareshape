'use client'

/**
 * Entry for the single-file build (`pnpm bee:artifact`): one page serves both
 * views, the host by default and the audience behind #audience.
 */
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AudienceWindow } from '../_components/AudienceWindow'
import { BeeApp } from '../_components/BeeApp'

document.documentElement.dataset.beeAudienceHref = `${window.location.href.split('#')[0]}#audience`

const isAudience = () => window.location.hash.replace('#', '') === 'audience'

function Root() {
  const [audience, setAudience] = useState(isAudience)
  useEffect(() => {
    const onHash = () => setAudience(isAudience())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return <div className="bee">{audience ? <AudienceWindow /> : <BeeApp />}</div>
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
