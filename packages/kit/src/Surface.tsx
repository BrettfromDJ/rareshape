'use client'

import { useEffect, useRef } from 'react'
import { makeRng, type Frame, type GlRenderer } from '@rareshape/core'
import { isCanvas2d, isSvg, isWebgl, type RenderModule } from '@rareshape/schema'

/**
 * Paints one frame of a tool into the DOM. One component covers all three
 * engines so that nothing above it has to care which engine a tool uses.
 */
export function Surface<P>({
  module: renderModule,
  params,
  t,
  seed,
  width,
  height,
  dpr,
}: {
  module: RenderModule<P> | null
  params: P
  t: number
  seed: number
  width: number
  height: number
  dpr: number
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glRef = useRef<GlRenderer<P> | null>(null)

  const isSvgTool = renderModule !== null && isSvg(renderModule)

  useEffect(() => {
    if (!renderModule || !isWebgl(renderModule)) return
    const canvas = canvasRef.current
    if (!canvas) return
    const renderer = renderModule.create(canvas)
    glRef.current = renderer
    return () => {
      renderer.dispose()
      glRef.current = null
    }
  }, [renderModule])

  useEffect(() => {
    if (!renderModule) return
    const frame: Frame<P> = { params, t, width, height, dpr, seed, rng: makeRng(seed) }

    if (isSvg(renderModule)) {
      const host = hostRef.current
      if (!host) return
      const out = renderModule.render(frame)
      host.innerHTML =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
        `width="100%" height="100%" preserveAspectRatio="xMidYMid meet">` +
        (out.background ? `<rect width="${width}" height="${height}" fill="${out.background}"/>` : '') +
        (out.defs ? `<defs>${out.defs}</defs>` : '') +
        out.body +
        `</svg>`
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return
    const pixelWidth = Math.max(1, Math.round(width * dpr))
    const pixelHeight = Math.max(1, Math.round(height * dpr))

    if (isWebgl(renderModule)) {
      const renderer = glRef.current
      if (!renderer) return
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth
        canvas.height = pixelHeight
        renderer.resize(width, height, dpr)
      }
      renderer.draw(frame)
      return
    }

    if (isCanvas2d(renderModule)) {
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth
        canvas.height = pixelHeight
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      renderModule.render(ctx, frame)
    }
  }, [renderModule, params, t, width, height, dpr, seed])

  if (isSvgTool) {
    return <div ref={hostRef} className="absolute inset-0" aria-label="Tool output" role="img" />
  }

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ width: '100%', height: '100%' }}
      aria-label="Tool output"
      role="img"
    />
  )
}
