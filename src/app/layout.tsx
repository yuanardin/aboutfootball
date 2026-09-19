import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase/client-provider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-grotesk',
  display: 'swap',
});

// Firebase authentication is initialized in the client with environment variables.
// Rendering routes dynamically prevents a credential-less build from evaluating Auth.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  ),
  title: {
    default: 'ScoreCast | Football at a glance',
    template: '%s | ScoreCast',
  },
  description:
    'Football news, match results, standings and AI-powered insights in one place.',
  keywords: [
    'football',
    'soccer',
    'match results',
    'standings',
    'fixtures',
    'football news',
    'AI summarizer',
  ],
  openGraph: {
    type: 'website',
    siteName: 'ScoreCast',
    title: 'ScoreCast | Football at a glance',
    description:
      'Football news, match results, standings and AI-powered insights in one place.',
  },
  twitter: {
    card: 'summary',
    title: 'ScoreCast | Football at a glance',
    description:
      'Football news, match results, standings and AI-powered insights in one place.',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} font-body bg-background text-foreground antialiased`}
      >
        <FirebaseClientProvider>
          <div className="relative flex min-h-screen flex-col">
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-primary-foreground"
            >
              Skip to content
            </a>
            <Header />
            <main id="main-content" className="flex-1">
              {children}
            </main>
            <Footer />
          </div>
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
