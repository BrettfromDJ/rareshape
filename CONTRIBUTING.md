# Contributing

Tools are self-contained. Pick one, build it, open a pull request — no
coordination needed, and no need to touch anything outside your tool's folder.

[`TOOL_SPEC.md`](./TOOL_SPEC.md) is the authority on how a tool is written. This
file is the practical route through it.

## Adding a tool

```bash
pnpm install
pnpm new-tool wave-grid --engine svg --category Patterns
pnpm dev
```

`pnpm dev` shows the three harness fixtures on the index as well as your tool,
and tool previews only appear once you run `pnpm previews` — before that, cells
show the tool's name on a plain plate.

That scaffolds `tools/wave-grid/` with a `tool.ts` (metadata, params, presets)
and a `render.ts` (the drawing). It already builds, already appears on the index,
and already passes the determinism test. Now make it yours:

1. **Write the param schema** in `tool.ts`. Ten to twenty params. Every one must
   visibly change the output — cut the ones that do not. The twelve param types
   are in TOOL_SPEC.md §3.
2. **Write the render function** in `render.ts`. It receives
   `{ params, t, width, height, dpr, seed, rng }` and nothing else.
3. **Make the defaults look good cold.** The default state is the poster, the OG
   image and the index preview.
4. **Close the loop.** Anything that moves must return to its start at `t=1`.
5. **Run the checklist** in TOOL_SPEC.md §10.

## The rules that are enforced

Three things fail the build rather than getting a review comment:

- **The layer boundary.** A tool may import `@rareshape/core` (in `render.ts`)
  and `@rareshape/schema` (in `tool.ts`). Not React, not the kit, not the export
  pipeline, not another tool. This is what makes ejecting to standalone HTML
  possible.
- **Determinism.** No `Math.random()`, no `Date.now()`, no `performance.now()`,
  no DOM reads, no state kept between frames. Randomness comes from `frame.rng`,
  which is seeded. `pnpm test:tools` renders every tool twice and compares
  pixels.
- **The registry.** `registry.generated.ts` is generated. Run `pnpm registry`
  and commit the result; CI checks it is current.

## Before opening a pull request

```bash
pnpm check
```

That runs lint (including the layer rule), types, the determinism test, the
export pipeline checks, the standalone HTML checks and the bundle budget.

If your tool animates, also look at a real export — a 10 second MP4 or GIF at
60fps — and watch the loop point.

## What makes a good tool here

- One idea, done deeply. Not five ideas done shallowly.
- Controls that say what happens: `Columns`, not `Grid density factor`.
- Sentence case, plain verbs, no marketing register.
- Output that is worth exporting at 4×.

## What does not belong

- Interface code inside a tool. If you are writing DOM, the platform is missing
  something — open an issue instead.
- A tool that needs a network request, an API key or a backend.
- Anything that only works at one canvas size.
