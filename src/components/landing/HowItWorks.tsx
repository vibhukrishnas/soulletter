import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { Card } from "@/components/ui/Card";
import { CalendarIcon, LetterIcon, OrbitIcon } from "@/components/ui/icons";
import { Reveal } from "@/components/ui/Reveal";

const STEPS = [
  {
    icon: CalendarIcon,
    title: "Enter birth details",
    description:
      "Your date of birth, plus your birth time and place if you know them. An unknown birth time is fine: time-sensitive results are marked as uncertain, never guessed.",
  },
  {
    icon: OrbitIcon,
    title: "Calculate your profile",
    description:
      "Planetary positions are calculated with an astronomical ephemeris and placed in the sidereal zodiac using the Lahiri ayanamsha. Numerology is worked out separately from your date of birth.",
  },
  {
    icon: LetterIcon,
    title: "Reveal your reading",
    description:
      "See the syllables each method points to, together with the chart evidence, the method's status and the uncertainty behind every result.",
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-it-works-title" className="py-20 sm:py-24">
      <Container>
        <Reveal>
          <SectionHeading
            id="how-it-works-title"
            eyebrow="How it works"
            title="Three calm steps"
            description="Calculation comes first and interpretation second, so you can see the work at every stage."
            align="center"
          />
        </Reveal>

        <ol className="mt-12 grid gap-5 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, description }, index) => (
            <li key={title}>
              <Reveal delay={index * 0.08} className="h-full">
                <Card padding="lg" className="h-full">
                  <div className="flex items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-full border border-gold-300/30 bg-gold-300/10 text-gold-200">
                      <Icon className="size-5" />
                    </span>
                    <span className="text-xs font-semibold tracking-[0.2em] text-gold-300 uppercase">
                      Step {index + 1}
                    </span>
                  </div>
                  <h3 className="mt-5 text-2xl">{title}</h3>
                  <p className="mt-2 text-[0.9375rem] leading-relaxed text-mist-200">{description}</p>
                </Card>
              </Reveal>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
