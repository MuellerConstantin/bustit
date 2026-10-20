import path from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const isStandalone = process.env.NEXT_OUTPUT_MODE === 'standalone';
const monorepoRoot = path.join(import.meta.dirname, '..', '..');

const nextConfig: NextConfig = {
  output: isStandalone ? 'standalone' : undefined,
  // Workspace packages live outside this directory; without pointing tracing
  // at the monorepo root, the standalone output misses them.
  outputFileTracingRoot: monorepoRoot,
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    authInterrupts: true,
  },
  turbopack: {
    root: monorepoRoot,
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
