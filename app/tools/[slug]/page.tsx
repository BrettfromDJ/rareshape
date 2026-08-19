import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Header } from '@/app/_components/Header'
import { allTools, toolBySlug } from '@/lib/registry'
import { ToolShell } from './ToolShell'

export function generateStaticParams() {
  return allTools.map((t) => ({ slug: t.slug }))
}

export const dynamicParams = false

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const tool = toolBySlug(slug)
  if (!tool) return {}
  return {
    title: tool.name,
    description: tool.tagline,
    openGraph: {
      title: tool.name,
      description: tool.tagline,
      images: [{ url: `/previews/${tool.slug}/og.png`, width: 1200, height: 630 }],
    },
  }
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tool = toolBySlug(slug)
  if (!tool) notFound()

  return (
    <div className="h-dvh flex flex-col">
      <Header current="Tools" />
      <ToolShell tool={tool} />
    </div>
  )
}
