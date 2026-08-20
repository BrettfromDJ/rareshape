import { makeRng, parseAspect, type Frame, type GlRenderer } from '@rareshape/core'
import {
  createStore,
  isCanvas2d,
  isSvg,
  isWebgl,
  type ParamSchema,
  type ParamsOf,
  type RenderModule,
  type Tool,
} from '@rareshape/schema'
import { buildControl } from './controls'
import { SHELL_CSS } from './styles'

/**
 * The vanilla shell. No framework, no build step at runtime — it reads the same
 * param schema the React kit reads and drives the same store, which is what
 * stops an ejected file and the site from drifting apart.
 */
export interface MountOptions<S extends ParamSchema> {
  tool: Tool<S>
  module: RenderModule<ParamsOf<S>>
  /** The state the file was exported with. */
  params?: Partial<ParamsOf<S>>
  root?: HTMLElement
  /** Stage shape the file was exported at. Defaults to the tool's own. */
  aspect?: string
  /** Shown in the header, linking back to where the file came from. */
  source?: string
}

export function mount<S extends ParamSchema>(options: MountOptions<S>): void {
  const { tool, module: renderModule } = options
  const root = options.root ?? document.body

  const style = document.createElement('style')
  style.textContent = SHELL_CSS
  document.head.append(style)
  document.title = `${tool.meta.name} — Rareshape`

  const store = createStore(tool)
  if (options.params) store.patch(options.params, { history: false })

  root.innerHTML = `
    <header class="rs-head">
      <span class="rs-title">${escapeHtml(tool.meta.name)}</span>
      <span class="rs-tagline">${escapeHtml(tool.meta.tagline)}</span>
      <span class="rs-meta">${escapeHtml(tool.meta.category)} — ${escapeHtml(tool.meta.engine)}</span>
      <span class="rs-meta" style="margin-left:auto">${
        options.source
          ? `<a href="${escapeHtml(options.source)}">Rareshape</a>`
          : 'Rareshape'
      }</span>
    </header>
    <div class="rs-body">
      <aside class="rs-rail" id="rs-rail"></aside>
      <main style="flex:1;min-width:0;display:flex;flex-direction:column">
        <div class="rs-stage"><div class="rs-frame" id="rs-frame"></div></div>
        <div class="rs-foot" id="rs-foot"></div>
      </main>
    </div>
  `

  const rail = root.querySelector<HTMLElement>('#rs-rail')!
  const frame = root.querySelector<HTMLElement>('#rs-frame')!
  const foot = root.querySelector<HTMLElement>('#rs-foot')!

  /* --- surface ----------------------------------------------------------- */

  const aspect = parseAspect(options.aspect || tool.meta.aspect)
  let canvas: HTMLCanvasElement | null = null
  let svgHost: HTMLDivElement | null = null
  let gl: GlRenderer<ParamsOf<S>> | null = null

  if (isSvg(renderModule)) {
    svgHost = document.createElement('div')
    frame.append(svgHost)
  } else {
    canvas = document.createElement('canvas')
    frame.append(canvas)
    if (isWebgl(renderModule)) gl = renderModule.create(canvas)
  }

  let size = { width: 800, height: 800 }
  const fit = () => {
    const stage = frame.parentElement as HTMLElement
    const available = {
      width: Math.max(120, stage.clientWidth - 48),
      height: Math.max(120, stage.clientHeight - 48),
    }
    const width =
      available.width / available.height > aspect ? available.height * aspect : available.width
    size = { width: Math.round(width), height: Math.round(width / aspect) }
    frame.style.width = `${size.width}px`
    frame.style.height = `${size.height}px`
    if (gl) gl.resize(size.width, size.height, window.devicePixelRatio || 1)
  }

  const seedOf = (params: Record<string, unknown>): number => {
    const entry = Object.entries(tool.params).find(([, def]) => def.type === 'seed')
    const value = entry ? params[entry[0]] : undefined
    return typeof value === 'number' ? value : 1
  }

  const paint = (t: number) => {
    const params = store.get()
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    const frameData: Frame<ParamsOf<S>> = {
      params,
      t,
      width: size.width,
      height: size.height,
      dpr,
      seed: seedOf(params as Record<string, unknown>),
      rng: makeRng(seedOf(params as Record<string, unknown>)),
    }

    if (isSvg(renderModule) && svgHost) {
      const out = renderModule.render(frameData)
      svgHost.innerHTML =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size.width} ${size.height}" ` +
        `width="100%" height="100%">` +
        (out.background
          ? `<rect width="${size.width}" height="${size.height}" fill="${out.background}"/>`
          : '') +
        (out.defs ? `<defs>${out.defs}</defs>` : '') +
        out.body +
        `</svg>`
      return
    }

    if (!canvas) return
    const pixelWidth = Math.round(size.width * dpr)
    const pixelHeight = Math.round(size.height * dpr)
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth
      canvas.height = pixelHeight
      if (gl) gl.resize(size.width, size.height, dpr)
    }

    if (gl) {
      gl.draw(frameData)
      return
    }
    if (isCanvas2d(renderModule)) {
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size.width, size.height)
      renderModule.render(ctx, frameData)
    }
  }

  /* --- controls ---------------------------------------------------------- */

  const syncs: Array<() => void> = []
  const groups = new Map<string, HTMLElement>()

  const actions = document.createElement('div')
  actions.className = 'rs-actions'
  rail.append(actions)

  const action = (label: string, run: () => void) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.onclick = run
    actions.append(button)
    return button
  }

  action('Randomize', () => store.randomize())
  action('Undo', () => store.undo())
  action('Redo', () => store.redo())
  action('Reset', () => store.reset())


  for (const [name, def] of Object.entries(tool.params)) {
    const groupName = def.group ?? 'Parameters'
    let group = groups.get(groupName)
    if (!group) {
      const heading = document.createElement('div')
      heading.className = 'rs-group'
      heading.textContent = groupName
      rail.append(heading)
      group = document.createElement('div')
      rail.append(group)
      groups.set(groupName, group)
    }

    const control = buildControl(
      name,
      def,
      () => (store.get() as Record<string, unknown>)[name],
      (value) => store.set(name as keyof S & string, value as never),
    )
    group.append(control.wrap)
    syncs.push(() => {
      const visible = def.when ? def.when(store.get() as Record<string, unknown>) : true
      control.wrap.style.display = visible ? '' : 'none'
      control.sync()
    })
  }

  /* --- playback and saving ------------------------------------------------ */

  let playing = tool.meta.animated && !matchMedia('(prefers-reduced-motion: reduce)').matches
  let t = 0
  let last = performance.now()

  if (tool.meta.animated) {
    const toggle = document.createElement('button')
    toggle.type = 'button'
    toggle.textContent = playing ? 'Pause' : 'Play'
    toggle.onclick = () => {
      playing = !playing
      last = performance.now()
      toggle.textContent = playing ? 'Pause' : 'Play'
    }
    foot.append(toggle)

    const scrub = document.createElement('input')
    scrub.type = 'range'
    scrub.min = '0'
    scrub.max = '0.999'
    scrub.step = '0.001'
    scrub.style.maxWidth = '160px'
    scrub.oninput = () => {
      playing = false
      toggle.textContent = 'Play'
      t = Number(scrub.value)
      paint(t)
    }
    foot.append(scrub)
  }

  const save = document.createElement('button')
  save.type = 'button'
  save.textContent = 'Save PNG'
  save.style.marginLeft = 'auto'
  save.onclick = () => void savePng()
  foot.append(save)

  async function savePng(): Promise<void> {
    const scale = 2
    const out = document.createElement('canvas')
    out.width = Math.round(size.width * scale)
    out.height = Math.round(size.height * scale)
    const ctx = out.getContext('2d')
    if (!ctx) return

    if (canvas) {
      ctx.drawImage(canvas, 0, 0, out.width, out.height)
    } else if (svgHost) {
      const markup = svgHost.innerHTML.replace('width="100%" height="100%"', `width="${out.width}" height="${out.height}"`)
      const image = new Image()
      await new Promise((resolve, reject) => {
        image.onload = resolve
        image.onerror = reject
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
      })
      ctx.drawImage(image, 0, 0, out.width, out.height)
    }

    out.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${tool.meta.slug.replace(/^_+/, '')}.png`
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }, 'image/png')
  }

  /* --- loop --------------------------------------------------------------- */

  const syncAll = () => {
    for (const sync of syncs) sync()
  }

  store.subscribe(() => {
    syncAll()
    if (!playing) paint(t)
  })

  window.addEventListener('resize', () => {
    fit()
    paint(t)
  })

  fit()
  syncAll()
  paint(t)

  const tick = (now: number) => {
    if (playing) {
      const seconds = Math.max(0.1, tool.meta.duration)
      t = (t + (now - last) / 1000 / seconds) % 1
      paint(t)
    }
    last = now
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;',
  )
