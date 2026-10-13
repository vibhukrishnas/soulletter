import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Container } from "@/components/layout/Container";
import { expiryLabel } from "@/components/reading/format";
import { ShareCardPreview } from "@/components/share/ShareCardPreview";
import { ArrowRightIcon, ButtonLink, Callout, LockIcon } from "@/components/ui";
import { resolveShareToken } from "@/server/share/resolve";

/** Generic metadata: nothing from the card or token is exposed, and the page is never indexed. */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "A shared symbolic syllable",
    description: "A SoulLetter share card: a symbolic interpretation for reflection, not a prediction.",
    robots: { index: false, follow: false },
  };
}

function Unavailable({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Container size="prose" className="flex flex-col gap-6 py-12 sm:py-16">
      <h1 className="font-display text-4xl text-ivory-50 sm:text-5xl">{title}</h1>
      <Callout tone="info">{children}</Callout>
      <div>
        <ButtonLink href="/discover" trailingIcon={<ArrowRightIcon />}>
          Discover your own
        </ButtonLink>
      </div>
    </Container>
  );
}

/** Public share page. Shows only the privacy-safe card rebuilt from the token's cell and rule ids. */
export default async function SharedCardPage({ params }: { params: Promise<{ token: string }> }) {
  // Expiry depends on the request time, so this page is always rendered per request.
  await connection();
  const { token } = await params;
  const resolved = resolveShareToken(token);

  if (!resolved.ok) {
    if (resolved.reason === "invalid") notFound();
    if (resolved.reason === "expired") {
      return (
        <Unavailable title="This share link has expired">
          Share links last for a limited time. Ask the person who shared it for a new link, or calculate your own
          reading.
        </Unavailable>
      );
    }
    return (
      <Unavailable title="Share links are unavailable">
        Share links are not enabled on this server right now, so this card can&apos;t be shown.
      </Unavailable>
    );
  }

  const { card, expiresAt } = resolved;
  return (
    <Container size="prose" className="flex flex-col gap-8 py-12 sm:py-16">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium tracking-[0.2em] text-gold-300 uppercase">Shared with you</p>
        <h1 className="font-display text-4xl text-ivory-50 sm:text-5xl">A shared SoulLetter card</h1>
        <p className="text-base text-mist-300">
          Someone shared this SoulLetter card. It contains no birth date, time, place, name or chart.
        </p>
      </div>

      <ShareCardPreview card={card} headingLevel="h2" headingId="shared-card-headline" className="w-full" />

      <Callout tone="important" title="Please read">
        <p>{card.disclaimer}</p>
      </Callout>

      <p className="flex items-start gap-2 text-sm text-mist-300">
        <LockIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-gold-300" />
        This link expires {expiryLabel(expiresAt)}.
      </p>

      <div className="flex flex-col gap-3 rounded-card border border-line bg-night-800/50 p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[0.9375rem] text-ivory-100">Curious what your own birth chart shows?</p>
        <ButtonLink href="/discover" trailingIcon={<ArrowRightIcon />}>
          Discover your own
        </ButtonLink>
      </div>
    </Container>
  );
}
