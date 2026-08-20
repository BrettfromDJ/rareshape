import type { Category, Engine, Output, ToolMeta } from './meta'
import type { ParamSchema, ParamsOf } from './params'
import { cloneValue } from './params'
import { urlKeys } from './url'

export interface ToolInput<S extends ParamSchema> {
  slug: string
  name: string
  tagline: string
  category: Category
  engine: Engine
  outputs: readonly Output[]
  /** ISO date, YYYY-MM-DD. */
  added: string
  animated?: boolean
  /** Seconds for one loop. */
  duration?: number
  fps?: number
  aspect?: string
  keywords?: readonly string[]
  params: S
}

export interface Tool<S extends ParamSchema = ParamSchema> {
  meta: ToolMeta
  params: S
  defaults: ParamsOf<S>
  /** name -> compact URL key. */
  keys: Record<string, string>
}

/** The one way a tool is declared. See TOOL_SPEC.md §4. */
export function defineTool<const S extends ParamSchema>(input: ToolInput<S>): Tool<S> {
  const meta: ToolMeta = {
    slug: input.slug,
    name: input.name,
    tagline: input.tagline,
    category: input.category,
    engine: input.engine,
    outputs: input.outputs,
    added: input.added,
    animated: input.animated ?? false,
    duration: input.duration ?? 4,
    fps: input.fps ?? 60,
    aspect: input.aspect ?? '1:1',
    ...(input.keywords ? { keywords: input.keywords } : {}),
  }

  const defaults = Object.fromEntries(
    Object.entries(input.params).map(([name, def]) => [name, cloneValue(def.default)]),
  ) as ParamsOf<S>

  return {
    meta,
    params: input.params,
    defaults,
    keys: urlKeys(input.params),
  }
}

/** `type Params = ToolParams<typeof tool>` */
export type ToolParams<T> = T extends Tool<infer S> ? ParamsOf<S> : never
