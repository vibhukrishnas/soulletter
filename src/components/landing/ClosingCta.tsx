import { ConstellationLines } from "@/components/brand/ConstellationLines";
import { Container } from "@/components/layout/Container";
import { DISCOVER_CTA_LABEL, DISCOVER_HREF } from "@/components/layout/nav-links";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Callout } from "@/components/ui/Callout";
import { Card } from "@/components/ui/Card";
import { ArrowRightIcon } from "@/components/ui/icons";
import { Reveal } from "@/components/ui/Reveal";

/** Final call to action plus the entertainment disclaimer. */
export function ClosingCta() {
  return (
    <section aria-labelledby="closing-title" className="pt-12 pb-24 sm:pb-28">
      <Container size="md">
        <Reveal>
          <Card variant="glow" padding="none" className="isolate overflow-hidden px-6 py-12 text-center sm:px-12 sm:py-16">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
              <ConstellationLines figure="lyre" animate={false} className="absolute -top-6 -left-10 w-64 opacity-50" />
              <div className="absolute -right-24 -bottom-24 size-72 rounded-full bg-indigo-500/20 blur-3xl" />
            </div>
            <h2 id="closing-title" className="text-4xl sm:text-5xl">
              Ready when you are
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-mist-200 sm:text-lg">
              Have your date of birth ready — plus your birth time and place, if you know them.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
              <ButtonLink href={DISCOVER_HREF} size="lg" trailingIcon={<ArrowRightIcon />}>
                {DISCOVER_CTA_LABEL}
              </ButtonLink>
              <ButtonLink href="/methodology" variant="link">
                Read the methodology
              </ButtonLink>
            </div>
          </Card>
        </Reveal>

        <Callout tone="info" title="For reflection and entertainment" className="mt-8">
          SoulLetter’s readings are symbolic interpretations of Vedic astrological and numerological traditions. They are
          for reflection and entertainment; not a scientifically validated prediction of a future partner.
        </Callout>
      </Container>
    </section>
  );
}
