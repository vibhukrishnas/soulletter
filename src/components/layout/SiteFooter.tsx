import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Divider } from "@/components/ui/Divider";
import { Container } from "./Container";
import { DISCOVER_CTA_LABEL, DISCOVER_HREF, PRIMARY_NAV_LINKS } from "./nav-links";

const FOOTER_LINK =
  "rounded-sm text-mist-200 underline decoration-transparent underline-offset-4 transition-colors duration-200 " +
  "hover:text-ivory-50 hover:decoration-gold-300/60";

const ATTRIBUTION_LINK = "underline decoration-mist-500 underline-offset-2 hover:text-ivory-100 hover:decoration-gold-300/60";

/** Site footer: disclaimer, secondary navigation and data attribution. */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-night-950/70">
      <Container className="py-12 sm:py-14">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Logo size="sm" />
            <p className="mt-4 text-sm leading-relaxed text-mist-300">
              Symbolic partner-name syllables from your sidereal Vedic birth chart, with numerology shown as separate
              context.
            </p>
          </div>
          <nav aria-label="Footer">
            <ul className="grid gap-3 text-sm">
              <li>
                <Link href={DISCOVER_HREF} className={FOOTER_LINK}>
                  {DISCOVER_CTA_LABEL}
                </Link>
              </li>
              {PRIMARY_NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={FOOTER_LINK}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <Divider className="my-8" />

        <p className="max-w-3xl text-sm leading-relaxed text-mist-300">
          <strong className="font-medium text-ivory-100">For reflection and entertainment.</strong> SoulLetter offers
          symbolic interpretations drawn from Vedic astrological and numerological traditions. A reading is not a
          scientifically validated prediction of a future partner and should not guide important decisions.
        </p>
        <p className="mt-4 text-xs leading-relaxed text-mist-400">
          Location data:{" "}
          <a href="https://open-meteo.com/" className={ATTRIBUTION_LINK}>
            Open-Meteo
          </a>
          ,{" "}
          <a href="https://www.geonames.org/" className={ATTRIBUTION_LINK}>
            GeoNames
          </a>{" "}
          (
          <a href="https://creativecommons.org/licenses/by/4.0/" className={ATTRIBUTION_LINK}>
            CC BY 4.0
          </a>
          )
        </p>
      </Container>
    </footer>
  );
}
