import { defineTool, p, type ToolParams } from '@rareshape/schema'

/**
 * Wave bands snapped to a pixel grid. Smooth curves are quantised to whole
 * cells, so the output reads as data plotted on graph paper rather than as a
 * drawing — the tension between the smooth wave and the hard grid is the tool.
 */
export const tool = defineTool({
  slug: 'pixel-waves',
  name: 'Pixel Waves',
  tagline: 'Wave bands quantised to a pixel grid.',
  category: 'Patterns',
  engine: 'svg',
  outputs: ['SVG', 'PNG', 'GIF', 'MP4', 'HTML'],
  added: '2026-08-19',
  animated: true,
  duration: 8,
  fps: 60,
  aspect: '16:9',
  keywords: ['grid', 'graph paper', 'waveform', 'bitmap', 'chart', 'halftone'],

  params: {
    columns: p.int({
      label: 'Columns',
      default: 96,
      min: 8,
      max: 320,
      group: 'Grid',
      hint: 'Cells across. Rows follow, so cells stay square.',
    }),
    step: p.int({
      label: 'Step',
      default: 2,
      min: 1,
      max: 10,
      group: 'Grid',
      hint: 'Cells per vertical step. Higher is blockier.',
    }),
    grid: p.boolean({ label: 'Grid lines', default: true, group: 'Grid' }),
    gridColor: p.color({
      label: 'Grid',
      default: '#b4c6d6',
      role: 'line',
      group: 'Grid',
      when: (params) => params.grid === true,
    }),
    gridBlend: p.select({
      label: 'Grid blend',
      default: 'auto',
      group: 'Grid',
      hint: 'How the grid takes its tint from the colour beneath it. Auto stays visible on light and dark alike.',
      options: [
        { value: 'auto', label: 'Auto' },
        { value: 'multiply', label: 'Multiply' },
        { value: 'screen', label: 'Screen' },
        { value: 'overlay', label: 'Overlay' },
        { value: 'soft-light', label: 'Soft light' },
        { value: 'none', label: 'None' },
      ],
      when: (params) => params.grid === true,
    }),
    gridWeight: p.number({
      label: 'Grid weight',
      default: 0.75,
      min: 0.25,
      max: 3,
      step: 0.25,
      unit: 'px',
      group: 'Grid',
      when: (params) => params.grid === true,
    }),

    // Two is the floor: one band anchored to the top edge and one to the
    // bottom is what guarantees colour reaches both.
    layers: p.int({ label: 'Bands', default: 4, min: 2, max: 8, group: 'Waves' }),
    fill: p.select({
      label: 'Fill',
      default: 'edges',
      group: 'Waves',
      // Ribbons float and stacks leave the top open — both are deliberate
      // looks, so randomize leaves this alone rather than handing back a
      // composition with paper strips across it.
      randomize: false,
      options: [
        { value: 'edges', label: 'Edges' },
        { value: 'ribbons', label: 'Ribbons' },
        { value: 'stacked', label: 'Stacked' },
      ],
    }),
    thickness: p.number({
      label: 'Thickness',
      default: 0.1,
      min: 0.01,
      max: 0.6,
      step: 0.005,
      group: 'Waves',
    }),
    spread: p.number({
      label: 'Spread',
      default: 0.6,
      min: 0,
      max: 1,
      step: 0.01,
      group: 'Waves',
      hint: 'How far the bands sit apart.',
    }),
    amplitude: p.number({
      label: 'Amplitude',
      default: 0.12,
      min: 0,
      max: 0.5,
      step: 0.005,
      group: 'Waves',
    }),
    frequency: p.number({
      label: 'Frequency',
      default: 1.8,
      min: 0.2,
      max: 8,
      step: 0.1,
      group: 'Waves',
    }),
    roughness: p.number({
      label: 'Roughness',
      default: 0.45,
      min: 0,
      max: 1,
      step: 0.01,
      group: 'Waves',
      hint: 'Noise mixed into the wave.',
    }),
    taper: p.number({
      label: 'Taper',
      default: 0.35,
      min: 0,
      max: 1,
      step: 0.01,
      group: 'Waves',
      hint: 'Thins the bands towards the edges.',
    }),
    drift: p.int({
      label: 'Drift',
      default: 1,
      min: -3,
      max: 3,
      group: 'Waves',
      hint: 'Whole turns per loop, so the animation closes.',
    }),

    background: p.color({ label: 'Paper', default: '#f4f2ed', role: 'ground', group: 'Colour' }),
    palette: p.palette({
      label: 'Bands',
      default: ['#e04a26', '#8ea3b8', '#151515', '#ffffff'],
      min: 1,
      max: 8,
      group: 'Colour',
    }),

    seed: p.seed({ label: 'Seed', default: 4, group: 'Colour' }),
  },

  presets: [
    {
      name: 'Rough',
      params: { columns: 120, layers: 4, thickness: 0.12, roughness: 0.6, amplitude: 0.13 },
    },
    {
      name: 'Fine',
      params: { columns: 240, layers: 6, thickness: 0.07, amplitude: 0.1, gridWeight: 0.25 },
    },
    {
      name: 'Blocks',
      params: {
        columns: 32,
        step: 1,
        layers: 3,
        thickness: 0.26,
        amplitude: 0.2,
        roughness: 0.1,
        grid: false,
        fill: 'ribbons',
      },
    },
    {
      name: 'Mono',
      params: {
        background: '#ffffff',
        palette: ['#111111', '#9a9a9a', '#dcdcdc'],
        gridColor: '#e2e2e2',
        layers: 5,
      },
    },
  ],
})

export type Params = ToolParams<typeof tool>
