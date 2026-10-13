/**
 * Display names for signs (Rashi) and grahas in Sanskrit, Hindi spoken form, Devanagari
 * and English, so the UI can say "Vrishabha (वृषभ) · Taurus" instead of a generic term.
 */
import { NAKSHATRAS, type BodyId } from "./zodiac";

export interface RashiName {
  english: string;
  /** Common Sanskrit romanization, e.g. "Vrishabha". */
  sanskrit: string;
  /** Common Hindi spoken form, e.g. "Vrishabh" (often written "Rishabh"). */
  hindi: string;
  devanagari: string;
}

export const RASHI_NAMES: readonly RashiName[] = [
  { english: "Aries", sanskrit: "Mesha", hindi: "Mesh", devanagari: "मेष" },
  { english: "Taurus", sanskrit: "Vrishabha", hindi: "Vrishabh", devanagari: "वृषभ" },
  { english: "Gemini", sanskrit: "Mithuna", hindi: "Mithun", devanagari: "मिथुन" },
  { english: "Cancer", sanskrit: "Karka", hindi: "Kark", devanagari: "कर्क" },
  { english: "Leo", sanskrit: "Simha", hindi: "Singh", devanagari: "सिंह" },
  { english: "Virgo", sanskrit: "Kanya", hindi: "Kanya", devanagari: "कन्या" },
  { english: "Libra", sanskrit: "Tula", hindi: "Tula", devanagari: "तुला" },
  { english: "Scorpio", sanskrit: "Vrishchika", hindi: "Vrishchik", devanagari: "वृश्चिक" },
  { english: "Sagittarius", sanskrit: "Dhanu", hindi: "Dhanu", devanagari: "धनु" },
  { english: "Capricorn", sanskrit: "Makara", hindi: "Makar", devanagari: "मकर" },
  { english: "Aquarius", sanskrit: "Kumbha", hindi: "Kumbh", devanagari: "कुम्भ" },
  { english: "Pisces", sanskrit: "Meena", hindi: "Meen", devanagari: "मीन" },
];

export interface GrahaName {
  english: string;
  sanskrit: string;
  devanagari: string;
}

export const GRAHA_NAMES: Readonly<Record<BodyId, GrahaName>> = {
  Sun: { english: "Sun", sanskrit: "Surya", devanagari: "सूर्य" },
  Moon: { english: "Moon", sanskrit: "Chandra", devanagari: "चन्द्र" },
  Mars: { english: "Mars", sanskrit: "Mangala", devanagari: "मङ्गल" },
  Mercury: { english: "Mercury", sanskrit: "Budha", devanagari: "बुध" },
  Jupiter: { english: "Jupiter", sanskrit: "Guru", devanagari: "गुरु" },
  Venus: { english: "Venus", sanskrit: "Shukra", devanagari: "शुक्र" },
  Saturn: { english: "Saturn", sanskrit: "Shani", devanagari: "शनि" },
  Rahu: { english: "North node", sanskrit: "Rahu", devanagari: "राहु" },
  Ketu: { english: "South node", sanskrit: "Ketu", devanagari: "केतु" },
};

export function rashiName(signIndex: number): RashiName {
  const n = RASHI_NAMES[signIndex];
  if (!n) throw new RangeError("signIndex must be 0..11");
  return n;
}

/** "Vrishabha (Taurus)" */
export function rashiLabel(signIndex: number): string {
  const n = rashiName(signIndex);
  return `${n.sanskrit} (${n.english})`;
}

/** "Guru (Jupiter)"; nodes read "Rahu" / "Ketu". */
export function grahaLabel(body: BodyId): string {
  const g = GRAHA_NAMES[body];
  return body === "Rahu" || body === "Ketu" ? g.sanskrit : `${g.sanskrit} (${g.english})`;
}

export function nakshatraDevanagari(nakshatraIndex: number): string {
  return NAKSHATRAS[nakshatraIndex]?.devanagari ?? "";
}
