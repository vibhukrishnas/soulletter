import { GRAHA_NAMES, RASHI_NAMES, nakshatraDevanagari } from "@/lib/astro/names";
import type { BodyId } from "@/lib/astro/zodiac";

/**
 * Sign (Rashi), graha and Nakshatra names in Sanskrit with Devanagari and English, e.g.
 * "Vrishabha (वृषभ) · Taurus". Pure display; values always come from the service.
 */

/** Plain-text form for table cells and strings: "Simha (सिंह) · Leo". */
export function signText(index: number): string {
  const n = RASHI_NAMES[index];
  return `${n.sanskrit} (${n.devanagari}) · ${n.english}`;
}

/** Plain-text form: "Guru (Jupiter)", or "Rahu" / "Ketu". */
export function grahaText(body: BodyId): string {
  const g = GRAHA_NAMES[body];
  return body === "Rahu" || body === "Ketu" ? g.sanskrit : `${g.sanskrit} (${g.english})`;
}

/** "Simha (सिंह) · Leo" */
export function SignName({ index, english = true }: { index: number; english?: boolean }) {
  const n = RASHI_NAMES[index];
  return (
    <span>
      {n.sanskrit}{" "}
      <span lang="sa" className="font-devanagari">
        ({n.devanagari})
      </span>
      {english ? <span className="text-mist-300"> · {n.english}</span> : null}
    </span>
  );
}

/** "Guru (गुरु) · Jupiter" */
export function GrahaName({ body }: { body: BodyId }) {
  const g = GRAHA_NAMES[body];
  return (
    <span>
      {g.sanskrit}{" "}
      <span lang="sa" className="font-devanagari">
        ({g.devanagari})
      </span>
      <span className="text-mist-300"> · {g.english}</span>
    </span>
  );
}

/** "Purva Phalguni (पूर्वा फाल्गुनी), Pada 3" */
export function NakshatraName({ index, name, pada }: { index: number; name: string; pada: number }) {
  return (
    <span>
      {name}{" "}
      <span lang="sa" className="font-devanagari">
        ({nakshatraDevanagari(index)})
      </span>
      , Pada {pada}
    </span>
  );
}

