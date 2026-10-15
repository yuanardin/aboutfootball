'use client';

import { useActionState, useEffect, useRef, useState, type FormEvent } from 'react';
import { useFormStatus } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { handleSummarize, type FormState } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Bot, Check, Copy, RotateCcw, Sparkles, TriangleAlert } from 'lucide-react';

const initialState: FormState = {
  message: '',
};

const URL_ERROR_ID = 'articleUrl-error';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Bot className="size-4 animate-spin" aria-hidden="true" />
          Summarizing...
        </>
      ) : (
        <>
          <Sparkles className="size-4" aria-hidden="true" />
          Summarize Article
        </>
      )}
    </Button>
  );
}

export function SummarizerForm() {
  const searchParams = useSearchParams();
  const [session, setSession] = useState(0);
  const [initialUrl, setInitialUrl] = useState(() => searchParams.get('url') ?? '');

  return (
    <FormSession
      key={session}
      initialUrl={initialUrl}
      onRestart={() => {
        setSession((count) => count + 1);
        setInitialUrl('');
      }}
      resetFocus={session > 0}
    />
  );
}

function FormSession({
  onRestart,
  initialUrl,
  resetFocus,
}: {
  onRestart: () => void;
  initialUrl?: string;
  resetFocus?: boolean;
}) {
  const [state, formAction] = useActionState(handleSummarize, initialState);
  const [clientError, setClientError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const { toast } = useToast();

  const serverError = state.fieldErrors?.articleUrl?.[0];
  const submittedRef = useRef(false);

  useEffect(() => {
    if (resetFocus) {
      inputRef.current?.focus();
    }
  }, [resetFocus]);

  useEffect(() => {
    if (serverError) {
      inputRef.current?.focus();
    }
  }, [serverError]);

  useEffect(() => {
    if (state.message === 'Success' && state.summary) {
      resultRef.current?.focus();
    }
  }, [state.message, state.summary]);

  useEffect(() => {
    if (state.message) {
      submittedRef.current = false;
    }
  }, [state.message]);

  function handleClientValidation(event: FormEvent<HTMLFormElement>) {
    if (submittedRef.current) {
      event.preventDefault();
      return;
    }

    const value = inputRef.current?.value.trim() ?? '';
    setClientError(null);

    if (!value) {
      event.preventDefault();
      setClientError('Please enter an article URL.');
      inputRef.current?.focus();
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      event.preventDefault();
      setClientError(
        'That does not look like a valid URL. Include http(s):// — for example https://www.example.com/...'
      );
      inputRef.current?.focus();
      return;
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      event.preventDefault();
      setClientError('Only http(s) URLs are supported.');
      inputRef.current?.focus();
      return;
    }

    submittedRef.current = true;
  }

  function copyResult() {
    const takeaways = state.keyTakeaways?.length
      ? `Key takeaways:\n${state.keyTakeaways.map((item) => `- ${item}`).join('\n')}`
      : '';
    const text = [state.title, state.summary, takeaways].filter(Boolean).join('\n\n');

    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast({ description: 'Summary copied to clipboard.' });
      })
      .catch(() => {
        toast({
          variant: 'destructive',
          title: 'Could not copy',
          description: 'Please copy the text manually.',
        });
      });
  }

  return (
    <div className="space-y-6">
      <Card className="card-surface">
        <FormBody
          formAction={formAction}
          onSubmit={handleClientValidation}
          inputRef={inputRef}
          hasError={Boolean(clientError || serverError)}
          errorMessage={clientError ?? serverError}
          initialUrl={initialUrl}
        />
      </Card>

      {!clientError &&
        !serverError &&
        state.message &&
        state.message !== 'Success' && (
          <Card className="border border-destructive/40 bg-destructive/5" role="alert">
            <CardHeader>
              <div className="flex items-center gap-2 text-destructive">
                <TriangleAlert className="h-5 w-5" aria-hidden="true" />
                <CardTitle className="font-headline">Could not summarize</CardTitle>
              </div>
              <CardDescription className="text-destructive/80">{state.message}</CardDescription>
            </CardHeader>
          </Card>
        )}

      {state.message === 'Success' && state.summary && (
        <section
          ref={resultRef}
          tabIndex={-1}
          aria-label="Summary result"
          className="card-surface rounded-xl border border-primary/30 bg-primary/[0.04] p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-6"
        >
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
            <h2 className="font-headline text-lg font-bold">Summary complete</h2>
          </div>

          {state.title && (
            <p className="mt-4 text-2xl font-bold leading-8 text-foreground">{state.title}</p>
          )}

          <p className="mt-4 break-words whitespace-pre-line text-base leading-7 text-foreground/90">
            {state.summary}
          </p>

          {state.keyTakeaways && state.keyTakeaways.length > 0 && (
            <div className="mt-6">
              <h3 className="font-headline text-base font-bold tracking-tight">Key takeaways</h3>
              <ul className="mt-3 space-y-2.5">
                {state.keyTakeaways.map((item, index) => (
                  <li
                    key={`takeaway-${index}-${item.slice(0, 24)}`}
                    className="flex items-start gap-2.5 text-sm leading-6 text-foreground/90"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button type="button" variant="outline" onClick={copyResult} className="sm:flex-1">
              <Copy className="size-4" aria-hidden="true" />
              Copy summary
            </Button>
            <Button type="button" onClick={onRestart} className="sm:flex-1">
              <RotateCcw className="size-4" aria-hidden="true" />
              Start another
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function FormBody({
  formAction,
  onSubmit,
  inputRef,
  hasError,
  errorMessage,
  initialUrl,
}: {
  formAction: (formData: FormData) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  hasError: boolean;
  errorMessage?: string;
  initialUrl?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} noValidate>
      <FormContent
        formRef={formRef}
        inputRef={inputRef}
        hasError={hasError}
        errorMessage={errorMessage}
        initialUrl={initialUrl}
      />
    </form>
  );
}

function FormContent({
  formRef,
  inputRef,
  hasError,
  errorMessage,
  initialUrl,
}: {
  formRef: React.RefObject<HTMLFormElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  hasError: boolean;
  errorMessage?: string;
  initialUrl?: string;
}) {
  const { pending } = useFormStatus();

  useEffect(() => {
    if (!formRef.current) return;
    if (pending) {
      formRef.current.setAttribute('aria-busy', 'true');
    } else {
      formRef.current.removeAttribute('aria-busy');
    }
  }, [pending, formRef]);

  return (
    <>
      <CardHeader>
        <CardTitle className="text-card-title">Enter article URL</CardTitle>
        <CardDescription>
          Paste the full URL of the news article you want to summarize.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="articleUrl">Article URL</Label>
          <Input
            id="articleUrl"
            ref={inputRef}
            name="articleUrl"
            type="url"
            placeholder="https://www.example.com/football-news/..."
            autoComplete="url"
            disabled={pending}
            defaultValue={initialUrl}
            aria-invalid={hasError}
            aria-describedby={hasError ? URL_ERROR_ID : undefined}
            className="input-surface text-base"
          />
          {hasError && errorMessage && (
            <p id={URL_ERROR_ID} className="text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <SubmitButton />
      </CardFooter>
    </>
  );
}
