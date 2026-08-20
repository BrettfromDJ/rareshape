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
      randomRange: [28, 220],
      group: 'Grid',
      hint: 'Cells across. Rows follow, so cells stay square.',
    }),
    // Rise and run. Kept as two controls because tying the tread to the cell
    // size meant the only way to get chunky stairs was a coarse grid — the two
    // were one slider fighting itself.
    step: p.int({
      label: 'Step height',
      default: 2,
      min: 1,
      max: 10,
      randomRange: [1, 5],
      group: 'Grid',
      hint: 'Cells each vertical step jumps by.',
    }),
    tread: p.int({
      label: 'Step width',
      default: 1,
      min: 1,
      max: 24,
      randomRange: [1, 8],
      // Frozen: an inferred key would take `t` from Thickness and break every
      // link anyone has already shared.
      key: 'tw',
      group: 'Grid',
      hint: 'Columns each step holds for. Wider treads without a coarser grid.',
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
      hint: 'How the grid takes its tint from the color beneath it. Auto stays visible on light and dark alike.',
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
      default: 1,
      min: 0.25,
      max: 3,
      step: 0.25,
      unit: 'px',
      // Pinned against randomize. A heavier rule is a deliberate choice, and
      // rolling it meant a third of the results came back veiled in grid color
      // instead of showing the bands.
      randomize: false,
      group: 'Grid',
      when: (params) => params.grid === true,
    }),

    // Two is the floor: one band anchored to the top edge and one to the
    // bottom is what guarantees color reaches both.
    layers: p.int({
      label: 'Bands',
      default: 4,
      min: 2,
      max: 8,
      randomRange: [3, 6],
      group: 'Waves',
    }),
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
      // Past about a fifth of the height a single band swallows the frame.
      randomRange: [0.05, 0.22],
      group: 'Waves',
    }),
    spread: p.number({
      label: 'Spread',
      default: 0.6,
      min: 0,
      max: 1,
      step: 0.01,
      // Below this the bands pile up and hide each other.
      randomRange: [0.4, 1],
      group: 'Waves',
      hint: 'How far the bands sit apart.',
    }),
    amplitude: p.number({
      label: 'Amplitude',
      default: 0.12,
      min: 0,
      max: 0.5,
      step: 0.005,
      randomRange: [0.05, 0.32],
      group: 'Waves',
    }),
    frequency: p.number({
      label: 'Frequency',
      default: 1.8,
      min: 0.2,
      max: 8,
      step: 0.1,
      randomRange: [0.6, 4.5],
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
    dither: p.int({
      label: 'Dither',
      default: 3,
      min: 0,
      max: 12,
      randomRange: [0, 8],
      // Frozen: `d` is Drift's.
      key: 'dt',
      group: 'Waves',
      hint: 'Rows of scattered cells where a band meets what is behind it. 0 is a hard edge.',
    }),
    drift: p.int({
      label: 'Drift',
      default: 1,
      min: -3,
      max: 3,
      randomRange: [-2, 2],
      group: 'Waves',
      hint: 'Whole turns per loop, so the animation closes.',
    }),

    background: p.color({ label: 'Paper', default: '#f4f2ed', role: 'ground', group: 'Color' }),
    palette: p.palette({
      label: 'Bands',
      default: ['#e04a26', '#8ea3b8', '#151515', '#ffffff'],
      min: 1,
      max: 8,
      group: 'Color',
    }),

    seed: p.seed({ label: 'Seed', default: 4, group: 'Color' }),
  },
})

export type Params = ToolParams<typeof tool>
