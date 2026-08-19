/**
 * Scaffolds a tool folder from a template.
 *
 *   pnpm new-tool wave-grid
 *   pnpm new-tool wave-grid --engine canvas2d --category Patterns
 *
 * What comes out builds, appears on the index, and passes the determinism
 * test — the rest is a param schema and a render function.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = resolve(import.meta.dirname, '..')

type Engine = 'svg' | 'canvas2d' | 'webgl'

interface Options {
  slug: string
  name: string
  engine: Engine
  category: string
  tagline: string
}

const ENGINES: Engine[] = ['svg', 'canvas2d', 'webgl']

export function parseArgs(argv: string[]): Options {
  const [slugArg, ...rest] = argv
  if (!slugArg || slugArg.startsWith('-')) {
    throw new Error('Usage: pnpm new-tool <slug> [--engine svg|canvas2d|webgl] [--category Patterns]')
  }

  const slug = slugArg
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!slug) throw new Error(`"${slugArg}" does not make a usable slug`)

  const flags = new Map<string, string>()
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i]
    const value = rest[i + 1]
    if (key?.startsWith('--') && value) flags.set(key.slice(2), value)
  }

  const engine = (flags.get('engine') ?? 'svg') as Engine
  if (!ENGINES.includes(engine)) throw new Error(`engine must be one of ${ENGINES.join(', ')}`)

  const name = flags.get('name') ?? slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  return {
    slug,
    name,
    engine,
    category: flags.get('category') ?? 'Patterns',
    tagline: flags.get('tagline') ?? 'One line on what it makes.',
  }
}

function toolSource(options: Options): string {
  const { slug, name, engine, category, tagline } = options
  const outputs =
    engine === 'svg' ? "['SVG', 'PNG', 'GIF', 'MP4', 'HTML']" : "['PNG', 'GIF', 'MP4', 'HTML']"

  return `import { defineTool, p, type ToolParams } from '@rareshape/schema'

export const tool = defineTool({
  slug: '${slug}',
  name: '${name}',
  tagline: '${tagline}',
  category: '${category}',
  engine: '${engine}',
  outputs: ${outputs},
  added: '${new Date().toISOString().slice(0, 10)}',
  animated: true,
  duration: 4,
  fps: 60,
  aspect: '1:1',

  params: {
    count: p.int({ label: 'Count', default: 12, min: 1, max: 80, group: 'Form' }),
    scale: p.number({ label: 'Scale', default: 0.6, min: 0, max: 1, step: 0.01, group: 'Form' }),
    ink: p.color({ label: 'Ink', default: '#f0f0f0', group: 'Color' }),
    background: p.color({ label: 'Background', default: '#0a0a0a', group: 'Color' }),
    seed: p.seed({ label: 'Seed', default: 1, group: 'Color' }),
  },

  presets: [{ name: 'Dense', params: { count: 48, scale: 0.35 } }],
})

export type Params = ToolParams<typeof tool>
`
}

function renderSource(engine: Engine): string {
  if (engine === 'svg') {
    return `import { TAU, grid, loopSin, n, type Frame, type SvgFrame } from '@rareshape/core'
import type { Params } from './tool'

/**
 * Pure: no DOM, no clock, no Math.random. Randomness comes from frame.rng,
 * and anything that moves is a function of frame.t so the loop closes.
 * See TOOL_SPEC.md §5.
 */
