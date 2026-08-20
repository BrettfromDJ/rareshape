import { defineTool, p, type ToolParams } from '@rareshape/schema'

/**
 * Disposable harness for the WebGL path. Minimal Three.js scene — enough to
 * prove the separate offscreen export renderer and the import-map eject.
 */
export const tool = defineTool({
  slug: '_harness-webgl',
  name: 'Harness WebGL',
  tagline: 'A Three.js scene, for the WebGL export path.',
  category: 'Shaders',
  engine: 'webgl',
  outputs: ['PNG', 'GIF', 'MP4', 'HTML'],
  added: '2026-08-19',
  animated: true,
  duration: 6,
  fps: 60,
  aspect: '1:1',
  keywords: ['harness', 'fixture', 'test', 'three'],

  params: {
    count: p.int({ label: 'Instances', default: 240, min: 1, max: 2000, group: 'Scene' }),
    radius: p.number({ label: 'Radius', default: 1.6, min: 0.2, max: 4, step: 0.05, group: 'Scene' }),
    size: p.number({ label: 'Size', default: 0.13, min: 0.01, max: 0.6, step: 0.005, group: 'Scene' }),
    twist: p.number({ label: 'Twist', default: 1.4, min: -4, max: 4, step: 0.05, group: 'Scene' }),
    // Whole turns per loop: a fractional spin would not land back on frame 0.
    spin: p.int({ label: 'Turns per loop', default: 1, min: -3, max: 3, group: 'Scene' }),

    ink: p.color({ label: 'Ink', default: '#f0f0f0', group: 'Ink' }),
    background: p.color({ label: 'Background', default: '#0a0a0a', group: 'Ink' }),
    wireframe: p.boolean({ label: 'Wireframe', default: false, group: 'Ink' }),

    seed: p.seed({ label: 'Seed', default: 3, group: 'Ink' }),
  },
})

export type Params = ToolParams<typeof tool>
