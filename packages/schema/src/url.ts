/**
 * URL codec. State lives in the URL: `?p=<base64url(json)>`, non-defaults only,
 * under compact keys. A copied URL must hard-reload to the identical state, so
 * decoding is the exact inverse of encoding — no lossy rounding here, only the
 * quantisation the param itself already applied.
 */
import type { ParamDef, ParamSchema } from './params'
import { coerce, sameValue } from './params'

/**
 * Compact key for a param name: initials of its words, deduped.
 * `cellSize` -> `cs`, `count` -> `c`. Set `key` on the def to freeze one.
 */
export function urlKeys(schema: ParamSchema): Record<string, string> {
  const out: Record<string, string> = {}
  const taken = new Set<string>()

  for (const [name, def] of Object.entries(schema)) {
    if (def.key) {
      if (taken.has(def.key)) throw new Error(`duplicate url key "${def.key}" on "${name}"`)
      taken.add(def.key)
      out[name] = def.key
    }
  }

  for (const [name, def] of Object.entries(schema)) {
    if (def.key) continue
    const words = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[\s_-]+/).filter(Boolean)
    const initials = words.map((w) => (w[0] ?? '').toLowerCase()).join('')
    let candidate = initials || name.slice(0, 2).toLowerCase()
    let i = 2
    while (taken.has(candidate)) candidate = `${initials}${i++}`
    taken.add(candidate)
    out[name] = candidate
  }

  return out
}

function base64UrlEncode(input: string): string {
  const bytes = new TextEncoder().encode(input)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const b64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  if (typeof atob === 'function') {
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  }
  return Buffer.from(padded, 'base64').toString('utf8')
}

/** Value -> compact JSON-safe form. Booleans become 0/1, points become [x,y]. */
function encodeValue(def: ParamDef, value: unknown): unknown {
  switch (def.type) {
    case 'boolean':
      return value === true ? 1 : 0
    case 'point': {
      const pt = value as { x: number; y: number }
      return [pt.x, pt.y]
    }
    case 'color':
      return String(value).replace(/^#/, '')
    case 'palette':
      return (value as string[]).map((c) => c.replace(/^#/, ''))
    default:
      return value
  }
}

export function encodeParams(
  schema: ParamSchema,
  keys: Record<string, string>,
  defaults: Record<string, unknown>,
  params: Record<string, unknown>,
): string {
  const packed: Record<string, unknown> = {}
  for (const [name, def] of Object.entries(schema)) {
    const value = params[name]
    if (value === undefined || sameValue(value, defaults[name])) continue
    packed[keys[name] ?? name] = encodeValue(def, value)
  }
  return Object.keys(packed).length === 0 ? '' : base64UrlEncode(JSON.stringify(packed))
}

export function decodeParams(
  schema: ParamSchema,
  keys: Record<string, string>,
  defaults: Record<string, unknown>,
  encoded: string | null | undefined,
): Record<string, unknown> {
  const params: Record<string, unknown> = { ...defaults }
  if (!encoded) return params

  let packed: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(base64UrlDecode(encoded))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return params
    packed = parsed as Record<string, unknown>
  } catch {
    // A mangled URL falls back to defaults rather than an error screen.
    return params
  }

  for (const [name, def] of Object.entries(schema)) {
    const key = keys[name] ?? name
    if (!(key in packed)) continue
    params[name] = coerce(def, packed[key])
  }
  return params
}

/** The full shareable URL for a state. */
export function permalink(base: string, slug: string, encoded: string): string {
  const url = new URL(`/tools/${slug}`, base)
  if (encoded) url.searchParams.set('p', encoded)
  return url.toString()
}
