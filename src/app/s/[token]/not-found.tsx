import { Container } from "@/components/layout/Container";
import { ArrowRightIcon, ButtonLink, Callout } from "@/components/ui";

/** Shown for share links that are malformed or cannot be authenticated. */
export default function ShareNotFound() {
  return (
    <Container size="prose" className="flex flex-col gap-6 py-12 sm:py-16">
      <h1 className="font-display text-4xl text-ivory-50 sm:text-5xl">This share link isn&apos;t valid</h1>
      <Callout tone="info">
        The link may be incomplete or mistyped. Share links only ever contain a symbolic card — never anyone&apos;s
        birth details.
      </Callout>
      <div>
        <ButtonLink href="/discover" trailingIcon={<ArrowRightIcon />}>
          Discover your own
        </ButtonLink>
      </div>
    </Container>
  );
}
