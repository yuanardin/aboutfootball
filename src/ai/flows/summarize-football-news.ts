'use server';
/**
 * @fileOverview This file defines a Genkit flow for summarizing football news articles.
 *
 * - summarizeFootballNews - A function that takes a news article URL, fetches the article
 *   content server-side through the SSRF-safe fetcher, and returns a concise summary
 *   produced by the AI model.
 * - SummarizeFootballNewsInput - The input type for the summarizeFootballNews function.
 * - SummarizeFootballNewsOutput - The return type for the summarizeFootballNews function.
 */

import {ai} from '@/ai/genkit';
import {runWithModelRetry} from '@/ai/summarizer-retry';
import {
  MAX_ARTICLE_CHARS,
  UnsafeArticleUrlError,
  createDefaultArticleFetcherDeps,
  fetchArticleText,
} from '@/lib/security/safe-article-fetch';
import {z} from 'genkit';

// Bounded so a caller cannot push an unbounded string through validation.
const MAX_ARTICLE_URL_LENGTH = 2_048;

const SummarizeFootballNewsInputSchema = z.object({
  articleUrl: z
    .string()
    .url()
    .max(MAX_ARTICLE_URL_LENGTH)
    .describe('The URL of the football news article to summarize.'),
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

// Deterministic, non-AI result for an article we could not read (paywalled,
// removed, unreachable, non-HTML, or oversized). Returning this without calling
// the model keeps the user-visible outcome identical to the old "model writes a
// note" path while removing a free Gemini-consumption vector for arbitrary URLs.
const UNREADABLE_ARTICLE_SUMMARY =
  'The article could not be read. It may be paywalled, removed, or unreachable.';

const SummarizeFootballNewsPromptSchema = z.object({
  articleUrl: z.string().url().describe('The URL of the football news article to summarize.'),
  articleContent: z
    .string()
    .describe('The plain-text content of the article, or an empty string when it could not be fetched.'),
});

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
- "keyTakeaways": up to 3 short bullet-style takeaways as separate strings. Return an empty list when the article content is not accessible.`,
});

const summarizeFootballNewsFlow = ai.defineFlow(
  {
    name: 'summarizeFootballNewsFlow',
    inputSchema: SummarizeFootballNewsInputSchema,
    outputSchema: SummarizeFootballNewsOutputSchema,
  },
  async input => {
    const outcome = await fetchArticleText(input.articleUrl, createDefaultArticleFetcherDeps());

    // Unsafe/invalid targets surface as a typed error the caller maps to a
    // friendly message. They never reach the model and are never retried.
    if (outcome.status === 'blocked') {
      throw new UnsafeArticleUrlError(outcome.reason);
    }

    // Nothing readable to summarize: skip the model entirely. No fallback ever
    // re-fetches the URL, so validation cannot be bypassed.
    if (outcome.status === 'unreadable') {
      return { title: '', summary: UNREADABLE_ARTICLE_SUMMARY, keyTakeaways: [] };
    }

    const articleContent = outcome.text.slice(0, MAX_ARTICLE_CHARS);
    // One bounded retry for transient 503/overload only — the SDK performs
    // no automatic retry, so this single app-level retry cannot duplicate.
    const {output} = await runWithModelRetry(() =>
      summarizeNewsArticlePrompt({
        articleUrl: input.articleUrl,
        articleContent,
      })
    );
    return output!;
  }
);
