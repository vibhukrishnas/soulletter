import type { Metadata } from "next";
import { ConstellationLines } from "@/components/brand/ConstellationLines";
import { Container } from "@/components/layout/Container";
import { DISCOVER_CTA_LABEL, DISCOVER_HREF } from "@/components/layout/nav-links";
import { ButtonLink } from "@/components/ui/ButtonLink";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <Container size="prose" className="flex flex-1 flex-col items-center justify-center py-20 text-center sm:py-28">
      <ConstellationLines figure="lyre" className="w-48 opacity-80" />
      <p className="mt-6 text-xs font-semibold tracking-[0.2em] text-gold-300 uppercase">Error 404</p>
      <h1 className="mt-3 text-4xl sm:text-5xl">This page isn’t in our sky</h1>
      <p className="mt-4 max-w-md text-base leading-relaxed text-mist-200">
        The link may be mistyped, or the page may have moved. Shared readings also stop working once their link
        expires.
      </p>
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        <ButtonLink href="/">Go to the home page</ButtonLink>
        <ButtonLink href={DISCOVER_HREF} variant="secondary">
          {DISCOVER_CTA_LABEL}
        </ButtonLink>
      </div>
    </Container>
  );
}
