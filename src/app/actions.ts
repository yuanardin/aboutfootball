'use server';

import { summarizeFootballNews } from '@/ai/flows/summarize-football-news';
import { z } from 'zod';
import { ZodError } from 'zod';

const schema = z.object({
  articleUrl: z.string().url({ message: 'Please enter a valid URL.' }),
});

export interface FormState {
  message: string;
  summary?: string;
  title?: string;
  keyTakeaways?: string[];
  fieldErrors?: Record<string, string[] | undefined>;
}

export async function handleSummarize(prevState: FormState, formData: FormData): Promise<FormState> {
  const data = {
    articleUrl: formData.get('articleUrl'),
  };

  try {
    const validatedData = schema.parse(data);

    try {
      const result = await summarizeFootballNews({ articleUrl: validatedData.articleUrl });
      return {
        message: 'Success',
        summary: result.summary,
        title: result.title ?? '',
        keyTakeaways: result.keyTakeaways ?? [],
      };
    } catch (error) {
      console.error(error);
      return { message: "An error occurred while summarizing the article. The AI model might be unavailable." };
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        message: 'Invalid input.',
        fieldErrors: error.flatten().fieldErrors,
      };
    }
    return { message: 'An unexpected error occurred.' };
  }
}
