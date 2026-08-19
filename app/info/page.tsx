import type { Metadata } from 'next'
import { Header } from '../_components/Header'
import { SITE } from '@/lib/site'

export const metadata: Metadata = { title: 'Info' }

export default function InfoPage() {
  return (
    <>
      <Header current="Info" />
      <div className="px-[var(--gutter)] py-12 max-w-[64ch] space-y-6">
        <h1 className="hero">{SITE.name}</h1>
        <p className="text-[var(--dim)]">{SITE.description}</p>
      </div>
    </>
  )
}
