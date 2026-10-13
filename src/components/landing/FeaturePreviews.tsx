import type { ReactNode } from "react";
import type { VerificationStatus } from "@/lib/contracts/reading";
import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { Card } from "@/components/ui/Card";
import { Disclosure } from "@/components/ui/Disclosure";
import { FlaskIcon, InfoIcon, MoonIcon, NumbersIcon } from "@/components/ui/icons";
import { Reveal } from "@/components/ui/Reveal";
import { StatusBadge, VERIFICATION_STATUS_DESCRIPTIONS } from "@/components/ui/StatusBadge";

interface AstrologyFeature {
  title: string;
  description: string;
  status: VerificationStatus;
}

const ASTROLOGY_FEATURES: readonly AstrologyFeature[] = [
  {
    title: "Sidereal D1 birth chart",
    description:
      "Planetary positions from an astronomical ephemeris, placed in the sidereal zodiac with the Lahiri ayanamsha.",
    status: "verified_calculation",
  },
  {
    title: "Moon Nakshatra & Pada",
    description:
      "Which of the 27 lunar mansions (Nakshatras) the Moon occupied at birth, and which of its four quarters (Padas).",
    status: "verified_calculation",
  },
  {
    title: "Traditional naming syllables",
    description:
      "The Avakahada Chakra pairs each Nakshatra Pada with a syllable — the traditional basis for choosing the first sound of a name.",
    status: "documented_traditional_interpretation",
  },
  {
    title: "Partner-syllable readings",
    description:
      "An experimental adaptation that applies the same table to the 7th-house lord or the Darakaraka, traditional significators of a partner. The 7th-house reading needs a reliable birth time.",
    status: "experimental_symbolic",
  },
];

const NUMEROLOGY_FEATURES = [
  {
    title: "Life Path number",
    description: "Reduced from your full date of birth, using the method stated in your reading.",
  },
  {
    title: "Psychic number (Mulank)",
    description: "Derived from the day of the month on which you were born.",
  },
  {
    title: "Destiny number (Bhagyank)",
    description: "Derived from every digit of your full date of birth.",
  },
  {
    title: "Name numbers (optional)",
    description: "Pythagorean or Chaldean letter values — only if you choose to enter a name.",
  },
] as const;

const STATUS_LEGEND: readonly VerificationStatus[] = [
  "verified_calculation",
  "documented_traditional_interpretation",
  "experimental_symbolic",
  "provisional_source",
  "disabled_insufficient_evidence",
];

function FeatureIcon({ children }: { children: ReactNode }) {
  return (
    <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-gold-300/30 bg-gold-300/10 text-gold-200 [&_svg]:size-6">
      {children}
    </span>
  );
}

export function FeaturePreviews() {
  return (
    <section aria-labelledby="features-title" className="py-20 sm:py-24">
      <Container>
        <Reveal>
          <SectionHeading
            id="features-title"
            eyebrow="What your reading includes"
            title="Two traditions, kept separate"
            description="Vedic astrology produces the syllables. Numerology adds a separate layer of symbolic context. Nothing is blended into a single score."
          />
        </Reveal>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <Reveal className="h-full">
            <Card as="article" variant="glow" padding="lg" aria-labelledby="feature-astrology-title" className="h-full">
              <div className="flex items-start gap-4">
                <FeatureIcon>
                  <MoonIcon />
                </FeatureIcon>
                <div className="min-w-0">
                  <h3 id="feature-astrology-title" className="text-3xl">
                    Vedic astrology
                  </h3>
                  <p className="mt-1 text-[0.9375rem] text-mist-200">Your chart is calculated, never invented.</p>
                </div>
              </div>

              <ul className="mt-6">
                {ASTROLOGY_FEATURES.map((feature) => (
                  <li key={feature.title} className="border-t border-line py-4 last:pb-0">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <h4 className="text-base">{feature.title}</h4>
                      <StatusBadge status={feature.status} className="self-start sm:shrink-0" />
                    </div>
                    <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-mist-200">{feature.description}</p>
                  </li>
                ))}
              </ul>

              <p className="mt-5 flex items-start gap-2.5 rounded-control border border-status-experimental/25 bg-status-experimental/[0.06] p-3.5 text-sm leading-relaxed text-ivory-200">
                <FlaskIcon className="mt-0.5 size-4 shrink-0 text-status-experimental" />
                <span>
                  Partner readings are experimental. They are shown only after you confirm you understand that they are
                  symbolic interpretations without an established source for this use.
                </span>
              </p>
            </Card>
          </Reveal>

          <Reveal delay={0.08} className="h-full">
            <Card as="article" padding="lg" aria-labelledby="feature-numerology-title" className="h-full">
              <div className="flex items-start gap-4">
                <FeatureIcon>
                  <NumbersIcon />
                </FeatureIcon>
                <div className="min-w-0">
                  <h3 id="feature-numerology-title" className="text-3xl">
                    Numerology
                  </h3>
                  <p className="mt-1 text-[0.9375rem] text-mist-200">Separate symbolic context from your date of birth.</p>
                </div>
              </div>

              <ul className="mt-6">
                {NUMEROLOGY_FEATURES.map((feature) => (
                  <li key={feature.title} className="border-t border-line py-4 last:pb-0">
                    <h4 className="text-base">{feature.title}</h4>
                    <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-mist-200">{feature.description}</p>
                  </li>
                ))}
              </ul>

              <p className="mt-5 flex items-start gap-2.5 rounded-control border border-indigo-300/25 bg-indigo-400/[0.08] p-3.5 text-sm leading-relaxed text-ivory-200">
                <InfoIcon className="mt-0.5 size-4 shrink-0 text-indigo-300" />
                <span>
                  Numerology never creates, removes or reorders syllable results. It sits alongside them as separate
                  context.
                </span>
              </p>
            </Card>
          </Reveal>
        </div>

        <Reveal className="mt-8">
          <Disclosure
            title="How methods are labelled"
            meta={<span className="text-sm font-normal text-mist-300">Five statuses</span>}
            region={false}
          >
            <p className="text-mist-200">
              Every method in a reading carries one of these labels, so you can see how well-founded it is.
            </p>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              {STATUS_LEGEND.map((status) => (
                <div key={status} className="flex flex-col gap-1.5">
                  <dt>
                    <StatusBadge status={status} />
                  </dt>
                  <dd className="text-sm leading-relaxed text-mist-200">{VERIFICATION_STATUS_DESCRIPTIONS[status]}</dd>
                </div>
              ))}
            </dl>
          </Disclosure>
        </Reveal>
      </Container>
    </section>
  );
}
