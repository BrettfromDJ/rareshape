# TOOL_SPEC.md

The authority on how an individual tool is written. `BUILD_BRIEF.md` covers the
platform around it.

A tool is **a param schema plus a deterministic render function**. Everything
else — controls, URL state, presets, randomize, undo, export, permalinks, OG
images, previews, the standalone HTML build — is generated from that schema by
shared machinery. If you find yourself writing interface code inside a tool, the
tool is wrong.

---

## 1. Anatomy

```
/tools/<slug>/
  tool.ts       Metadata + param schema + presets. Pure data. No DOM, no React.
  render.ts     The render function. Pure. No DOM lookups, no React, no imports
                from the kit.
  README.md     Optional. Notes on the maths.
```

`<slug>` is the folder name, the URL, and `meta.slug`. They must agree — the
registry generator fails the build if they do not.

Folders prefixed `_` are harness tools: they build, they get a page, they are
excluded from the index and from search.

---

## 2. Layer boundary

```
tools/*/render.ts  ->  may import @rareshape/core only
tools/*/tool.ts    ->  may import @rareshape/schema only
packages/kit       ->  React. Never imported by a tool.
packages/export    ->  Never imported by a tool.
```

This is enforced by an ESLint `no-restricted-imports` rule scoped to `tools/**`.
A render function that imports React fails lint. The boundary is what makes
ejecting to standalone HTML possible: the eject shell runs the same `render.ts`
with no framework present.

---

## 3. Param types

Every type below has exactly one control, one URL encoding, one randomiser and
one interpolation rule. Adding a type means adding all four.

| `type` | Value | Control | Options |
|---|---|---|---|
| `number` | `number` | slider + numeric field | `min`, `max`, `step`, `unit` |
| `int` | `number` | stepped slider | `min`, `max`, `step` (default 1) |
| `range` | `[number, number]` | dual slider | `min`, `max`, `step` |
| `boolean` | `boolean` | switch | — |
| `select` | `string` | segmented control, or dropdown past 4 options | `options: {value,label}[]` |
| `color` | `string` (`#rrggbb` / `#rrggbbaa`) | swatch opening a drag picker + hex field | `alpha`, `role` |
| `palette` | `string[]` | swatch list, add / remove / shuffle | `min`, `max` |
| `angle` | `number` (degrees) | dial + numeric field | `step` |
| `point` | `{x,y}` (0..1) | 2D pad | — |
| `text` | `string` | text field | `maxLength`, `placeholder` |
| `seed` | `number` | numeric field + dice | — |
| `curve` | `[x1,y1,x2,y2]` | cubic-bezier easing picker | — |

Shared options on every param: `label`, `default`, `group`, `hint`, `key`
(explicit short URL key), `randomize: false` to pin it, and
`when: (params) => boolean` to hide it conditionally.

`number` and `int` also take `randomRange: [min, max]` — the slice of the range
a random roll stays inside. The full range remains the person's to use; this is
only the tool saying which part of it produces results worth landing on. A
slider whose extremes collapse the composition should have one.

`seed` is special in one way: **randomize always changes it**, and every other
param honours `randomize`.

Randomize itself draws from real entropy, not from the current state. Rendering
is what has to be deterministic; the button that picks the params does not, and
deriving the roll from the state on screen made every session replay the same
chain of results. The state it lands on is still captured in the URL, so any
result remains reproducible and shareable.

Colors can be pinned against it (`Lock colors`, `store.randomize({ keepColors })`)
so a scheme somebody has settled on survives while the geometry keeps rolling.

`color` takes a `role` — `ink` (default), `ground` or `line`. Randomize-colors
(⇧R) generates one harmonious scheme and places it by role, so grounds stay
near-neutral and hairlines stay quiet against their ground. A tool that skips
the roles still works; its randomised colors are just less considered.

---

## 4. `defineTool`

```ts
import { defineTool, p } from '@rareshape/schema'

export const tool = defineTool({
  slug: 'grid',
  name: 'Grid',
  tagline: 'Rules and dots on a modular grid.',
  category: 'Patterns',
  engine: 'svg',
  outputs: ['SVG', 'PNG', 'HTML'],
  added: '2026-08-19',
  animated: false,
  duration: 4,
  fps: 60,
  aspect: '1:1',
  params: {
    columns: p.int({ label: 'Columns', default: 12, min: 1, max: 64 }),
    ink: p.color({ label: 'Ink', default: '#F0F0F0' }),
  },
  presets: [{ name: 'Dense', params: { columns: 48 } }],
})

export type Params = ToolParams<typeof tool>
```

`defineTool` returns `{ meta, params, presets, defaults }` and infers the params
type. Nothing else in the repo constructs a tool.

---

## 5. Render contract

`render.ts` exports one function per engine. All of them receive the same frame
context:

```ts
interface Frame<P> {
  params: P
  t: number       // 0..1, loop position. Always 0 for static tools.
  width: number   // logical px
  height: number
  dpr: number     // device pixel ratio, or the export scale factor
  seed: number
  rng: Rng        // seeded; the only source of randomness allowed
}
```

