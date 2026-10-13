"use client"; // Error boundaries must be Client Components.

import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ImportantIcon } from "@/components/ui/icons";

interface ErrorPageProps {
  /** Never rendered: messages can contain internal details. Only the opaque digest is shown. */
  error: Error & { digest?: string };
  /** Re-fetches and re-renders the segment (Next.js 16.3+ recommended recovery). */
  retry: () => void;
}

/**
 * Route-level error boundary. Shows a safe, generic message — never error.message or a
 * stack trace — and lets the visitor try again.
 */
export default function ErrorPage({ error, retry }: ErrorPageProps) {
  return (
    <Container size="prose" className="flex flex-1 flex-col items-center justify-center py-20 text-center sm:py-28">
      <span className="grid size-14 place-items-center rounded-full border border-important-300/30 bg-important-950/70 text-important-300">
        <ImportantIcon className="size-7" />
      </span>
      <h1 className="mt-6 text-4xl sm:text-5xl">Something went wrong</h1>
      <p className="mt-4 max-w-md text-base leading-relaxed text-mist-200">
        We couldn’t display this page. Please try again — if the problem continues, come back a little later.
      </p>
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        <Button onClick={() => retry()}>Try again</Button>
        <ButtonLink href="/" variant="secondary">
          Go to the home page
        </ButtonLink>
      </div>
      {error.digest ? (
        <p className="mt-8 text-xs text-mist-400">
          Reference: <span className="font-mono">{error.digest}</span>
        </p>
      ) : null}
    </Container>
  );
}
