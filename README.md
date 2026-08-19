# Rareshape

An open repository of small browser tools for designers — pattern makers, shape
generators, effects, shaders. Each tool has its own URL, they all share one set
of controls, and every one exports real files: PNG, MP4, GIF, SVG where it
applies, and a standalone HTML file that keeps working offline.

Free and open source, MIT. No accounts, no database, no tracking: state lives in
the URL.

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

## The bet

**A tool is a param schema plus a deterministic render function.** Everything
else — controls, URL state, presets, randomize, undo, export, permalinks, OG
images, index previews, the standalone HTML build — is generated from that
schema by shared machinery.

Adding tool #80 should mean writing a render function and a param list, and
nothing else. [`TOOL_SPEC.md`](./TOOL_SPEC.md) is the authority on how to write
one.

## Layout

```
app/            Index, /tools/[slug] host, /info, and /lab (headless driver)
packages/core   Seeded RNG, math, easing, colour, noise, geometry. Pure, no deps
packages/schema Param types, defineTool, URL codec, the framework-free store
packages/kit    React: controls, Stage, export sheet, shortcuts
packages/export  png · gif · mp4 · svg · animated svg · standalone html
packages/eject  Vanilla DOM shell, schema-driven, no framework
tools/          One folder per tool. `_` prefixed folders are harness fixtures
scripts/        Registry, previews, scaffolder, and the checks
```

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Regenerates the registry and eject bundles, then serves the site |
| `pnpm build` | Static export into `out/` |
| `pnpm new-tool <slug>` | Scaffolds a tool folder that already builds |
| `pnpm registry` | Rescans `tools/` into `registry.generated.ts` |
| `pnpm previews` | Renders posters and preview videos through the real export pipeline |
| `pnpm test:tools` | Determinism: every tool rendered twice, pixel-hashed |
| `pnpm check` | Everything below, in one go |
| `pnpm check:index` | Pads the registry to 100 entries and measures the index |

The checks behind `pnpm check`, each runnable on its own:

| Script | What it proves |
|---|---|
| `scripts/check-state.ts` | Every param type has a control, changes write to the URL, a copied URL hard-reloads identically, undo/redo/randomize/reset/presets work |
| `scripts/check-exports.ts` | PNG at 1×/2×/4×, byte-identical repeat exports, a 10s 60fps MP4 with 600 frames, no seam at the loop point, animated SVG that animates inside an `img` |
| `scripts/check-eject.ts` | Every tool ejects, and each file opens over `file://` with the network off |
| `scripts/check-a11y.ts` | axe-core clean on the index, info and tool pages, with visible focus |
| `scripts/check-index.ts` | The index at 100 entries: scroll smoothness, preview limits, keyboard filtering and search |

`pnpm previews` needs a build first — it drives the built site in headless
Chromium so previews come out of the same code users run. In CI the order is
build → previews → build.

## Harness tools

`tools/_harness-svg`, `_harness-canvas` and `_harness-webgl` are disposable
tools, one per engine, that exist to prove the platform: every param type, every
export format, both render paths. They are excluded from the index and from
search, and they double as the fixtures for the determinism test. They stay.

To see them on the index while developing:

```bash
NEXT_PUBLIC_SHOW_HARNESS=1 pnpm dev
```

## Notes on two decisions

### MP4 and H.264

MP4 is WebCodecs only — `avc1.4D402A`, hardware preferred, keyframe every two
seconds, frames stepped as `t = i / frameCount` and the encoder flushed before
muxing. There is no ffmpeg.wasm fallback; GIF is the universal fallback.

Support is probed with `VideoEncoder.isConfigSupported`, not with the presence
of the constructor: some Chromium builds ship WebCodecs with no H.264 encoder at
all, and MP4 has to be absent there rather than broken. That includes the
Chromium that Playwright installs, which is why CI installs Chrome to build
previews — `pnpm previews` warns and falls back to an open codec otherwise.

### Bundle budget

The brief asks for index JS under 120KB gzipped. Measured here, an effectively
empty page in Next 16 with React 19 costs **173KB gzipped** — the target is
below the framework's own floor, so it cannot be met without leaving the
framework behind for the index.

`pnpm size` therefore reports three numbers and enforces the one that is ours:

```
framework baseline (/info): 173.1 KB gzipped
index total:                185.4 KB gzipped   (guard: 200 KB)
index app code:              12.2 KB gzipped   (budget: 32 KB)
```

It also fails if Three.js ever reaches the index bundle, which is the regression
the budget was really protecting against. If the 120KB figure has to hold
literally, the index would need to be rendered without React — the grid, filters
and ⌘K are about 12KB of behaviour, so a hand-written script could carry them.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) and [`TOOL_SPEC.md`](./TOOL_SPEC.md).
Tools can be built in any order, in parallel, by anyone.

## Licence

MIT.
