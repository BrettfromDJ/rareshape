import type { Metadata } from 'next'
import { Bebas_Neue } from 'next/font/google'
import './bee.css'

const display = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bee-display',
  display: 'swap',
  fallback: ['Arial Narrow', 'Helvetica Neue', 'Impact', 'sans-serif'],
})

export const metadata: Metadata = {
  title: 'Spelling Bee',
  description: 'A team spelling bee for a room full of adults. Host it from a laptop, cast it to a TV.',
  robots: { index: false },
}

export const viewport = { themeColor: '#170f2f', colorScheme: 'dark' as const }

export default function BeeLayout({ children }: { children: React.ReactNode }) {
  return <div className={`bee ${display.variable}`}>{children}</div>
}
