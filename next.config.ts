import type { NextConfig } from 'next'

const config: NextConfig = {
  output: 'export',
  reactStrictMode: true,
  images: { unoptimized: true },
  transpilePackages: [
    '@rareshape/core',
    '@rareshape/schema',
    '@rareshape/kit',
    '@rareshape/export',
    '@rareshape/eject',
  ],
  typescript: { ignoreBuildErrors: false },
}

export default config
