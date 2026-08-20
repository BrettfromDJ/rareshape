import { defineTool, p, type ToolParams } from '@rareshape/schema'

/**
 * Disposable harness. It exists to prove the platform, not to be useful:
 * it uses every param type in TOOL_SPEC.md §3 at least once, and it animates,
 * so the kit, the URL codec, the SVG export and the eject shell are all
 * exercised by something that ships in the repo permanently.
 *
 * Excluded from the index by the leading underscore.
 */
export const tool = defineTool({
  slug: '_harness-svg',
  name: 'Harness SVG',
  tagline: 'Every param type, once, in vector.',
  category: 'Shapes',
  engine: 'svg',
  outputs: ['SVG', 'PNG', 'GIF', 'MP4', 'HTML'],
  added: '2026-08-19',
  animated: true,
  duration: 4,
  fps: 60,
  aspect: '1:1',
  keywords: ['harness', 'fixture', 'test'],

  params: {
    columns: p.int({ label: 'Columns', default: 9, min: 1, max: 40, group: 'Grid' }),
    rows: p.int({ label: 'Rows', default: 9, min: 1, max: 40, group: 'Grid' }),
    padding: p.number({
      label: 'Padding',
      default: 0.06,
      min: 0,
      max: 0.4,
      step: 0.005,
      group: 'Grid',
    }),
    scale: p.range({
      label: 'Scale range',
      default: [0.25, 0.9],
      min: 0,
      max: 1,
      step: 0.01,
      group: 'Grid',
      hint: 'Smallest and largest cell fill.',
    }),

    shape: p.select({
      label: 'Shape',
      default: 'circle',
      group: 'Form',
      options: [
        { value: 'circle', label: 'Circle' },
        { value: 'square', label: 'Square' },
        { value: 'triangle', label: 'Triangle' },
        { value: 'cross', label: 'Cross' },
      ],
    }),
    stroke: p.boolean({ label: 'Outline', default: false, group: 'Form' }),
    weight: p.number({
      label: 'Weight',
      default: 2,
      min: 0.25,
      max: 12,
      step: 0.25,
      unit: 'px',
      group: 'Form',
      when: (params) => params.stroke === true,
    }),
    rotation: p.angle({ label: 'Rotation', default: 0, step: 1, group: 'Form' }),

    background: p.color({ label: 'Background', default: '#0a0a0a', alpha: true, group: 'Color' }),
    palette: p.palette({
      label: 'Palette',
      default: ['#f0f0f0', '#8a8a8a', '#4a4a4a'],
      min: 1,
      max: 8,
      group: 'Color',
    }),
    tint: p.color({ label: 'Tint', default: '#f0f0f0', group: 'Color' }),

    focus: p.point({
      label: 'Focus',
      default: { x: 0.5, y: 0.5 },
      group: 'Motion',
      hint: 'Where the falloff is centred.',
    }),
    falloff: p.curve({ label: 'Falloff', default: [0.4, 0, 0.2, 1], group: 'Motion' }),
    amount: p.number({ label: 'Wobble', default: 0.35, min: 0, max: 1, step: 0.01, group: 'Motion' }),

    caption: p.text({
      label: 'Caption',
      default: '',
      maxLength: 40,
      placeholder: 'Optional',
      group: 'Label',
    }),
    seed: p.seed({ label: 'Seed', default: 1, group: 'Label' }),
  },
})

export type Params = ToolParams<typeof tool>
