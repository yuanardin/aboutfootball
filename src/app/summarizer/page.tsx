import type { Metadata } from 'next';
import { SummarizerForm } from './summarizer-form';
import { Check } from 'lucide-react';

export const metadata: Metadata = {
  title: 'AI News Summarizer',
  description:
    'Turn long football articles into concise, useful takeaways in seconds with ScoreCast AI.',
};

export default function SummarizerPage() {
  return (
    <div className="page-shell max-w-5xl py-10 sm:py-14">
      <section className="max-w-2xl">
        <p className="eyebrow mb-3">ScoreCast AI</p>
        <h1 className="text-page-title">Get the point, faster.</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
          Paste a football article URL and let ScoreCast AI turn it into a concise, readable summary.
        </p>
      </section>

      <div className="mt-10 grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="card-surface p-5 sm:p-6" aria-label="What you get">
          <p className="eyebrow mb-4">You&apos;ll get</p>
          <ul className="space-y-3">
            <li className="flex items-start gap-2.5 text-sm leading-6 text-foreground/90">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              A short, readable summary of the main points of the story.
            </li>
            <li className="flex items-start gap-2.5 text-sm leading-6 text-foreground/90">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              A few key takeaways as bullets, when the model can read the article content.
            </li>
            <li className="flex items-start gap-2.5 text-sm leading-6 text-foreground/90">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              One-click copy of the full result to use anywhere.
            </li>
          </ul>
          <p className="mt-5 border-t border-border pt-4 text-sm leading-6 text-muted-foreground">
            ScoreCast AI works best with public, readable football articles. If the article is
            paywalled or unreachable, the result will explain that instead of guessing.
          </p>
        </aside>

        <div>
          <SummarizerForm />
        </div>
      </div>
    </div>
  );
}
