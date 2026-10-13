import { ARCSEC_PER_DEGREE, normalizeDegrees, toDms, type Dms } from "./angles";

/**
 * Sidereal zodiac subdivisions used by the D1 (Rashi) chart.
 *
 * All interval tests are half-open: a longitude exactly on a boundary belongs to
 * the FOLLOWING sign / Nakshatra / Pada, never to both. Boundaries are compared
 * against the double nearest to the exact rational boundary `k * 360 / n`, so the
 * same longitude always maps to the same cell regardless of how it was produced.
 */

export const SIGN_COUNT = 12;
export const NAKSHATRA_COUNT = 27;
export const PADAS_PER_NAKSHATRA = 4;
export const PADA_COUNT = NAKSHATRA_COUNT * PADAS_PER_NAKSHATRA; // 108
export const SIGN_WIDTH_DEG = 30;
/** 13°20′ */
export const NAKSHATRA_WIDTH_DEG = 360 / NAKSHATRA_COUNT;
/** 3°20′ (also the width of one Navamsa) */
export const PADA_WIDTH_DEG = 360 / PADA_COUNT;

export type PlanetId = "Sun" | "Moon" | "Mars" | "Mercury" | "Jupiter" | "Venus" | "Saturn";
export type NodeId = "Rahu" | "Ketu";
export type BodyId = PlanetId | NodeId;

export const PLANETS: readonly PlanetId[] = [
  "Sun",
  "Moon",
  "Mars",
  "Mercury",
  "Jupiter",
  "Venus",
  "Saturn",
];
export const BODIES: readonly BodyId[] = [...PLANETS, "Rahu", "Ketu"];

export interface SignInfo {
  index: number;
  name: string;
  sanskrit: string;
  /** Traditional (Parashari) lord; nodes are not used as sign lords here. */
  lord: PlanetId;
}

export const SIGNS: readonly SignInfo[] = [
  { index: 0, name: "Aries", sanskrit: "Meṣa", lord: "Mars" },
  { index: 1, name: "Taurus", sanskrit: "Vṛṣabha", lord: "Venus" },
  { index: 2, name: "Gemini", sanskrit: "Mithuna", lord: "Mercury" },
  { index: 3, name: "Cancer", sanskrit: "Karka", lord: "Moon" },
  { index: 4, name: "Leo", sanskrit: "Siṃha", lord: "Sun" },
  { index: 5, name: "Virgo", sanskrit: "Kanyā", lord: "Mercury" },
  { index: 6, name: "Libra", sanskrit: "Tulā", lord: "Venus" },
  { index: 7, name: "Scorpio", sanskrit: "Vṛścika", lord: "Mars" },
  { index: 8, name: "Sagittarius", sanskrit: "Dhanu", lord: "Jupiter" },
  { index: 9, name: "Capricorn", sanskrit: "Makara", lord: "Saturn" },
  { index: 10, name: "Aquarius", sanskrit: "Kumbha", lord: "Saturn" },
  { index: 11, name: "Pisces", sanskrit: "Mīna", lord: "Jupiter" },
];

export interface NakshatraInfo {
  index: number;
  name: string;
  iast: string;
  devanagari: string;
  /** Vimshottari lord (informational). */
  lord: BodyId;
}

const VIMSHOTTARI: readonly BodyId[] = [
  "Ketu",
  "Venus",
  "Sun",
  "Moon",
  "Mars",
  "Rahu",
  "Jupiter",
  "Saturn",
  "Mercury",
];

