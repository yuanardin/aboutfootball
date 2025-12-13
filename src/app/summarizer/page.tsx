import { SummarizerForm } from './summarizer-form';

export default function SummarizerPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <section className="text-center mb-12">
        <h1 className="font-headline text-5xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
          AI News Summarizer
        </h1>
        <p className="text-lg text-muted-foreground mt-4 max-w-2xl mx-auto font-body">
          Too much news, too little time? Paste any football article URL below and
          let our AI give you the key takeaways in seconds.
        </p>
      </section>

      <SummarizerForm />
    </div>
  );
}
