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
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
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
        hostname: '**',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'static.dw.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.vanguardngr.com',
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
