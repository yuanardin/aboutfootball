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
  summary: z.string().describe('A concise summary of the football news article.'),
});
export type SummarizeFootballNewsOutput = z.infer<typeof SummarizeFootballNewsOutputSchema>;

export async function summarizeFootballNews(input: SummarizeFootballNewsInput): Promise<SummarizeFootballNewsOutput> {
  return summarizeFootballNewsFlow(input);
}

const summarizeNewsArticlePrompt = ai.definePrompt({
  name: 'summarizeNewsArticlePrompt',
  input: {schema: SummarizeFootballNewsInputSchema},
  output: {schema: SummarizeFootballNewsOutputSchema},
  prompt: `You are an expert sports journalist specializing in summarizing football news articles.  Your goal is to provide a concise and informative summary that captures the main points of the article.

Article URL: {{{articleUrl}}}

Summary:`,
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
