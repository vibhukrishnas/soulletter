"use client"; // Error boundaries must be Client Components.

// global-error replaces the root layout, so it must bring its own document and styles.
import "./globals.css";
import { LogoGlyph } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { buttonStyles } from "@/components/ui/button-styles";

interface GlobalErrorProps {
  /** Never rendered: messages can contain internal details. Only the opaque digest is shown. */
  error: Error & { digest?: string };
  /** Re-fetches and re-renders the app (Next.js 16.3+ recommended recovery). */
  retry: () => void;
}

/**
 * Last-resort error UI for failures in the root layout. Self-contained (no header/footer,
 * no next/font) and shows only a safe, generic message.
 */
export default function GlobalError({ error, retry }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body className="bg-celestial flex min-h-dvh flex-col font-sans text-ivory-100 antialiased">
        <title>Something went wrong · SoulLetter</title>
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
          <LogoGlyph className="size-12 text-gold-300" />
          <h1 className="mt-6 text-4xl sm:text-5xl">Something went wrong</h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-mist-200">
            SoulLetter couldn’t load just now. Please try again — if the problem continues, come back a little later.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <Button onClick={() => retry()}>Try again</Button>
            {/* A full page load is deliberate: the app shell itself failed to render. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" className={buttonStyles({ variant: "secondary" })}>
              Go to the home page
            </a>
          </div>
          {error.digest ? (
            <p className="mt-8 text-xs text-mist-400">
              Reference: <span className="font-mono">{error.digest}</span>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
