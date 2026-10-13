import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { Prose } from "@/components/layout/Prose";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { Card } from "@/components/ui/Card";
import { Divider } from "@/components/ui/Divider";
import { CheckIcon } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "How SoulLetter handles your birth details: no accounts, no stored birth profiles, form progress kept only in your own browser tab, and share links that never contain birth data.",
};

const SUMMARY = [
  "No account and no sign-up.",
  "Birth details are processed to calculate your reading and are not stored.",
  "Form progress stays in your own browser tab, and you can clear it at any time.",
  "Share links never contain your birth data.",
  "No analytics, no advertising trackers and no cookies by default.",
] as const;

const SECTIONS = [
  { id: "what-you-provide", title: "What you provide" },
  { id: "why-time-and-place", title: "Why birth time and place matter" },
  { id: "what-is-sent", title: "What is sent to the server, and why" },
  { id: "what-is-kept", title: "What is kept — and what isn’t" },
  { id: "sharing", title: "Sharing a result" },
  { id: "place-search", title: "Place search" },
  { id: "protecting-the-service", title: "Protecting the service" },
  { id: "cookies-and-analytics", title: "Cookies and analytics" },
  { id: "questions", title: "Questions" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function sectionTitle(id: SectionId): string {
  const section = SECTIONS.find((s) => s.id === id);
  return section ? section.title : id;
}

export default function PrivacyPage() {
  return (
    <Container as="article" size="prose" className="py-14 sm:py-20">
      <SectionHeading
        as="h1"
        eyebrow="Privacy notice"
        title="Your birth details stay yours"
        description="SoulLetter is designed to calculate a reading without keeping a profile of you. This page explains what is used, where it goes, and what is kept."
      />

      <Card as="section" variant="glow" padding="lg" aria-labelledby="privacy-summary-title" className="mt-10">
        <h2 id="privacy-summary-title" className="text-2xl">
          The short version
        </h2>
        <ul className="mt-4 flex flex-col gap-3">
          {SUMMARY.map((item) => (
            <li key={item} className="flex items-start gap-3 text-[0.9375rem] leading-relaxed text-ivory-100">
              <CheckIcon className="mt-1 size-4 shrink-0 text-status-verified" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Card>

      <nav aria-labelledby="privacy-contents-title" className="mt-10">
        <h2 id="privacy-contents-title" className="font-sans text-sm font-semibold tracking-[0.16em] text-gold-300 uppercase">
          On this page
        </h2>
        <ol className="mt-3 grid gap-x-6 gap-y-2 text-[0.9375rem] sm:grid-cols-2">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="rounded-sm text-mist-200 underline decoration-transparent underline-offset-4 hover:text-ivory-50 hover:decoration-gold-300/60"
              >
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <Divider ornament className="my-12" />

      <Prose>
        <h2 id="what-you-provide">{sectionTitle("what-you-provide")}</h2>
        <p>To calculate a reading, the form asks for:</p>
        <ul>
          <li>
            <strong>Date of birth</strong> — required. It anchors both the chart and the numerology.
          </li>
          <li>
            <strong>Birth time</strong>, and how accurate you believe it is — optional. You can say you don’t know it.
          </li>
          <li>
            <strong>Birthplace</strong> — optional: its latitude, longitude and time zone, plus the place name you
            selected.
          </li>
          <li>
            <strong>Which of two repeated clock times you mean</strong> — asked only if your birth time fell in the hour
            that occurs twice when daylight-saving time ends.
          </li>
          <li>
            <strong>Name</strong> — optional, and only used if you choose a name-based numerology method.
          </li>
          <li>
            <strong>Your method choices</strong> — the interpretation methods and calculation settings to use, and your
            confirmation that experimental readings are symbolic.
          </li>
        </ul>
        <p>SoulLetter does not ask for your email address, phone number or any account details.</p>

        <h2 id="why-time-and-place">{sectionTitle("why-time-and-place")}</h2>
        <ul>
          <li>
            The Moon moves roughly 12–15° through the zodiac each day. A Nakshatra Pada spans 3°20′, so the Moon’s Pada —
            and with it the traditional naming syllable — can change within a few hours.
          </li>
          <li>
            The rising sign (Ascendant) changes roughly every two hours and depends on where you were born. The houses,
            and therefore the 7th-house lord, follow from it.
          </li>
          <li>
            Your birthplace’s time zone, including any daylight-saving rule in force at the time, converts the local
            clock time into the exact astronomical moment.
          </li>
        </ul>
        <p>
          If you don’t know your birth time, SoulLetter still calculates what it can. Results that depend on the time are
          marked as uncertain or unavailable — they are never guessed.
        </p>

        <h2 id="what-is-sent">{sectionTitle("what-is-sent")}</h2>
        <p>
          When you ask for a reading, your browser sends the details above to SoulLetter’s server. The server checks
          them, calculates the chart and the numerology, and returns the reading to your browser. The calculation runs
          on the server because that is where the astronomical ephemeris is.
        </p>
        <p>
          Your details travel in the body of the request, never in the web address, so they do not appear in your
          browser history or in links.
        </p>

        <h2 id="what-is-kept">{sectionTitle("what-is-kept")}</h2>
        <p>
          SoulLetter does not save birth profiles. Your details are used to calculate your reading and are not kept
          once it has been returned. There is no account, so nothing links a reading to you.
        </p>
        <h3>Form progress on your device</h3>
        <p>
          While you fill in the form, your progress is saved in your browser’s <strong>sessionStorage</strong> — on
          your own device, for that browser tab only — so that refreshing the page doesn’t lose your answers. This copy
          is not sent anywhere on its own, and your browser deletes it when you close the tab. You can remove it at any
          time with the <strong>Clear my details</strong> control in the form.
        </p>

        <h2 id="sharing">{sectionTitle("sharing")}</h2>
        <p>
          If you create a share link, it carries only the syllables, the method names and the symbolic text from your
          result, sealed in an encrypted token that expires after a limited time. A share link never includes:
        </p>
        <ul>
          <li>your date, time or place of birth, coordinates or time zone;</li>
          <li>your name;</li>
          <li>the planetary positions calculated for your chart;</li>
          <li>numerology derived from your date of birth.</li>
        </ul>
        <p>Anyone with the link can view the card until it expires, so share it only with people you choose.</p>

        <h2 id="place-search">{sectionTitle("place-search")}</h2>
        <p>
          Place search is optional. When you use it, only the place name you type is sent to the{" "}
          <a href="https://open-meteo.com/">Open-Meteo</a> geocoding service to find matching places with their
          coordinates and time zones. Your date and time of birth are never included.
        </p>
        <p>
          Place data comes from <a href="https://www.geonames.org/">GeoNames</a> and is used under the{" "}
          <a href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0</a> licence (CC BY
          4.0).
        </p>

        <h2 id="protecting-the-service">{sectionTitle("protecting-the-service")}</h2>
        <p>
          To prevent abuse, the server limits how many requests can be made in a short period. It does this with
          temporary counters held in memory, which are never written to disk and are discarded after a short time.
        </p>

        <h2 id="cookies-and-analytics">{sectionTitle("cookies-and-analytics")}</h2>
        <p>
          SoulLetter uses no analytics, advertising or tracking scripts, and sets no cookies by default. Fonts are served
          from this site, so loading a page sends no request to a font provider.
        </p>

        <h2 id="questions">{sectionTitle("questions")}</h2>
        <p>
          If you have a question about privacy or about how a reading is produced, please contact the site operator. The{" "}
          <Link href="/methodology">methodology page</Link> explains each calculation and interpretation method.
        </p>
      </Prose>
    </Container>
  );
}
