import type {NextConfig} from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  /* config options here */
  outputFileTracingRoot: path.join(__dirname),
  // The dev server (`npm run dev`) sets NEXT_DIST_DIR=.next-dev so that
  // `next dev` and `next build`/`next start` never share one output directory.
  // Sharing `.next` lets a production build overwrite the manifests and chunks
  // the running dev server serves, which surfaces as ChunkLoadError, 404s on
  // /_next/static/*, `Cannot find module './<n>.js'` and `/favicon.ico` 500s.
  // Production (build/start/App Hosting) keeps the default `.next`.
  // Type and lint checks are no longer hidden from the build. They are also
  // run explicitly via `npm run typecheck` and `npm run lint` (ESLint CLI), so
  // a broken build fails instead of silently shipping. Keep distDir as-is.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  // Explicit image host allowlist. There is deliberately NO `**` wildcard:
  // an arbitrary-host entry turns /_next/image into an open image proxy and
  // widens the blast radius of Next.js image-optimizer advisories. News images
  // are rendered by `NewsImage` as direct <img> elements (see
  // src/components/news/news-image.tsx), so provider URLs on other hosts keep
  // working without going through the optimizer.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.newsapi.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'crests.football-data.org',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
