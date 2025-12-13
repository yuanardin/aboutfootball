'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { handleSummarize, type FormState } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, ThumbsUp } from 'lucide-react';

const initialState: FormState = {
  message: '',
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Bot className="mr-2 h-4 w-4 animate-spin" />
          Analyzing...
        </>
      ) : (
        'Summarize Article'
      )}
    </Button>
  );
}

export function SummarizerForm() {
  const [state, formAction] = useFormState(handleSummarize, initialState);

  return (
    <div>
      <Card className="glass-card">
        <form action={formAction}>
          <CardHeader>
            <CardTitle className="font-headline">Enter Article URL</CardTitle>
            <CardDescription>
              Paste the full URL of the news article you want to summarize.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="articleUrl" className="sr-only">Article URL</Label>
              <Input
                id="articleUrl"
                name="articleUrl"
                type="url"
                placeholder="https://www.example.com/football-news/..."
                required
                className="glass-input text-base"
              />
              {state.fieldErrors?.articleUrl && (
                 <p className="text-sm text-destructive mt-1">
                   {state.fieldErrors.articleUrl[0]}
                 </p>
               )}
            </div>
          </CardContent>
          <CardFooter>
            <SubmitButton />
          </CardFooter>
        </form>
      </Card>

      {state.message && state.message !== 'Success' && (
        <Card className="mt-6 border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive font-headline">Error</CardTitle>
            <CardDescription className="text-destructive/80">
              {state.message}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {state.summary && (
        <Card className="mt-6 glass-card">
          <CardHeader>
             <div className="flex items-center gap-2 text-primary">
                <ThumbsUp className="h-5 w-5"/>
                <CardTitle className="font-headline text-primary">Summary Complete</CardTitle>
            </div>
            <CardDescription>
              Here are the key points from the article:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-body whitespace-pre-line leading-relaxed">
              {state.summary}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
