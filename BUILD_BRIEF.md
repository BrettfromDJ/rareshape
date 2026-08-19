# BUILD_BRIEF.md

A phased brief for building the platform. Each phase is a discrete piece of work with its own paste-ready prompt and acceptance criteria — run them in order and verify each before moving on.

**No real tools are built in this brief.** The tool set is decided separately. Every phase here is validated against disposable harness tools (§5), so the whole platform can be finished and proven before the first real tool exists.

---

## 1. What this is

An open-source repository of small browser-based tools for designers — pattern makers, shape generators, effects, shaders. A utilitarian index page lists them; each tool has its own URL. Every tool shares one visual language and one set of controls, so using a second tool requires learning nothing new. Every tool can export real output: PNG, MP4, GIF, SVG where applicable, and a standalone HTML file. Expected to scale past 100 tools.

The architectural bet: a tool is a param schema plus a deterministic render function, and everything else — the controls, URL state, presets, randomize, undo, export, permalinks, OG images, previews — is generated from that schema by shared machinery. Adding tool #80 should mean writing a render function and a param list, nothing more.

---

## 2. Locked decisions

| Decision | Choice |
|---|---|
| Architecture | Hybrid — shared kit, but every tool can eject to a standalone HTML file |
| MP4 export | WebCodecs only (Chrome, Edge, Safari 16.4+). No ffmpeg.wasm fallback. GIF is the universal fallback |
| Licensing | Free and open source, MIT |
| Backend | None. No accounts, no database. State lives in the URL and localStorage |
| Framework | Next.js App Router, static export |
| Language | TypeScript, strict |
| Package manager | pnpm |

`TOOL_SPEC.md` is the companion document and the authority on how an individual tool is written. This brief covers the platform around it.

---

## 3. Repo structure

```
/app
  page.tsx                    Index
  /tools/[slug]/page.tsx      Generic host, resolves from registry
  /info/page.tsx
/tools
  /_harness-svg/              Disposable, excluded from the index
  /_harness-canvas/
  /_harness-webgl/
/packages
  /core        Seeded RNG, easing, color, noise, geometry. Pure, no deps
  /schema      defineTool, param types, URL codec, preset handling
  /kit         React: controls, Stage, ExportBar, shortcuts, tokens
  /export      png, gif, mp4, svg, svg-animated, html
  /eject       Vanilla DOM shell, schema-driven
/scripts
  new-tool.ts        Scaffolder
  build-previews.ts  Headless poster + preview generation
  build-registry.ts  Generates registry.generated.ts from /tools
registry.generated.ts
TOOL_SPEC.md
BUILD_BRIEF.md
```

Folders prefixed `_` are excluded from the registry and never appear on the index.

---

## 4. Design direction

The reference pins the visual direction: near-black, flat, utilitarian, information-dense, zero ornament. Follow it closely.

**Palette — no accent color.** This is the one real decision to hold to. The site's chrome is monochrome; the only color anywhere is the output of the tools themselves. A brand accent would compete with every preview on the index.

```
--bg      #0A0A0A    Page
--surface #131313    Rails, sheets, inputs
--line    #222222    Hairlines, 1px, never a border-radius
--text    #F0F0F0    Primary
--dim     #8A8A8A    Metadata, labels, inactive nav
--faint   #4A4A4A    Dividers in text, disabled
```

**Type.** Geist Sans for interface and the hero statement, Geist Mono for all metadata — dates, categories, output formats, numeric field values, keyboard hints. Both open source, which matters for an OSS repo. The mono/sans split is what carries the utilitarian character; use it consistently rather than decoratively. Hero statement sits around 56–64px, tight leading, regular weight — the reference gets its authority from scale and restraint, not weight.

Set the type scale as CSS variables in one file so swapping in a licensed face later is a single change.

**Index layout**, mapped from the reference:

