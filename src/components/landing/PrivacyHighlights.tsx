import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { ArrowRightIcon, MapPinIcon, ShareIcon, ShieldIcon, UserOffIcon } from "@/components/ui/icons";
import { Reveal } from "@/components/ui/Reveal";

const POINTS = [
  {
    icon: UserOffIcon,
    title: "No account",
    description: "There is nothing to sign up for. No email address or password is needed to get a reading.",
  },
  {
    icon: ShieldIcon,
    title: "Birth details are not stored on our servers",
    description: "They are processed to calculate your reading and are not kept afterwards.",
  },
  {
    icon: ShareIcon,
    title: "Share cards exclude birth data",
    description:
      "A share link carries only the syllables, method names and symbolic text — never your birth date, time or place.",
  },
  {
    icon: MapPinIcon,
    title: "Place search sends only the place name",
    description:
      "If you use the optional place search, only the text you type is sent to a geocoding service to find coordinates and a time zone.",
  },
] as const;

export function PrivacyHighlights() {
  return (
    <section aria-labelledby="privacy-highlights-title" className="py-20 sm:py-24">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
          <Reveal>
            <SectionHeading
              id="privacy-highlights-title"
              eyebrow="Privacy"
              title="Private by design"
              description="SoulLetter needs your birth details to do the calculation — and nothing more."
            />
            <ButtonLink
              href="/privacy"
              variant="link"
              className="mt-6"
              trailingIcon={<ArrowRightIcon />}
            >
              Read the privacy notice
            </ButtonLink>
          </Reveal>

          <ul className="grid gap-4 sm:grid-cols-2">
            {POINTS.map(({ icon: Icon, title, description }, index) => (
              <li key={title}>
                <Reveal delay={index * 0.06} className="h-full">
                  <Card padding="md" className="h-full">
                    <Icon className="size-6 text-gold-300" />
                    <h3 className="mt-4 font-sans text-base font-semibold">{title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-mist-200">{description}</p>
                  </Card>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
