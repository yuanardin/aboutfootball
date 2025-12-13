import Image from 'next/image';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { newsArticles } from '@/lib/data';
import { getImageById } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8">
      <section className="text-center mb-12">
        <h1 className="font-headline text-5xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
          The Latest Kick-off
        </h1>
        <p className="text-lg text-muted-foreground mt-4 max-w-2xl mx-auto font-body">
          Your daily roundup of the biggest stories from the world of football.
          Stay ahead of the game with ScoreCast.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {newsArticles.map((article) => {
          const image = getImageById(article.imageId);
          return (
            <Card
              key={article.id}
              className="flex flex-col overflow-hidden glass-card transform hover:-translate-y-2 transition-transform duration-300"
            >
              <CardHeader className="p-0">
                <div className="relative h-48 w-full">
                  {image && (
                    <Image
                      src={image.imageUrl}
                      alt={image.description}
                      fill
                      className="object-cover"
                      data-ai-hint={image.imageHint}
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-grow p-6">
                <Badge variant="secondary" className="mb-2">{article.source}</Badge>
                <CardTitle className="font-headline text-xl leading-tight mb-2">
                  {article.title}
                </CardTitle>
                <p className="text-muted-foreground font-body text-sm">
                  {article.excerpt}
                </p>
              </CardContent>
              <CardFooter className="p-6 pt-0 flex justify-between items-center">
                <p className="text-xs text-muted-foreground">{article.date}</p>
                <Link
                  href="#"
                  className="flex items-center text-sm text-primary hover:text-accent transition-colors font-semibold"
                >
                  Read More <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </CardFooter>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
