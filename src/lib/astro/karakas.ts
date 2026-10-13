import { normalizeDegrees } from "./angles";
import type { BodyId, PlanetId } from "./zodiac";

/**
 * Jaimini Chara Karakas: rank bodies by degree within their sign (ignoring the sign);
 * the highest is the Atmakaraka and the lowest the Darakaraka ("antye dārakārakaḥ").
 *
 * Two explicitly named conventions are supported — neither is presented as universal:
 *  - seven_planet: Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn (nodes excluded).
 *  - eight_planet: the seven planets plus Rahu, whose ranking degree is
 *    30° − (Rahu's degree in sign) because the node moves retrograde (the convention
 *    commonly attributed to Parashara / BPHS). Ketu is never a Chara Karaka.
 *
 * Ties are NOT broken by a hidden heuristic: the caller receives the gap between the two
 * lowest ranking degrees and must report a tie when it is within engine tolerance.
 */

export type CharaKarakaScheme = "seven_planet" | "eight_planet";

export const SEVEN_PLANET_KARAKAS: ReadonlyArray<readonly [string, string]> = [
  ["Atmakaraka", "AK"],
  ["Amatyakaraka", "AmK"],
  ["Bhratrikaraka", "BK"],
  ["Matrikaraka", "MK"],
  ["Putrakaraka", "PK"],
  ["Gnatikaraka", "GK"],
  ["Darakaraka", "DK"],
];

export const EIGHT_PLANET_KARAKAS: ReadonlyArray<readonly [string, string]> = [
  ["Atmakaraka", "AK"],
  ["Amatyakaraka", "AmK"],
  ["Bhratrikaraka", "BK"],
  ["Matrikaraka", "MK"],
  ["Pitrikaraka", "PiK"],
  ["Putrakaraka", "PK"],
  ["Gnatikaraka", "GK"],
  ["Darakaraka", "DK"],
];

const SEVEN: readonly PlanetId[] = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];

export interface RankedKaraka {
  karaka: string;
  abbreviation: string;
  body: BodyId;
  rankingDegree: number;
}

export interface KarakaRanking {
  order: RankedKaraka[];
  darakaraka: BodyId;
  atmakaraka: BodyId;
  /** Arcseconds between the two lowest ranking degrees (DK vs. next). */
  lowestGapArcsec: number;
}

export function karakaParticipants(scheme: CharaKarakaScheme): readonly BodyId[] {
  return scheme === "eight_planet" ? [...SEVEN, "Rahu"] : SEVEN;
}

export function rankingDegree(body: BodyId, siderealLongitudeDeg: number): number {
  const inSign = normalizeDegrees(siderealLongitudeDeg) % 30;
  if (body === "Rahu") return 30 - inSign;
  if (body === "Ketu") throw new RangeError("Ketu is not a Chara Karaka");
  return inSign;
}

export function rankCharaKarakas(
  longitudes: Readonly<Partial<Record<BodyId, number>>>,
  scheme: CharaKarakaScheme,
): KarakaRanking {
  const participants = karakaParticipants(scheme);
  const names = scheme === "eight_planet" ? EIGHT_PLANET_KARAKAS : SEVEN_PLANET_KARAKAS;
  const entries = participants.map((body, fixedOrder) => {
    const lon = longitudes[body];
    if (lon === undefined || !Number.isFinite(lon)) {
      throw new RangeError(`Missing longitude for ${body}`);
    }
    return { body, degree: rankingDegree(body, lon), fixedOrder };
  });
  // Descending by degree. Exact equality falls back to the fixed list order only so the
  // output is deterministic; the gap below exposes any tie to the caller.
  entries.sort((a, b) => b.degree - a.degree || a.fixedOrder - b.fixedOrder);
  const order = entries.map((e, i) => ({
    karaka: names[i][0],
    abbreviation: names[i][1],
    body: e.body,
    rankingDegree: e.degree,
  }));
  const last = entries[entries.length - 1];
  const secondLast = entries[entries.length - 2];
  return {
    order,
    darakaraka: last.body,
    atmakaraka: entries[0].body,
    lowestGapArcsec: (secondLast.degree - last.degree) * 3600,
  };
}
