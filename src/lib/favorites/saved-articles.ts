import type { Firestore } from 'firebase/firestore';
import { arrayRemove, arrayUnion, doc, getDoc, setDoc } from 'firebase/firestore';
import type { NewsArticle } from '@/lib/types';

export { getFirestoreErrorMessage } from '@/lib/favorites/favorite-team';

// Saved articles live as an array field inside the user's own document so access is
// already scoped by the owner-only rules on users/{uid}:
//   users/{uid}.savedArticles = SavedArticle[]
export type SavedArticle = {
  id: string;
  title: string;
  excerpt: string;
  source: string;
  date: string;
  readTime: string;
  imageId: string;
  imageUrl: string | null;
  articleUrl: string | null;
  publishedAt?: string;
  savedAt: string;
};

function userDoc(firestore: Firestore, uid: string) {
  return doc(firestore, 'users', uid);
}

// Builds the Firestore-safe snapshot from the live article. Called identically from the
// save and unsave paths so arrayRemove() always matches the exact stored copy.
export function toSavedArticle(article: NewsArticle): SavedArticle {
  return {
    id: article.id,
    title: article.title,
    excerpt: article.excerpt,
    source: article.source,
    date: article.date,
    readTime: article.readTime ?? '4 min read',
    imageId: article.imageId ?? 'news-1',
    imageUrl: article.imageUrl ?? null,
    articleUrl: article.articleUrl ?? null,
    publishedAt: article.publishedAt,
    savedAt: new Date().toISOString(),
  };
}

export async function getSavedArticles(
  firestore: Firestore,
  uid: string
): Promise<SavedArticle[]> {
  const snapshot = await getDoc(userDoc(firestore, uid));
  if (!snapshot.exists()) return [];

  const raw = (snapshot.data() as { savedArticles?: unknown }).savedArticles;
  if (!Array.isArray(raw)) return [];

  const articles: SavedArticle[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    if (typeof record.id !== 'string' || !record.id) continue;
    articles.push({
      id: record.id,
      title: typeof record.title === 'string' && record.title ? record.title : 'Untitled story',
      excerpt: typeof record.excerpt === 'string' ? record.excerpt : '',
      source: typeof record.source === 'string' ? record.source : 'Live source',
      date: typeof record.date === 'string' ? record.date : 'Recently',
      readTime: typeof record.readTime === 'string' ? record.readTime : '4 min read',
      imageId: typeof record.imageId === 'string' ? record.imageId : 'news-1',
      imageUrl: typeof record.imageUrl === 'string' ? record.imageUrl : null,
      articleUrl: typeof record.articleUrl === 'string' ? record.articleUrl : null,
      publishedAt: typeof record.publishedAt === 'string' ? record.publishedAt : undefined,
      savedAt: typeof record.savedAt === 'string' ? record.savedAt : new Date().toISOString(),
    });
  }

  return articles.sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt));
}

export async function saveArticle(
  firestore: Firestore,
  uid: string,
  article: NewsArticle
): Promise<SavedArticle> {
  const saved = toSavedArticle(article);
  // merge:true + arrayUnion() keeps favoriteTeam and any other user data intact and is
  // idempotent — saving the same story twice stores it only once.
  await setDoc(userDoc(firestore, uid), { savedArticles: arrayUnion(saved) }, { merge: true });
  return saved;
}

export async function unsaveArticle(
  firestore: Firestore,
  uid: string,
  article: SavedArticle
): Promise<void> {
  // arrayRemove() removes the first exact match by id across the whole array union merge.
  await setDoc(userDoc(firestore, uid), { savedArticles: arrayRemove(article) }, { merge: true });
}