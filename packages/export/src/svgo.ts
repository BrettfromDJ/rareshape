/**
 * SVGO, loaded lazily from its browser build. It is a large dependency and only
 * vector exports need it, so it stays out of every other path.
 * If it cannot be loaded the raw markup is returned rather than failing the
 * export — an unoptimised SVG is still a correct SVG.
 */
let optimizer: ((markup: string) => string) | null = null

async function load(): Promise<((markup: string) => string) | null> {
  if (optimizer) return optimizer
  try {
    const svgo = (await import('svgo/browser')) as {
      optimize: (input: string, options?: unknown) => { data: string }
    }
    optimizer = (markup: string) =>
      svgo.optimize(markup, {
        multipass: true,
        floatPrecision: 3,
        plugins: [
          {
            name: 'preset-default',
            params: {
              overrides: {
                // Ids and structure carry meaning in animated output.
                cleanupIds: false,
                collapseGroups: false,
                removeHiddenElems: false,
                removeUselessDefs: false,
              },
            },
          },
        ],
      }).data
    return optimizer
  } catch {
    return null
  }
}

export async function optimizeSvg(markup: string): Promise<string> {
  const optimize = await load()
  if (!optimize) return markup
  try {
    return optimize(markup)
  } catch {
    return markup
  }
}
