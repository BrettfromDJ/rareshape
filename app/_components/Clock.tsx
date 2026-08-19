'use client'

import { useEffect, useState } from 'react'

/** The only client JS on the index. Renders nothing until mounted, so the
 *  static export and the hydrated page never disagree. */
export function Clock() {
  const [time, setTime] = useState<string | null>(null)

  useEffect(() => {
    const tick = () =>
      setTime(
        new Intl.DateTimeFormat('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }).format(new Date()),
      )
    tick()
    const id = window.setInterval(tick, 10_000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <span className="meta tabular-nums" suppressHydrationWarning>
      {time ?? ' '}
    </span>
  )
}
