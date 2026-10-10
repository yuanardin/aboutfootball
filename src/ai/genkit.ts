import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [googleAI()],
  // "gemini-flash-latest" alias always resolves to a supported Flash model.
  // A pinned version (e.g. gemini-3.6-flash) breaks the summarizer with
  // "model not found" as soon as Google retires that snapshot.
  model: 'googleai/gemini-flash-latest',
});