```
┌─────────────────────────────────────────────────────────────┐
│ Wordmark        Index  Tools  Info      06:10 PM   [ GitHub ]│
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Tools      Categories        Large statement line           │
│  24         6                 running two or three           │
│                               lines, left-aligned            │
│  Exports    Updated                                          │
│  5 formats  08/26                              ↳ Add a tool  │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  All  Patterns  Shapes  Effects  Shaders  Type  Image   ⌘K   │
├─────────────────────────────────────────────────────────────┤
│ 08/26  Tool name       08/26  Tool name    08/26  Tool name  │
│ Patterns — SVG MP4     Effects — MP4       Shaders — GLSL    │
│ ┌──────────────┐       ┌──────────────┐    ┌──────────────┐  │
│ │   preview    │       │   preview    │    │   preview    │  │
│ └──────────────┘       └──────────────┘    └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

The metadata line above each preview does real work — date, category, available exports — rather than decorating. Keep the reference's clock; drop the location.

**Signature element:** every preview on the index is generated by the tool it represents, through the real export pipeline. Nothing on the page is hand-made artwork. Hovering a cell plays the tool's actual animated output.

**Motion:** a short stagger on grid rows at load, hover-to-play previews, nothing else. Respect `prefers-reduced-motion` — posters stay static, no stagger.

**Copy:** plain verbs, sentence case, no marketing register. Controls say what happens: `Export`, not `Generate output`. Empty states give a direction, not a status.

---

## 5. Harness tools

Three disposable tools, one per engine, that exist to prove the platform works with no real tools written:

- `_harness-svg` — uses every param type at least once, produces animatable vector output
- `_harness-canvas` — animated, exercises loop wrapping and 4× export
- `_harness-webgl` — a minimal Three.js scene, exercises the separate export renderer

They are excluded from the registry and the index, and they double as CI fixtures for the determinism test. They stay in the repo permanently as regression cover.

---

## 6. Phases

### Phase 1 — Shell and design system

**Goal:** the site exists and looks right, with nothing behind it.

> Build the app shell for an open-source repository of browser-based design tools. Next.js App Router, TypeScript strict, Tailwind with CSS custom properties for all tokens, static export target. Implement the design tokens, type scale, header, index page layout, and a placeholder tool page route at `/tools/[slug]`. Read the design direction section of BUILD_BRIEF.md and follow the palette and layout exactly — near-black, flat, hairline rules, no border radius, no accent color, Geist Sans and Geist Mono. The index reads from a stub registry with fake entries for now. No tools, no controls, no export. Responsive down to mobile, visible keyboard focus, `prefers-reduced-motion` respected.

**Acceptance:** index renders the reference layout at desktop and mobile; tokens live in one file; tool route renders a shell with a left rail, stage, and bottom bar; Lighthouse accessibility ≥95; zero client JS on the index beyond the clock.

---

### Phase 2 — Schema and control kit

**Goal:** the machinery that turns a param schema into a working interface.

> Implement `packages/schema` and `packages/kit` per TOOL_SPEC.md sections 3, 4 and 8. Build `defineTool`, all param types in the table, the URL codec (compact keys, base64, round-trips exactly), seeded RNG in `packages/core`, preset handling, undo/redo, randomize, and reset. Build every control component listed, plus the Stage (resize, DPR, pan/zoom, aspect frames, transparent checkerboard) and the global keyboard shortcuts. Then build `tools/_harness-svg` — a disposable tool that uses every single param type — to prove the kit. Enforce the layer boundary with an ESLint `no-restricted-imports` rule scoped to `tools/**`. No export pipeline yet.

**Acceptance:** the harness tool's controls are entirely generated from its schema; changing any param updates the URL; hard-reloading a copied URL reproduces the exact state; undo/redo works across all types; the lint rule fails if `render.ts` imports React.

---

### Phase 3 — Export pipeline

**Goal:** real files come out, frame-accurate.

> Implement `packages/export` per TOOL_SPEC.md sections 5, 6 and 7. PNG at 1×/2×/4× with true transparency; MP4 via WebCodecs `VideoEncoder` (`avc1.4D402A`, prefer-hardware, keyframe every 2s) into mp4-muxer, stepping frames deterministically as `t = i / frameCount` and flushing the encoder before muxing — never `MediaRecorder`, never realtime capture; GIF via gifenc; static SVG via SVGO; animated SVG as CSS keyframes embedded in a style block so it animates inside an `img` tag. Feature-detect `window.VideoEncoder` at mount and hide MP4 entirely when absent. Build the export sheet with format, size, aspect, duration, fps, progress and cancel. Add `tools/_harness-canvas` and `tools/_harness-webgl` to prove canvas2d and WebGL paths, including a separate offscreen renderer with `preserveDrawingBuffer` for WebGL export.

**Acceptance:** a 10s 60fps MP4 exports with no dropped or torn frames and no visible seam at the loop point; the same export run twice produces identical files; PNG at 4× is geometrically correct; animated SVG animates in an `img` tag; MP4 is absent rather than broken in Firefox.

---

### Phase 4 — Eject to standalone HTML

**Goal:** the hybrid promise, delivered as a user-facing export.

> Implement `packages/eject`: a vanilla DOM shell, roughly 300 lines, that builds controls from a param schema with no framework — the same schema the React kit consumes, so the two never drift. Then implement HTML export: bundle a tool's `render.ts`, `tool.ts`, the vanilla shell, and the current params as defaults into one self-contained file that opens from the filesystem and works offline. WebGL tools reference Three.js through an import map pointing at a CDN ESM build rather than inlining it. Add "Download standalone HTML" to every tool's export sheet.

**Acceptance:** all three harness tools eject; each ejected file opens offline by double-clicking, shows working controls, and renders identically to the site; the ejected file is readable source, not minified soup.

---

### Phase 5 — The index at scale

**Goal:** the home page still works at 100 tools.

> Build the registry generator that scans `/tools` and emits `registry.generated.ts`, excluding underscore-prefixed folders. Build `scripts/build-previews.ts`, which runs each tool headless through the real export pipeline to produce `poster.png` (1600×1200) and `preview.mp4` (3s loop, ≤600KB) — no hand-made thumbnails anywhere. Implement the index grid with posters that swap to looping muted video on hover, lazy-loaded via IntersectionObserver with at most four playing at once and everything offscreen paused. Add category and output-format filtering that filters in place, and ⌘K search across tool names, categories and taglines. Generate a per-tool OG image from the poster. Verify with the registry padded to 100 synthetic entries.

**Acceptance:** index remains smooth at 100 entries on a mid-range laptop; index JS stays under 120KB gzipped; no Three.js in the index bundle; filtering and ⌘K work by keyboard alone; previews respect reduced-motion.

---

### Phase 6 — Hardening and contributor path

**Goal:** other people — and future agents — can add tools without supervision.

> Build `scripts/new-tool.ts`, a scaffolder that stamps a tool folder from a template. Build `pnpm test:tools`: load every registered tool, render twice at `t=0` and `t=0.5` with a fixed seed, hash the pixel buffers, and fail on any mismatch — this catches hidden `Math.random()` or `Date.now()` in a render function, which is the main way a tool ships silently broken. Wire CI to run lint (including the layer rule), the determinism test, and a bundle-size budget. Write README and CONTRIBUTING, both pointing at TOOL_SPEC.md as the authority. Add the Info page.

**Acceptance:** `pnpm new-tool test-thing` produces a folder that builds and appears on the index; the determinism test fails when a `Math.random()` is deliberately introduced; CI green on a clean checkout.

---

## 7. After phase 6

The platform is done and proven, and the tool list can be tackled independently. From that point, adding a tool is: run the scaffolder, write a param schema, write a render function, run the checklist in TOOL_SPEC.md §10. Each tool is self-contained enough that they can be built in any order, in parallel, or by different people.

---

## 8. Open items

- Project name, wordmark, and domain
- Confirm Geist Sans / Geist Mono, or supply licensed faces
- Confirm the category list: currently Patterns, Shapes, Effects, Shaders, Type, Image
- Whether the index shows an "added" date column, as in the reference, or a sequential index number
- Analytics: none, or something privacy-light
