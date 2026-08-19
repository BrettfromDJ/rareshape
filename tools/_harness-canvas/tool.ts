import { defineTool, p, type ToolParams } from '@rareshape/schema'

/**
 * Disposable harness for the canvas2d path. Animated, so it exercises loop
 * wrapping, 4× export and the frame-stepped MP4 and GIF encoders.
 */
export const tool = defineTool({
  slug: '_harness-canvas',
  name: 'Harness Canvas',
  tagline: 'Canvas2d, animated, for the export pipeline.',
  category: 'Patterns',
  engine: 'canvas2d',
  outputs: ['PNG', 'GIF', 'MP4', 'HTML'],
  added: '2026-08-19',
  animated: true,
  duration: 4,
  fps: 60,
  aspect: '16:9',
  keywords: ['harness', 'fixture', 'test'],

  params: {
    lines: p.int({ label: 'Lines', default: 40, min: 2, max: 200, group: 'Field' }),
    steps: p.int({ label: 'Resolution', default: 90, min: 8, max: 400, group: 'Field' }),
    amplitude: p.number({
      label: 'Amplitude',
      default: 0.18,
      min: 0,
      max: 0.5,
      step: 0.005,
      group: 'Field',
    }),
    frequency: p.number({ label: 'Frequency', default: 2.2, min: 0.2, max: 12, step: 0.1, group: 'Field' }),
    drift: p.number({ label: 'Drift', default: 0.4, min: 0, max: 2, step: 0.01, group: 'Field' }),

    weight: p.number({ label: 'Weight', default: 1.25, min: 0.25, max: 8, step: 0.25, unit: 'px', group: 'Ink' }),
    background: p.color({ label: 'Background', default: '#0a0a0a', group: 'Ink' }),
    palette: p.palette({ label: 'Palette', default: ['#f0f0f0', '#4a4a4a'], min: 1, max: 6, group: 'Ink' }),
    fade: p.boolean({ label: 'Fade edges', default: true, group: 'Ink' }),

    seed: p.seed({ label: 'Seed', default: 7, group: 'Ink' }),
  },

  presets: [
    { name: 'Fine', params: { lines: 120, weight: 0.5, amplitude: 0.1 } },
    { name: 'Heavy', params: { lines: 14, weight: 6, amplitude: 0.3, frequency: 1.2 } },
  ],
})

export type Params = ToolParams<typeof tool>