const NAKSHATRA_NAMES: ReadonlyArray<[string, string, string]> = [
  ["Ashwini", "Aśvinī", "अश्विनी"],
  ["Bharani", "Bharaṇī", "भरणी"],
  ["Krittika", "Kṛttikā", "कृत्तिका"],
  ["Rohini", "Rohiṇī", "रोहिणी"],
  ["Mrigashira", "Mṛgaśirā", "मृगशिरा"],
  ["Ardra", "Ārdrā", "आर्द्रा"],
  ["Punarvasu", "Punarvasu", "पुनर्वसु"],
  ["Pushya", "Puṣya", "पुष्य"],
  ["Ashlesha", "Āśleṣā", "आश्लेषा"],
  ["Magha", "Maghā", "मघा"],
  ["Purva Phalguni", "Pūrva Phalgunī", "पूर्वा फाल्गुनी"],
  ["Uttara Phalguni", "Uttara Phalgunī", "उत्तरा फाल्गुनी"],
  ["Hasta", "Hasta", "हस्त"],
  ["Chitra", "Citrā", "चित्रा"],
  ["Swati", "Svātī", "स्वाति"],
  ["Vishakha", "Viśākhā", "विशाखा"],
  ["Anuradha", "Anurādhā", "अनुराधा"],
  ["Jyeshtha", "Jyeṣṭhā", "ज्येष्ठा"],
  ["Mula", "Mūla", "मूल"],
  ["Purva Ashadha", "Pūrvāṣāḍhā", "पूर्वाषाढा"],
  ["Uttara Ashadha", "Uttarāṣāḍhā", "उत्तराषाढा"],
  ["Shravana", "Śravaṇa", "श्रवण"],
  ["Dhanishta", "Dhaniṣṭhā", "धनिष्ठा"],
  ["Shatabhisha", "Śatabhiṣā", "शतभिषा"],
  ["Purva Bhadrapada", "Pūrva Bhādrapadā", "पूर्वा भाद्रपदा"],
  ["Uttara Bhadrapada", "Uttara Bhādrapadā", "उत्तरा भाद्रपदा"],
  ["Revati", "Revatī", "रेवती"],
];

export const NAKSHATRAS: readonly NakshatraInfo[] = NAKSHATRA_NAMES.map(
  ([name, iast, devanagari], index) => ({
    index,
    name,
    iast,
    devanagari,
    lord: VIMSHOTTARI[index % VIMSHOTTARI.length],
  }),
);

/** Longitude (degrees) of the k-th Pada boundary, k = 0..108. */
export function padaBoundaryDeg(k: number): number {
  return (k * 360) / PADA_COUNT;
}

/** Longitude (degrees) of the k-th Nakshatra boundary, k = 0..27. */
export function nakshatraBoundaryDeg(k: number): number {
  return (k * 360) / NAKSHATRA_COUNT;
}

/** Global Pada index 0..107 using half-open intervals. */
export function padaIndexOf(longitudeDeg: number): number {
  const lon = normalizeDegrees(longitudeDeg);
  let idx = Math.floor((lon * PADA_COUNT) / 360);
  // Guard both directions against the product landing a hair off an exact boundary.
  if (idx < PADA_COUNT - 1 && lon >= padaBoundaryDeg(idx + 1)) idx += 1;
  if (idx > 0 && lon < padaBoundaryDeg(idx)) idx -= 1;
  return Math.min(Math.max(idx, 0), PADA_COUNT - 1);
}

export function signIndexOf(longitudeDeg: number): number {
  const lon = normalizeDegrees(longitudeDeg);
  return Math.min(Math.floor(lon / SIGN_WIDTH_DEG), SIGN_COUNT - 1);
}

export interface PadaCell {
  /** 0..107 */
  padaIndex: number;
  /** 0..26 */
  nakshatraIndex: number;
  /** 1..4 */
  pada: 1 | 2 | 3 | 4;
}

export function padaCellFromIndex(padaIndex: number): PadaCell {
  if (!Number.isInteger(padaIndex) || padaIndex < 0 || padaIndex >= PADA_COUNT) {
    throw new RangeError("padaIndex must be an integer in 0..107");
  }
  return {
    padaIndex,
    nakshatraIndex: Math.floor(padaIndex / PADAS_PER_NAKSHATRA),
    pada: ((padaIndex % PADAS_PER_NAKSHATRA) + 1) as 1 | 2 | 3 | 4,
  };
}

export function padaCellOf(longitudeDeg: number): PadaCell {
  return padaCellFromIndex(padaIndexOf(longitudeDeg));
}

