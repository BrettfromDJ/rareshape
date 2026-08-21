import { defineTool, p, type ToolParams } from '@rareshape/schema'

/**
 * Flat shapes given a body by extruding them along one screen-space direction:
 * a face, the faces its edges sweep out, and nothing else. There is no camera
 * and no z-axis — the solidity is an illusion made of three flat colors, which
 * is exactly how it is done in the poster work this comes from.
 *
 * Every face is a plain polygon, so what lands in Figma is a handful of shapes
 * you can pull apart and recolor.
 */
export const tool = defineTool({
  slug: 'flat-solids',
  name: 'Flat Solids',
  tagline: 'Flat shapes extruded into solids.',
  category: 'Shapes',
  engine: 'svg',
  outputs: ['SVG', 'PNG', 'HTML'],
  added: '2026-08-21',
  // Still. The solidity here comes from three flat colors holding an illusion,
  // and anything that moves gives the illusion away.
  animated: false,
  aspect: '4:5',
  keywords: ['isometric', 'axonometric', 'extrude', 'blocks', 'slab', 'poster', 'geometric'],

  params: {
    /* --- the solid ------------------------------------------------------- */
    shape: p.select({
      label: 'Shape',
      default: 'rect',
      group: 'Solid',
      options: [
        { value: 'rect', label: 'Slab' },
        { value: 'triangle', label: 'Wedge' },
        { value: 'hexagon', label: 'Hex' },
        { value: 'disc', label: 'Disc' },
        { value: 'chevron', label: 'Chevron' },
      ],
    }),
    count: p.int({
      label: 'Count',
      default: 3,
      min: 1,
      max: 24,
      // Two solids and a lot of ground is a composition somebody makes on
      // purpose; it is not one to land on by accident.
      randomRange: [4, 11],
      group: 'Solid',
    }),
    size: p.number({
      label: 'Size',
      default: 0.5,
      min: 0.05,
      max: 1.5,
      step: 0.01,
      // Coverage rather than scale: how much of the frame gets painted, with
      // overlap not discounted, so heavily overlapping arrangements sit a
      // little larger than the number suggests.
      randomRange: [0.6, 1.05],
      group: 'Solid',
      hint: 'How much of the frame the solids cover.',
    }),
    ratio: p.number({
      label: 'Proportion',
      default: 1.6,
      min: 0.15,
      max: 6,
      step: 0.05,
      randomRange: [0.3, 3.2],
      group: 'Solid',
      hint: 'Wide slab or narrow blade.',
    }),
    // A slider rather than a dial: this one only ever travels a quarter turn,
    // and a dial reading 55 of a possible 360 misrepresents that.
    pitch: p.number({
      label: 'Pitch',
      default: 55,
      min: 0,
      max: 80,
      step: 1,
      unit: '°',
      randomRange: [0, 70],
      group: 'Solid',
      hint: 'How far the face tips away. 0 faces you flat on; 55 is close to isometric.',
    }),
    turn: p.angle({
      label: 'Turn',
      default: 45,
      step: 1,
      group: 'Solid',
      hint: 'The face spun in its own plane, before it tips.',
    }),

    /* --- the extrusion --------------------------------------------------- */
    depth: p.number({
      label: 'Depth',
      default: 0.12,
      min: 0,
      max: 0.6,
      step: 0.005,
      // Under about a twelfth the sides are slivers and the solids stop
      // reading as solid at all.
      randomRange: [0.09, 0.28],
      group: 'Extrusion',
      hint: 'How far the face is dragged to make a body.',
    }),
    lean: p.angle({
      label: 'Direction',
      default: 90,
      step: 1,
      // Where the light is coming from is a decision about the whole scene, so
      // randomize leaves it alone. Rolling it mostly produced bodies hanging
      // upward, which reads as a mistake rather than as a choice.
      randomize: false,
      group: 'Extrusion',
      hint: 'Which way the body is dragged. 90 is straight down.',
    }),

    /* --- how they sit together ------------------------------------------- */
    arrangement: p.select({
      label: 'Arrangement',
      default: 'stack',
      group: 'Arrangement',
      options: [
        { value: 'stack', label: 'Stack' },
        { value: 'fan', label: 'Fan' },
        { value: 'row', label: 'Row' },
        { value: 'ring', label: 'Ring' },
        { value: 'grid', label: 'Grid' },
        { value: 'cascade', label: 'Cascade' },
      ],
    }),
    gap: p.number({
      label: 'Gap',
      default: 0.34,
      min: -0.5,
      max: 1.2,
      step: 0.01,
      // The scale here is such that a gap under about 0.2 has the solids
      // merging into one mass — and one mass in one face color is the flat
      // block randomize should never hand back.
      randomRange: [0.18, 0.65],
      group: 'Arrangement',
      hint: 'Space between them. Negative overlaps.',
    }),
    spread: p.number({
      label: 'Spread',
      default: 0.55,
      min: 0,
      max: 1,
      step: 0.01,
      randomRange: [0.25, 1],
      group: 'Arrangement',
      hint: 'How far a fan opens, or how wide a ring sits.',
    }),
    taper: p.number({
      label: 'Taper',
      default: 0,
      min: -0.5,
      max: 0.5,
      step: 0.01,
      // Past about a quarter the far end of a long run shrinks to nothing.
      randomRange: [-0.22, 0.26],
      group: 'Arrangement',
      hint: 'Each one bigger or smaller than the last.',
    }),
    drop: p.number({
      label: 'Rise',
      default: 0,
      min: -0.5,
      max: 0.5,
      step: 0.01,
      randomRange: [-0.3, 0.3],
      group: 'Arrangement',
      hint: 'Each one stepped up or down from the last.',
    }),
    scatter: p.number({
      label: 'Scatter',
      default: 0,
      min: 0,
      max: 1,
      step: 0.01,
      randomRange: [0, 0.3],
      group: 'Arrangement',
      hint: 'Knocks each one out of line. Seeded, so it holds still.',
    }),

    /* --- color ----------------------------------------------------------- */
    background: p.color({ label: 'Ground', default: '#2d0a12', role: 'ground', group: 'Color' }),
    palette: p.palette({
      label: 'Faces',
      default: ['#ff5500'],
      min: 1,
      max: 8,
      group: 'Color',
      hint: 'The lit face. More than one and the solids take turns.',
    }),
    left: p.color({
      label: 'Left side',
      default: '#f2a0ff',
      group: 'Color',
      hint: 'Edges sweeping one way.',
    }),
    right: p.color({
      label: 'Right side',
      default: '#8a7f78',
      group: 'Color',
      hint: 'Edges sweeping the other.',
    }),
    outline: p.number({
      label: 'Outline',
      default: 0,
      min: 0,
      max: 4,
      step: 0.5,
      unit: 'px',
      // A keyline is a decision, not something to stumble into.
      randomize: false,
      group: 'Color',
      hint: 'A keyline around every face, in the ground color.',
    }),

    seed: p.seed({ label: 'Seed', default: 7, group: 'Color' }),
  },
})

export type Params = ToolParams<typeof tool>