```ts
// engine: 'canvas2d'
export function render(ctx: CanvasRenderingContext2D, frame: Frame<Params>): void

// engine: 'svg' — returns the *contents* of an <svg>, not the element
export function render(frame: Frame<Params>): SvgFrame  // { defs?: string; body: string }

// engine: 'webgl'
export function create(canvas: HTMLCanvasElement | OffscreenCanvas): {
  draw(frame: Frame<Params>): void
  resize(width: number, height: number, dpr: number): void
  dispose(): void
}
```

### Determinism

The same `(params, t, seed, size)` must always produce the same pixels.

- No `Math.random()`. Use `frame.rng`.
- No `Date.now()`, `performance.now()`, or `new Date()`.
- No reading from the DOM, `window`, or module-level mutable state.
- No accumulating state between frames. Frame 400 must be renderable without
  rendering frames 0–399.

`pnpm test:tools` renders every tool twice at `t=0` and `t=0.5` with a fixed
seed and hashes the pixels. A hidden `Math.random()` fails it.

### Looping

`t` runs `0 → 1` across `meta.duration` seconds and wraps. Anything that moves
must return to its start at `t=1` — use `sin(t·2π)`, `wrap01()`, or the
`loop()` helpers in `@rareshape/core`. A seam at the loop point is a bug.

---

## 6. Export

Handled entirely by `@rareshape/export`; a tool implements nothing.

| Format | How | Notes |
|---|---|---|
| PNG | canvas at 1× / 2× / 4× | true alpha when the tool draws none |
| MP4 | WebCodecs `VideoEncoder` (H.264, prefer-hardware, keyframe every 2s) into `mp4-muxer` | frames stepped as `t = i / frameCount`, encoder flushed before muxing. Never `MediaRecorder`, never realtime capture |
| GIF | `gifenc`, quantised per run | the universal fallback |
| SVG | `render()` output, run through SVGO | vector tools only |
| SVG (animated) | frames sampled and driven by CSS keyframes in an embedded `<style>` | animates inside an `<img>`. Every frame's geometry sits in the document at once, so the frame count is measured against a byte budget and dropped to fit; ids are scoped per frame, or all of them resolve to frame 0's |
| HTML | `render.ts` + `tool.ts` + the vanilla shell + current params, one file | opens offline from the filesystem |

MP4 is feature-detected at mount — the encoder is asked to validate a real
config, since some Chromium builds ship WebCodecs with no H.264 encoder at all —
and **hidden** where it is missing rather than shown broken.

The codec string carries an H.264 level, and the level is a hard cap on the
frame size the encoder will accept: 4.2 stops around 1920×1088. It is chosen
from the frame being exported, smallest level that fits first, then offered to
`isConfigSupported` in order. A fixed level is why a 2400×1350 export reported
"this browser cannot encode H.264 video" on browsers that encode H.264 fine.

---

## 7. Sizes and aspect

`meta.aspect` is the tool's own shape and the one it opens at. The rail offers
the common ratios on top of it, and the choice rides in the URL under `?a=`, is
what the export sheet defaults to, and is baked into an exported HTML file — so
a link, a file and a screen all agree. Aspect is never a param: a render
function is handed a width and a height and should not care where they came
from. Render
functions receive logical `width`/`height` and must be resolution-independent:
never hardcode a pixel size, and scale strokes and type from the smaller
dimension. A 4× PNG is the same drawing, not a bigger one.

---

## 8. State

- All params live in the URL, base64url-encoded under `?p=`, non-defaults only.
- The stage aspect rides alongside them under `?a=`, omitted when it is the
  tool's own.
- Copying the URL and hard-reloading it reproduces the state exactly.
- Undo/redo covers every param change, preset load, randomize and reset.
- Presets are declared in `tool.ts`; user state is never persisted server-side.
  Recent state and stage preferences live in `localStorage`.

Shortcuts, global to every tool:

| Key | Action |
|---|---|
| `R` | Randomize |
| `⇧R` | Randomize colors only |
| `Z` / `⇧Z` | Undo / redo |
| `Space` | Play / pause |
| `E` | Export sheet |
| `C` | Copy link |
| `0` | Reset to defaults |
| `[` / `]` | Previous / next preset |
| `⌘K` | Search (index) |

---

## 9. Writing a good tool

- Ten to twenty params. Past that, group them or split the tool.
- Every param must visibly change the output. Cut the ones that do not.
- Defaults must look good with no interaction at all — the default state is the
  poster, the OG image, and the index preview.
- Prefer one idea done deeply to five ideas done shallowly.
- Sentence case labels, plain verbs, no marketing register.

---

## 10. Checklist before shipping a tool

- [ ] `pnpm registry` picks it up and the index shows it
- [ ] Every param changes the output, and the URL updates on every change
- [ ] A copied URL hard-reloads to identical output
- [ ] Randomize never produces an empty or broken frame — try it twenty times
- [ ] The loop has no seam at `t=1`
- [ ] `pnpm test:tools` passes
- [ ] PNG at 4×, and MP4 or GIF if animated, look right
- [ ] The standalone HTML export opens offline and matches the site
- [ ] `pnpm lint` passes, including the layer rule
- [ ] Defaults look good cold
