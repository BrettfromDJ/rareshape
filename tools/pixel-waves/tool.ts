import { defineTool, p, type ToolParams } from '@rareshape/schema'

/**
 * Wave bands snapped to a pixel grid. Smooth curves are quantised to whole
 * cells, so the output reads as data plotted on graph paper rather than as a
 * drawing — the tension between the smooth wave and the hard grid is the tool.
 *
 * Every URL key is frozen at the value it was already inferring, so nothing
 * shared before today changes and nothing shared after today breaks.
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
      key: 'c',
      label: 'Columns',
      default: 96,
      min: 8,
      // 213 columns is where a 16:9 frame hits the 120-row ceiling, so there is
      // nothing above this to reach. A taller frame hits it sooner — at 4:5 the
      // slider stops mattering around 96 — which is the price of square cells
      // and a fixed number of rows.
      max: 220,
      randomRange: [28, 180],
      group: 'Grid',
      hint: 'Cells across. Rows follow, so cells stay square — and stop at 120.',
    }),
    // Rise and run. Kept as two controls because tying the tread to the cell
    // size meant the only way to get chunky stairs was a coarse grid — the two
    // were one slider fighting itself.
    step: p.int({
      key: 's',
      label: 'Step height',
      default: 2,
      min: 1,
      max: 10,
      randomRange: [1, 5],
      group: 'Grid',
      hint: 'Cells each vertical step jumps by.',
    }),
    tread: p.int({
      key: 'tw',
      label: 'Step width',
      default: 1,
      min: 1,
      max: 24,
      randomRange: [1, 8],
      group: 'Grid',
      hint: 'Columns each step holds for. Wider treads without a coarser grid.',
    }),
    grid: p.boolean({ label: 'Grid lines', default: true, key: 'g', group: 'Grid' }),
    gridColor: p.color({
      key: 'gc',
      label: 'Grid',
      default: '#b4c6d6',
      role: 'line',
      group: 'Grid',
      when: (params) => params.grid === true,
    }),
    gridBlend: p.select({
      key: 'gb',
      label: 'Grid blend',
      default: 'multiply',
      group: 'Grid',
      hint: 'How the grid takes its tint from the color beneath it.',
      // Pinned against randomize, alongside the weight, and multiply is what
      // it holds at. Rolling this landed on `none`, which paints one flat grid
      // color across the whole frame whatever is under it.
      randomize: false,
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
      key: 'gw',
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
      key: 'l',
      label: 'Bands',
      default: 4,
      min: 2,
      max: 8,
      randomRange: [3, 6],
      group: 'Waves',
    }),
    fill: p.select({
      key: 'f',
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
      key: 't',
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
      key: 's2',
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
      key: 'a',
      label: 'Amplitude',
      default: 0.12,
      min: 0,
      max: 0.5,
      step: 0.005,
      randomRange: [0.05, 0.32],
      group: 'Waves',
    }),
    frequency: p.number({
      key: 'f2',
      label: 'Frequency',
      default: 1.8,
      min: 0.2,
      max: 8,
      step: 0.1,
      randomRange: [0.6, 4.5],
      group: 'Waves',
    }),
    roughness: p.number({
      key: 'r',
      label: 'Roughness',
      default: 0.45,
      min: 0,
      max: 1,
      step: 0.01,
      group: 'Waves',
      hint: 'Noise mixed into the wave.',
    }),
    dither: p.int({
      key: 'dt',
      label: 'Dither',
      default: 3,
      min: 0,
      max: 12,
      randomRange: [0, 8],
      group: 'Waves',
      hint: 'Rows of scattered cells where a band meets what is behind it. 0 is a hard edge.',
    }),
    drift: p.int({
      key: 'd',
      label: 'Drift',
      default: 1,
      min: -3,
      max: 3,
      randomRange: [-2, 2],
      group: 'Waves',
      hint: 'Whole turns per loop, so the animation closes.',
    }),

    background: p.color({
      label: 'Paper',
      default: '#f4f2ed',
      role: 'ground',
      key: 'b',
      group: 'Color',
    }),
    palette: p.palette({
      key: 'p',
      label: 'Bands',
      default: ['#e04a26', '#8ea3b8', '#151515', '#ffffff'],
      min: 1,
      max: 8,
      group: 'Color',
    }),

    seed: p.seed({ label: 'Seed', default: 4, key: 's3', group: 'Color' }),
  },
})

export type Params = ToolParams<typeof tool>
