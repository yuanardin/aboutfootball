'use server';
/**
 * @fileOverview This file defines a Genkit flow for summarizing football news articles.
 *
 * - summarizeFootballNews - A function that takes a news article URL, fetches the article
 *   content server-side, and returns a concise summary produced by the AI model.
 * - SummarizeFootballNewsInput - The input type for the summarizeFootballNews function.
 * - SummarizeFootballNewsOutput - The return type for the summarizeFootballNews function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeFootballNewsInputSchema = z.object({
  articleUrl: z.string().url().describe('The URL of the football news article to summarize.'),
});
export type SummarizeFootballNewsInput = z.infer<typeof SummarizeFootballNewsInputSchema>;

const SummarizeFootballNewsOutputSchema = z.object({
  title: z
    .string()
    .optional()
    .describe('The article headline copied verbatim from the content, or an empty string if not visible.'),
  summary: z.string().describe('A concise summary of the main points of the football news article.'),
  keyTakeaways: z
    .array(z.string())
    .optional()
    .describe('Up to 3 short bullet-style takeaways as strings. Empty array when the article content is not accessible.'),
});
export type SummarizeFootballNewsOutput = z.infer<typeof SummarizeFootballNewsOutputSchema>;

/**
 * Fetches the article page and reduces the HTML to plain, readable text so the model
 * can summarize an arbitrary live article instead of guessing from a bare URL.
 */
async function fetchArticleContent(articleUrl: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(articleUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; ScoreCastNewsBot/1.0; +https://scorecast.app)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
      cache: 'no-store',
    });

    if (!response.ok) {
      return '';
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return '';
    }

    const html = await response.text();
    return extractReadableText(html);
  } catch {
    return '';
  } finally {
    clearTimeout(timeout);
  }
}

function extractReadableText(html: string): string {
  const removed = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|nav|header|footer|aside|form|button)[^>]*>[\s\S]*?<\/\1>/gi, ' ');

  const withoutTags = removed
    // Turn block elements into line breaks so paragraphs survive tag stripping.
    .replace(/(<\/?(p|div|li|h[1-6]|section|article|blockquote|tr)>)/gi, '\n$1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  return decodeEntities(withoutTags)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
    .slice(0, 20000);
}

function decodeEntities(text: string): string {
  const entities: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&ndash;': '–',
    '&mdash;': '—',
    '&hellip;': '…',
  };
  return text.replace(/&[a-z]+;|&#\d+;/gi, match => entities[match.toLowerCase()] ?? match);
}

const SummarizeFootballNewsPromptSchema = z.object({
  articleUrl: z.string().url().describe('The URL of the football news article to summarize.'),
  articleContent: z
    .string()
    .describe('The plain-text content of the article, or an empty string when it could not be fetched.'),
});
type SummarizeFootballNewsPromptInput = z.infer<typeof SummarizeFootballNewsPromptSchema>;

export async function summarizeFootballNews(input: SummarizeFootballNewsInput): Promise<SummarizeFootballNewsOutput> {
  return summarizeFootballNewsFlow(input);
}

const summarizeNewsArticlePrompt = ai.definePrompt({
  name: 'summarizeNewsArticlePrompt',
  input: {schema: SummarizeFootballNewsPromptSchema},
  output: {schema: SummarizeFootballNewsOutputSchema},
  prompt: `You are an expert sports journalist specializing in summarizing football news articles. Your goal is to provide a concise and informative summary that captures the main points of the article.

Article URL: {{{articleUrl}}}

Article content:
{{{articleContent}}}
---
Analyze ONLY the article content above strands. From it, return:
- "title": the article's headline, copied verbatim when it is visible in the content; otherwise an empty string.
- "summary": the main points of the article in 3 to 5 concise sentences, written for a football fan.
- "keyTakeaways": up to 3 short bullet-style takeaways as separate strings. Return an empty list when the article content is not accessible.

If the article content is empty or not readable (for example the page is paywalled, removed, or unreachable), set "summary" to a short note explaining that the article could not be read, leave "title" empty, and return an empty list for "keyTakeaways".`,
});

const summarizeFootballNewsFlow = ai.defineFlow(
  {
    name: 'summarizeFootballNewsFlow',
    inputSchema: SummarizeFootballNewsInputSchema,
    outputSchema: SummarizeFootballNewsOutputSchema,
  },
  async input => {
    const articleContent = await fetchArticleContent(input.articleUrl);
    const {output} = await summarizeNewsArticlePrompt({
      articleUrl: input.articleUrl,
      articleContent,
    });
    return output!;
  }
);
