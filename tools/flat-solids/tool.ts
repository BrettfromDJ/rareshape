import { defineTool, p, type ToolParams } from '@rareshape/schema'

/**
 * Slabs given a body by extruding them along one screen-space direction: a
 * face, the faces its edges sweep out, and nothing else. There is no camera and
 * no z-axis — the solidity is an illusion made of three flat colors, which is
 * exactly how it is done in the poster work this comes from.
 *
 * Every face is a plain polygon, so what lands in Figma is a handful of shapes
 * you can pull apart and recolor.
 *
 * Every URL key here is frozen. They are cheap to write down, and the moment a
 * link has been shared a key inferred from the schema turns any later edit into
 * a broken link.
 */
export const tool = defineTool({
  slug: 'flat-solids',
  name: 'Flat Solids',
  tagline: 'Slabs extruded into solids.',
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
    /* --- the slab -------------------------------------------------------- */
    count: p.int({
      label: 'Count',
      default: 3,
      min: 1,
      max: 24,
      // Two solids and a lot of ground is a composition somebody makes on
      // purpose; it is not one to land on by accident.
      randomRange: [4, 11],
      key: 'c',
      group: 'Slab',
    }),
    lengths: p.numbers({
      label: 'Lengths',
      // One entry, so the slabs start uniform. Add entries and they take turns
      // through the list, the way the faces take turns through the palette.
      default: [1.6],
      min: 0.2,
      max: 5,
      step: 0.05,
      minCount: 1,
      maxCount: 6,
      // A run of wildly unrelated lengths reads as debris. A few at most, in a
      // band where the shortest still reads as a slab.
      randomRange: [0.7, 2.6],
      key: 'ln',
      group: 'Slab',
      hint: 'The long side, taken in turn. One entry and every slab matches.',
    }),
    breadth: p.number({
      label: 'Breadth',
      default: 1,
      min: 0.15,
      max: 4,
      step: 0.05,
      // Shared by every slab, and pinned: the lengths are what vary, and if
      // this varied too there would be no constant to read them against.
      randomize: false,
      key: 'bd',
      group: 'Slab',
      hint: 'The short side. The same for all of them.',
    }),
    // Pitch and Turn together are the projection, and a projection is a
    // decision about the whole picture rather than something to re-roll. Left
    // to randomize they landed on angles between the clean ones, where a solid
    // reads as a shape that has been knocked over rather than one seen from a
    // consistent point of view.
    //
    // A slider rather than a dial for Pitch: it only ever travels a quarter
    // turn, and a dial reading 60 of a possible 360 misrepresents that.
    pitch: p.number({
      label: 'Pitch',
      // 60° squashes a turned square to twice as wide as it is tall, which is
      // the isometric everyone draws.
      default: 60,
      min: 0,
      max: 80,
      step: 1,
      unit: '°',
      randomize: false,
      key: 'pt',
      group: 'Slab',
      hint: 'How far the face tips away. 0 faces you flat on, 60 is isometric.',
    }),
    turn: p.angle({
      label: 'Turn',
      default: 45,
      step: 1,
      randomize: false,
      key: 'tn',
      group: 'Slab',
      hint: 'The face spun in its own plane, before it tips. 0 for blades, 45 for boxes.',
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
      key: 'dp',
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
      key: 'dr',
      group: 'Extrusion',
      hint: 'Which way the body is dragged. 90 is straight down.',
    }),

    /* --- how they sit together ------------------------------------------- */
    arrangement: p.select({
      label: 'Arrangement',
      default: 'stack',
      key: 'ar',
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
      key: 'gp',
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
      key: 'sp',
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
      key: 'tp',
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
      key: 'rs',
      group: 'Arrangement',
      hint: 'Each one stepped up or down from the last.',
    }),
    scatter: p.number({
      label: 'Scatter',
      default: 0,
      min: 0,
      max: 1,
      step: 0.01,
      randomRange: [0, 0.25],
      key: 'sc',
      group: 'Arrangement',
      hint: 'Nudges each one off its mark. Position only — they stay square to each other.',
    }),

    /* --- the frame -------------------------------------------------------- */
    size: p.number({
      label: 'Zoom',
      default: 0.5,
      min: 0.05,
      max: 1.5,
      step: 0.01,
      // Coverage rather than scale: how much of the frame gets painted, with
      // overlap not discounted, so heavily overlapping arrangements sit a
      // little larger than the number suggests.
      randomRange: [0.6, 1.05],
      key: 'sz',
      group: 'Frame',
      hint: 'How much of the frame the solids cover. Past about 1 they crop.',
    }),
    pan: p.point({
      label: 'Position',
      default: { x: 0.5, y: 0.5 },
      // Framing is the last decision anybody makes and the one they make on
      // purpose, so randomize never touches it.
      randomize: false,
      key: 'pn',
      group: 'Frame',
      hint: 'Drag to move the composition. With Zoom past 1 this is the crop.',
    }),

    /* --- color ----------------------------------------------------------- */
    background: p.color({
      label: 'Ground',
      default: '#2d0a12',
      role: 'ground',
      key: 'bg',
      group: 'Color',
    }),
    palette: p.palette({
      label: 'Faces',
      default: ['#ff5500'],
      min: 1,
      max: 8,
      key: 'pl',
      group: 'Color',
      hint: 'The lit face. More than one and the solids take turns.',
    }),
    left: p.color({
      label: 'Left side',
      default: '#f2a0ff',
      key: 'lf',
      group: 'Color',
      hint: 'Edges sweeping one way.',
    }),
    right: p.color({
      label: 'Right side',
      default: '#8a7f78',
      key: 'rt',
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
      key: 'ol',
      group: 'Color',
      hint: 'A keyline around every face, in the ground color.',
    }),

    seed: p.seed({ label: 'Seed', default: 7, key: 'sd', group: 'Color' }),
  },
})

export type Params = ToolParams<typeof tool>
