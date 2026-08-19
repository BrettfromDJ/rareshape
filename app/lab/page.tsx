import type { Metadata } from 'next'
import { Lab } from './Lab'

/**
 * The headless driver's entry point. `scripts/build-previews.ts` and
 * `pnpm test:tools` both load this page and call the *real* export pipeline
 * through it, so nothing about export is reimplemented for Node.
 *
 * Not linked from anywhere, and excluded from search engines.
 */
export const metadata: Metadata = {
  title: 'Lab',
  robots: { index: false, follow: false },
}

export default function LabPage() {
  return <Lab />
}
