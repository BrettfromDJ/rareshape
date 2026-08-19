import type { Frame, GlRenderer, SvgFrame } from '@rareshape/core'
import type { ParamSchema, ParamsOf } from './params'
import type { Tool } from './define'

export interface Canvas2dModule<P> {
  render(ctx: CanvasRenderingContext2D, frame: Frame<P>): void
}
export interface SvgModule<P> {
  render(frame: Frame<P>): SvgFrame
}
export interface WebglModule<P> {
  create(canvas: HTMLCanvasElement | OffscreenCanvas): GlRenderer<P>
}

export type RenderModule<P = Record<string, unknown>> =
  | Canvas2dModule<P>
  | SvgModule<P>
  | WebglModule<P>

export interface LoadedTool<S extends ParamSchema = ParamSchema> {
  tool: Tool<S>
  render: RenderModule<ParamsOf<S>>
}

export const isCanvas2d = <P,>(m: RenderModule<P>): m is Canvas2dModule<P> =>
  typeof (m as Canvas2dModule<P>).render === 'function' &&
  (m as Canvas2dModule<P>).render.length >= 2

export const isSvg = <P,>(m: RenderModule<P>): m is SvgModule<P> =>
  typeof (m as SvgModule<P>).render === 'function' && (m as SvgModule<P>).render.length <= 1

export const isWebgl = <P,>(m: RenderModule<P>): m is WebglModule<P> =>
  typeof (m as WebglModule<P>).create === 'function'
