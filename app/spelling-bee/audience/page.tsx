import type { Metadata } from 'next'
import { AudienceWindow } from '../_components/AudienceWindow'

export const metadata: Metadata = { title: 'Spelling Bee — Audience' }

export default function SpellingBeeAudiencePage() {
  return <AudienceWindow />
}
