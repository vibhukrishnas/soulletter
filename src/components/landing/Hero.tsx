import { CelestialWheel } from "@/components/brand/CelestialWheel";
import { ConstellationLines } from "@/components/brand/ConstellationLines";
import { LogoGlyph } from "@/components/brand/Logo";
import { Container } from "@/components/layout/Container";
import { DISCOVER_CTA_LABEL, DISCOVER_HREF } from "@/components/layout/nav-links";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ArrowRightIcon, BookIcon, EyeOffIcon, InfoIcon, UserOffIcon } from "@/components/ui/icons";

const AT_A_GLANCE = [
  { icon: UserOffIcon, text: "No account needed" },
  { icon: EyeOffIcon, text: "Birth details never stored on our servers" },
  { icon: BookIcon, text: "Methods and sources shown" },
] as const;

/**
 * Landing hero. Entrance uses CSS keyframes (not Framer Motion) so the headline paints
 * before hydration; all motion is removed under prefers-reduced-motion.
 */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-[46%] left-1/2 w-[44rem] -translate-x-1/2 -translate-y-1/2 opacity-30 sm:w-[60rem]">
          <CelestialWheel className="size-full" />
        </div>
        <div className="absolute top-1/3 left-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/20 blur-3xl sm:h-[28rem] sm:w-[28rem]" />
        <ConstellationLines figure="arc" className="absolute top-10 -left-16 hidden w-80 opacity-70 md:block" />
        <ConstellationLines figure="cross" className="absolute -right-10 bottom-6 hidden w-72 opacity-60 lg:block" />
      </div>

      <Container className="flex flex-col items-center pt-14 pb-20 text-center sm:pt-24 sm:pb-28">
        <p className="inline-flex animate-fade-up items-center gap-2.5 rounded-full border border-gold-300/25 bg-night-900/60 px-4 py-1.5 text-xs font-semibold tracking-[0.22em] text-gold-200 uppercase">
          <LogoGlyph className="size-4 text-gold-300" />
          SoulLetter
        </p>

        <h1
          id="hero-title"
          className="mt-7 max-w-4xl animate-fade-up text-[2.5rem] leading-[1.05] [animation-delay:80ms] sm:text-6xl lg:text-7xl"
        >
          Discover your symbolic partner-name initials{" "}
          <span className="text-gold-gradient mt-3 block text-2xl leading-snug italic sm:text-3xl lg:text-4xl">
            through your birth chart and numerological profile.
          </span>
        </h1>

        <p className="mt-7 max-w-2xl animate-fade-up text-base leading-relaxed text-mist-200 [animation-delay:160ms] sm:text-lg">
          SoulLetter calculates your Vedic birth chart from real astronomical positions, then applies documented naming
          traditions to show which name syllables are symbolically linked to it — with every step, assumption and
          uncertainty shown alongside.
        </p>

        <div className="mt-9 flex w-full animate-fade-up flex-col items-center gap-3 [animation-delay:240ms] sm:w-auto sm:flex-row">
          <ButtonLink
            href={DISCOVER_HREF}
            size="lg"
            fullWidth
            className="sm:w-auto"
            trailingIcon={<ArrowRightIcon />}
          >
            {DISCOVER_CTA_LABEL}
          </ButtonLink>
          <ButtonLink href="#how-it-works" variant="ghost" size="lg" fullWidth className="sm:w-auto">
            How it works
          </ButtonLink>
        </div>

        <p className="mt-7 inline-flex max-w-xl animate-fade-up items-start gap-2 text-left text-sm leading-relaxed text-mist-200 [animation-delay:320ms] sm:items-center sm:text-center">
          <InfoIcon className="mt-0.5 size-4 shrink-0 text-gold-300 sm:mt-0" />
          <span>Results are symbolic interpretations, not predictions about who you will meet.</span>
        </p>

        <ul
          aria-label="At a glance"
          className="mt-10 flex animate-fade-up flex-wrap justify-center gap-x-6 gap-y-3 text-sm text-mist-300 [animation-delay:400ms]"
        >
          {AT_A_GLANCE.map(({ icon: Icon, text }) => (
            <li key={text} className="inline-flex items-center gap-2">
              <Icon className="size-4 text-gold-300/90" />
              {text}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
