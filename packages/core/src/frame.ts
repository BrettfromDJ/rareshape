import type { Rng } from './rng'

/**
 * What a render function receives. Everything it is allowed to know about the
 * world is in here — no clock, no DOM, no globals. See TOOL_SPEC.md §5.
 */
export interface Frame<P = Record<string, unknown>> {
  params: P
  /** 0..1 loop position. Always 0 for static tools. */
  t: number
  /** Logical pixels. Never assume a fixed size. */
  width: number
  height: number
  /** Device pixel ratio on screen, or the export scale factor. */
  dpr: number
  seed: number
  /** The only permitted source of randomness. */
  rng: Rng
}

/** What an `svg` tool returns: the contents of an <svg>, not the element. */
export interface SvgFrame {
  defs?: string
  body: string
  /** Optional background paint, used by PNG export and the stage. */
  background?: string
}

/** What a `webgl` tool's `create()` returns. */
export interface GlRenderer<P = Record<string, unknown>> {
  draw(frame: Frame<P>): void
  resize(width: number, height: number, dpr: number): void
  dispose(): void
}