export function render(frame: Frame<Params>): SvgFrame {
  const { params, t, width, height } = frame
  const box = { x: 0, y: 0, width, height }
  const cells = grid(params.count, params.count, box)
  const unit = Math.min(width, height) / params.count

  const body = cells
    .map((cell, i) => {
      const cx = cell.x + cell.width / 2
      const cy = cell.y + cell.height / 2
      const r = (unit * params.scale * (0.6 + 0.4 * loopSin(t, i / cells.length))) / 2
      return r <= 0 ? '' : \`<circle cx="\${n(cx)}" cy="\${n(cy)}" r="\${n(r)}" fill="\${params.ink}"/>\`
    })
    .join('')

  return { background: params.background, body }
}

// TAU is imported for convenience; delete it if your maths does not need it.
void TAU
`
  }

  if (engine === 'canvas2d') {
    return `import { TAU, loopSin, type Frame } from '@rareshape/core'
import type { Params } from './tool'

/**
 * Pure: no DOM lookups, no clock, no Math.random. Randomness comes from
 * frame.rng, and anything that moves is a function of frame.t so the loop
 * closes. See TOOL_SPEC.md §5.
 */
export function render(ctx: CanvasRenderingContext2D, frame: Frame<Params>): void {
  const { params, t, width, height } = frame

  ctx.fillStyle = params.background
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = params.ink

  const unit = Math.min(width, height) / params.count
  for (let y = 0; y < params.count; y++) {
    for (let x = 0; x < params.count; x++) {
      const i = y * params.count + x
      const r = (unit * params.scale * (0.6 + 0.4 * loopSin(t, i / (params.count * params.count)))) / 2
      if (r <= 0) continue
      ctx.beginPath()
      ctx.arc((x + 0.5) * unit, (y + 0.5) * unit, r, 0, TAU)
      ctx.fill()
    }
  }
}
`
  }

  return `import * as THREE from 'three'
import { TAU, parseColor, type Frame, type GlRenderer } from '@rareshape/core'
import type { Params } from './tool'

/**
 * WebGL tools return a renderer rather than drawing directly: export needs its
 * own context with preserveDrawingBuffer. See TOOL_SPEC.md §5.
 */
export function create(canvas: HTMLCanvasElement | OffscreenCanvas): GlRenderer<Params> {
  const renderer = new THREE.WebGLRenderer({
    canvas: canvas as HTMLCanvasElement,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  })

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
  camera.position.z = 6
  scene.add(new THREE.AmbientLight(0xffffff, 1.2))

  const geometry = new THREE.IcosahedronGeometry(1, 1)
  const material = new THREE.MeshStandardMaterial({ roughness: 0.5 })
  const mesh = new THREE.Mesh(geometry, material)
  scene.add(mesh)

  const ink = new THREE.Color()
  const ground = new THREE.Color()

  return {
    resize(width, height, dpr) {
      renderer.setPixelRatio(1)
      renderer.setSize(Math.round(width * dpr), Math.round(height * dpr), false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    },
    draw(frame: Frame<Params>) {
      const { params, t } = frame
      const paint = parseColor(params.ink)
      const back = parseColor(params.background)
      ink.setRGB(paint.r / 255, paint.g / 255, paint.b / 255, THREE.SRGBColorSpace)
      ground.setRGB(back.r / 255, back.g / 255, back.b / 255, THREE.SRGBColorSpace)
      material.color = ink
      renderer.setClearColor(ground, back.a)

      // A whole number of turns, so t=1 lands exactly on t=0.
      mesh.rotation.set(t * TAU, t * TAU, 0)
      mesh.scale.setScalar(params.scale * 2)
      renderer.render(scene, camera)
    },
    dispose() {
      geometry.dispose()
      material.dispose()
      renderer.dispose()
    },
  }
}
`
}

export function scaffold(options: Options): string {
  const dir = join(ROOT, 'tools', options.slug)
  if (existsSync(dir)) throw new Error(`tools/${options.slug} already exists`)

  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'tool.ts'), toolSource(options))
  writeFileSync(join(dir, 'render.ts'), renderSource(options.engine))
  writeFileSync(
    join(dir, 'README.md'),
    `# ${options.name}\n\n${options.tagline}\n\nNotes on the maths go here. The checklist for shipping a tool is in TOOL_SPEC.md §10.\n`,
  )

  return dir
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const options = parseArgs(process.argv.slice(2))
    const dir = scaffold(options)
    console.log(`Created ${dir.replace(`${ROOT}/`, '')}`)
    console.log('\nNext:')
    console.log('  1. pnpm registry      picks it up')
    console.log('  2. pnpm dev           and open /tools/' + options.slug)
    console.log('  3. TOOL_SPEC.md §10   the checklist before you ship it')
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
