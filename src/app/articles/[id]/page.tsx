import { notFound, redirect } from 'next/navigation';
import { getNewsArticleById } from '@/lib/news/service';

type ArticlePageProps = { params: Promise<{ id: string }> };

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { id } = await params;
  const article = await getNewsArticleById(id);

  if (!article) {
    notFound();
  }

  // News comes from a live provider — send visitors to the original publication.
  if (!article.articleUrl) {
    notFound();
  }

  redirect(article.articleUrl);
}