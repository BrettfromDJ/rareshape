'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Loop position. Drives the screen only — exports step `t` themselves rather
 * than sampling this, which is what makes them frame-accurate.
 */
export function usePlayback(duration: number, playing: boolean): {
  t: number
  setT: (t: number) => void
} {
  const [t, setT] = useState(0)
  const startedAt = useRef(0)
  const offset = useRef(0)

  useEffect(() => {
    if (!playing) return
    let frame = 0
    startedAt.current = performance.now()
    const seconds = Math.max(0.1, duration)

    const tick = (now: number) => {
      const elapsed = (now - startedAt.current) / 1000
      setT(((offset.current + elapsed / seconds) % 1 + 1) % 1)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      const elapsed = (performance.now() - startedAt.current) / 1000
      offset.current = ((offset.current + elapsed / seconds) % 1 + 1) % 1
    }
  }, [playing, duration])

  return {
    t,
    setT: (next: number) => {
      offset.current = ((next % 1) + 1) % 1
      startedAt.current = performance.now()
      setT(offset.current)
    },
  }
}

/** Honours the OS setting; used to stop autoplay on the stage and the index. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return reduced
}
