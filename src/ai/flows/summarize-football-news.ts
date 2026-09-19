'use server';
/**
 * @fileOverview This file defines a Genkit flow for summarizing football news articles.
 *
 * - summarizeFootballNews - A function that takes a news article URL and returns a concise summary.
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

export async function summarizeFootballNews(input: SummarizeFootballNewsInput): Promise<SummarizeFootballNewsOutput> {
  return summarizeFootballNewsFlow(input);
}

const summarizeNewsArticlePrompt = ai.definePrompt({
  name: 'summarizeNewsArticlePrompt',
  input: {schema: SummarizeFootballNewsInputSchema},
  output: {schema: SummarizeFootballNewsOutputSchema},
  prompt: `You are an expert sports journalist specializing in summarizing football news articles. Your goal is to provide a concise and informative summary that captures the main points of the article.

Article URL: {{{articleUrl}}}

From the article content, return:
- "title": the article's headline, copied verbatim when it is visible in the content; otherwise an empty string.
- "summary": the main points of the article in 3 to 5 concise sentences, written for a football fan.
- "keyTakeaways": up to 3 short bullet-style takeaways as separate strings. Return an empty list when the article content is not accessible.

If the article content cannot be read at all (for example the page is paywalled, removed, or unreachable), set "summary" to a short note explaining that the article could not be read, leave "title" empty, and return an empty list for "keyTakeaways".`,
});

const summarizeFootballNewsFlow = ai.defineFlow(
  {
    name: 'summarizeFootballNewsFlow',
    inputSchema: SummarizeFootballNewsInputSchema,
    outputSchema: SummarizeFootballNewsOutputSchema,
  },
  async input => {
    const {output} = await summarizeNewsArticlePrompt(input);
    return output!;
  }
);
