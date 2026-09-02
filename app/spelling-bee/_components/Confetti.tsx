'use client'

import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  w: number
  h: number
  rot: number
  vr: number
  color: string
  life: number
}

const COLORS = ['#ffc531', '#ff3d5a', '#26d7c3', '#8fe03a', '#5cc8ff', '#b57bff', '#ff7ac3', '#fff5dc']

/**
 * Canvas confetti. `burst` fires one shower each time it changes; `rain`
 * keeps a gentle fall going for the winner screen.
 */
export function Confetti({ burst, rain = false, colors }: { burst: string | number; rain?: boolean; colors?: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const particles = useRef<Particle[]>([])
  const frame = useRef<number>(0)
  const palette = colors && colors.length ? colors : COLORS

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const resize = () => {
      canvas.width = window.innerWidth * Math.min(2, window.devicePixelRatio || 1)
      canvas.height = window.innerHeight * Math.min(2, window.devicePixelRatio || 1)
    }
    resize()
    window.addEventListener('resize', resize)

    const spawn = (count: number, fromTop: boolean) => {
      const scale = Math.min(2, window.devicePixelRatio || 1)
      for (let i = 0; i < count; i += 1) {
        const x = fromTop ? Math.random() * canvas.width : canvas.width / 2 + (Math.random() - 0.5) * canvas.width * 0.5
        const y = fromTop ? -20 : canvas.height * 0.55
        particles.current.push({
          x,
          y,
          vx: fromTop ? (Math.random() - 0.5) * 2 * scale : (Math.random() - 0.5) * 22 * scale,
          vy: fromTop ? (1 + Math.random() * 2) * scale : -(10 + Math.random() * 14) * scale,
          w: (6 + Math.random() * 8) * scale,
          h: (10 + Math.random() * 10) * scale,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.3,
          color: palette[Math.floor(Math.random() * palette.length)] as string,
          life: 1,
        })
      }
    }

    let last = performance.now()
    let rainClock = 0
    let rainLeft = rain ? 12 : 0
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const scale = Math.min(2, window.devicePixelRatio || 1)
      if (rainLeft > 0 && !reduce) {
        rainLeft -= dt
        rainClock += dt
        if (rainClock > 0.16) {
          rainClock = 0
          spawn(2, true)
        }
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.current = particles.current.filter((p) => p.life > 0 && p.y < canvas.height + 40)
      for (const p of particles.current) {
        p.vy += 28 * scale * dt
        p.vx *= 0.99
        p.x += p.vx * dt * 60
        p.y += p.vy * dt * 60
        p.rot += p.vr
        p.life -= dt * 0.25
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2))
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 2)) + 1)
        ctx.restore()
      }
      if (particles.current.length || rainLeft > 0) frame.current = requestAnimationFrame(tick)
      else frame.current = 0
    }

    const start = () => {
      if (!frame.current) {
        last = performance.now()
        frame.current = requestAnimationFrame(tick)
      }
    }

    if (burst && !reduce) {
      spawn(160, false)
      start()
    }
    if (rain) start()

    return () => {
      window.removeEventListener('resize', resize)
      if (frame.current) cancelAnimationFrame(frame.current)
      frame.current = 0
    }
  }, [burst, rain, palette])

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 w-full h-full" />
}
