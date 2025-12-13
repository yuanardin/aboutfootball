'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { newsArticles } from '@/lib/data';
import { getImageById } from '@/lib/utils';
import { ArrowRight, Search } from 'lucide-react';

export default function Home() {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredArticles = newsArticles.filter((article) =>
    article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    article.excerpt.toLowerCase().includes(searchTerm.toLowerCase()) ||
    article.source.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

      <section className="mb-8 max-w-lg mx-auto">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search for news articles..."
            className="w-full glass-input pl-10 text-base"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredArticles.map((article) => {
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
