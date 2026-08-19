/**
 * Tool metadata. This is the half of a tool definition that the index needs:
 * it is pure data with no render code behind it, so the home page can list a
 * hundred tools without pulling a single renderer (or Three.js) into its bundle.
 */

export const CATEGORIES = ['Patterns', 'Shapes', 'Effects', 'Shaders', 'Type', 'Image'] as const
export type Category = (typeof CATEGORIES)[number]

export const OUTPUTS = ['PNG', 'SVG', 'GIF', 'MP4', 'HTML'] as const
export type Output = (typeof OUTPUTS)[number]

export type Engine = 'svg' | 'canvas2d' | 'webgl'

export interface ToolMeta {
  /** URL slug. Always the folder name under /tools. */
  slug: string
  name: string
  /** One line, sentence case, no marketing register. */
  tagline: string
  category: Category
  engine: Engine
  /** Formats this tool can produce, in the order they are shown. */
  outputs: readonly Output[]
  /** ISO date the tool was added. Rendered as MM/DD on the index. */
  added: string
  /** Whether the tool animates. Static tools skip MP4/GIF and the timeline. */
  animated: boolean
  /** Length of one loop, in seconds. Ignored when `animated` is false. */
  duration: number
  fps: number
  /** Default stage aspect, `w:h`. */
  aspect: string
  /** Extra search terms for ⌘K. */
  keywords?: readonly string[]
}

/** Shape of the generated loader map. Kept here so registry.generated.ts stays typed. */
export interface ToolModuleLoaders {
  [slug: string]: {
    tool: () => Promise<unknown>
    render: () => Promise<unknown>
  }
}
