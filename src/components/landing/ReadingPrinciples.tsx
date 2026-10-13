import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { Card } from "@/components/ui/Card";
import { CheckIcon, CloseIcon } from "@/components/ui/icons";
import { Reveal } from "@/components/ui/Reveal";

const IS = [
  "A birth chart calculated from astronomical positions, with the settings used",
  "Traditional naming syllables, with the method and source behind each one",
  "An invitation to reflect, with uncertainty made visible rather than hidden",
] as const;

const IS_NOT = [
  "A prediction of who your partner will be or what their name will start with",
  "Scientifically validated — results are listed in a fixed order, not ranked by likelihood",
  "A reason to make or avoid any real-life decision",
] as const;

/** Plain statement of what a reading is and is not. */
export function ReadingPrinciples() {
  return (
    <section aria-labelledby="principles-title" className="py-20 sm:py-24">
      <Container size="md">
        <Reveal>
          <SectionHeading
            id="principles-title"
            eyebrow="An honest reading"
            title="What a reading is — and isn’t"
            description="SoulLetter calculates first and interprets second. The calculation can be checked; the interpretation is symbolic."
            align="center"
          />
        </Reveal>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <Reveal className="h-full">
            <Card padding="lg" className="h-full">
              <h3 className="text-2xl">A reading is</h3>
              <ul className="mt-5 flex flex-col gap-4">
                {IS.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[0.9375rem] leading-relaxed text-ivory-100">
                    <CheckIcon className="mt-1 size-4 shrink-0 text-status-verified" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
          <Reveal delay={0.08} className="h-full">
            <Card padding="lg" variant="outline" className="h-full">
              <h3 className="text-2xl">A reading isn’t</h3>
              <ul className="mt-5 flex flex-col gap-4">
                {IS_NOT.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[0.9375rem] leading-relaxed text-ivory-100">
                    <CloseIcon className="mt-1 size-4 shrink-0 text-important-300" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