/**
 * Navamsa (D9) sign for a sidereal longitude.
 *
 * Each Pada is one Navamsa; counting Navamsas continuously from 0° Aries gives the
 * standard Parashari rule (movable signs start from themselves, fixed signs from the
 * 9th, dual signs from the 5th) because 9 Navamsas fit in each sign.
 */
export function navamsaSignIndexOf(longitudeDeg: number): number {
  return padaIndexOf(longitudeDeg) % SIGN_COUNT;
}

export interface BoundaryDistances {
  /** Arcseconds since the start of the current Pada. */
  arcsecFromPadaStart: number;
  /** Arcseconds until the end of the current Pada. */
  arcsecToPadaEnd: number;
  /** min(arcsecFromPadaStart, arcsecToPadaEnd) */
  nearestPadaBoundaryArcsec: number;
  nearestNakshatraBoundaryArcsec: number;
  nearestSignBoundaryArcsec: number;
}

export interface ZodiacPlacement extends PadaCell {
  /** Sidereal ecliptic longitude, full precision, [0, 360). */
  longitudeDeg: number;
  signIndex: number;
  signName: string;
  signSanskrit: string;
  /** [0, 30) */
  degreeInSign: number;
  degreeInSignDms: Dms;
  nakshatraName: string;
  navamsaSignIndex: number;
  navamsaSignName: string;
  boundaries: BoundaryDistances;
}

export function boundaryDistances(longitudeDeg: number): BoundaryDistances {
  const lon = normalizeDegrees(longitudeDeg);
  const idx = padaIndexOf(lon);
  const start = padaBoundaryDeg(idx);
  const end = padaBoundaryDeg(idx + 1);
  const fromStart = (lon - start) * ARCSEC_PER_DEGREE;
  const toEnd = (end - lon) * ARCSEC_PER_DEGREE;

  const nakIdx = Math.floor(idx / PADAS_PER_NAKSHATRA);
  const nakStart = nakshatraBoundaryDeg(nakIdx);
  const nakEnd = nakshatraBoundaryDeg(nakIdx + 1);
  const signIdx = signIndexOf(lon);
  const signStart = signIdx * SIGN_WIDTH_DEG;
  const signEnd = signStart + SIGN_WIDTH_DEG;

  return {
    arcsecFromPadaStart: fromStart,
    arcsecToPadaEnd: toEnd,
    nearestPadaBoundaryArcsec: Math.min(fromStart, toEnd),
    nearestNakshatraBoundaryArcsec:
      Math.min(lon - nakStart, nakEnd - lon) * ARCSEC_PER_DEGREE,
    nearestSignBoundaryArcsec: Math.min(lon - signStart, signEnd - lon) * ARCSEC_PER_DEGREE,
  };
}

/** Full sidereal placement of a longitude. Does not round anything. */
export function placementOf(longitudeDeg: number): ZodiacPlacement {
  const lon = normalizeDegrees(longitudeDeg);
  const cell = padaCellOf(lon);
  const signIndex = signIndexOf(lon);
  const degreeInSign = lon - signIndex * SIGN_WIDTH_DEG;
  const navamsaSignIndex = cell.padaIndex % SIGN_COUNT;
  return {
    ...cell,
    longitudeDeg: lon,
    signIndex,
    signName: SIGNS[signIndex].name,
    signSanskrit: SIGNS[signIndex].sanskrit,
    degreeInSign,
    degreeInSignDms: toDms(degreeInSign, 2),
    nakshatraName: NAKSHATRAS[cell.nakshatraIndex].name,
    navamsaSignIndex,
    navamsaSignName: SIGNS[navamsaSignIndex].name,
    boundaries: boundaryDistances(lon),
  };
}

/** Whole-sign house: sign index of house `n` (1..12) given the Ascendant sign. */
export function wholeSignHouseSign(ascendantSignIndex: number, house: number): number {
  if (!Number.isInteger(house) || house < 1 || house > 12) {
    throw new RangeError("house must be an integer 1..12");
  }
  return (ascendantSignIndex + house - 1) % SIGN_COUNT;
}

export function signLord(signIndex: number): PlanetId {
  return SIGNS[signIndex].lord;
}
