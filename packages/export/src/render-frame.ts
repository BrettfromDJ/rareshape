/**
 * Renders one frame of any tool to a canvas, off-screen.
 *
 * Export never captures the stage: it re-renders at the requested size with a
 * fresh seeded RNG and an explicit `t`, which is what makes two runs of the
 * same export produce identical files.
 */
import { makeRng, type Frame } from '@rareshape/core'
import { isCanvas2d, isSvg, isWebgl, type RenderModule } from '@rareshape/schema'

export interface FrameRenderer {
  /** Draws `t` into the canvas and resolves once the pixels are there. */
  draw(t: number): Promise<void>
  canvas: HTMLCanvasElement
  dispose(): void
}

export interface FrameRendererOptions<P> {
  module: RenderModule<P>
  params: P
  width: number
  height: number
  scale: number
  seed: number
  background?: string | null
}

export function svgMarkup(
  body: string,
  defs: string | undefined,
  width: number,
  height: number,
  background?: string | null,
): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">` +
    (background ? `<rect width="${width}" height="${height}" fill="${background}"/>` : '') +
    (defs ? `<defs>${defs}</defs>` : '') +
    body +
    `</svg>`
  )
}

/** SVG -> raster, through an <img>. Deterministic and alpha-preserving. */
async function drawSvgToCanvas(
  markup: string,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): Promise<void> {
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
  const image = new Image()
  image.decoding = 'sync'
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Could not rasterise SVG'))
    image.src = url
  })
  // decode() settles after the raster is actually ready; without it Safari can
  // draw a blank first frame.
  if (typeof image.decode === 'function') {
    try {
      await image.decode()
    } catch {
      /* already loaded */
    }
  }
  ctx.drawImage(image, 0, 0, width, height)
}

export function createFrameRenderer<P>(options: FrameRendererOptions<P>): FrameRenderer {
  const { module: renderModule, params, width, height, scale, seed, background } = options
  const pixelWidth = Math.max(1, Math.round(width * scale))
  const pixelHeight = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = pixelWidth
  canvas.height = pixelHeight

  const frameFor = (t: number): Frame<P> => ({
    params,
    t,
    width,
    height,
    dpr: scale,
    seed,
    rng: makeRng(seed),
  })

  if (isWebgl(renderModule)) {
    // WebGL exports get their own renderer: the on-screen context is not set up
    // for readback, and `preserveDrawingBuffer` costs too much to leave on.
    const glCanvas = document.createElement('canvas')
    glCanvas.width = pixelWidth
    glCanvas.height = pixelHeight
    const renderer = renderModule.create(glCanvas)
    renderer.resize(width, height, scale)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    return {
      canvas,
      async draw(t) {
        if (!ctx) throw new Error('No 2D context for WebGL export')
        renderer.draw(frameFor(t))
        ctx.clearRect(0, 0, pixelWidth, pixelHeight)
        if (background) {
          ctx.fillStyle = background
          ctx.fillRect(0, 0, pixelWidth, pixelHeight)
        }
        ctx.drawImage(glCanvas, 0, 0)
      },
      dispose() {
        renderer.dispose()
      },
    }
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('No 2D context available')

  if (isSvg(renderModule)) {
    return {
      canvas,
      async draw(t) {
        const out = renderModule.render(frameFor(t))
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, pixelWidth, pixelHeight)
        if (background) {
          ctx.fillStyle = background
          ctx.fillRect(0, 0, pixelWidth, pixelHeight)
        }
        await drawSvgToCanvas(
          svgMarkup(out.body, out.defs, width, height, background === null ? null : out.background),
          ctx,
          pixelWidth,
          pixelHeight,
        )
      },
      dispose() {},
    }
  }

  if (isCanvas2d(renderModule)) {
    return {
      canvas,
      async draw(t) {
        ctx.setTransform(scale, 0, 0, scale, 0, 0)
        ctx.clearRect(0, 0, width, height)
        if (background) {
          ctx.fillStyle = background
          ctx.fillRect(0, 0, width, height)
        }
        renderModule.render(ctx, frameFor(t))
      },
      dispose() {},
    }
  }

  throw new Error('Unrecognised render module')
}
