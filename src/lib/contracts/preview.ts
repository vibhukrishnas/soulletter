/**
 * Live chart preview (POST /api/v1/chart/preview). A compact, calculated summary used
 * while the user fills in the form: their actual Rashi, Nakshatra, Lagna, houses and the
 * result of EVERY selectable convention, so changing an option updates instantly.
 * All values come from the calculation service; nothing here is illustrative.
 */
import type { BodyId, PlanetId } from "@/lib/astro/zodiac";
import type { CalculationWarning, CoverageLevel, TimeBasis } from "./chart";

export interface PreviewPlacement {
  longitudeDeg: number;
  signIndex: number;
  degreeInSign: number;
  nakshatraIndex: number;
  nakshatraName: string;
  pada: 1 | 2 | 3 | 4;
  navamsaSignIndex: number;
  /** Within engine tolerance of a Pada boundary (a sign boundary for the Lagna). */
  boundarySensitive: boolean;
}

export interface PreviewSpan {
  fromLocal: string;
  toLocal: string;
  signIndex: number;
  nakshatraIndex: number;
  nakshatraName: string;
  pada: 1 | 2 | 3 | 4;
}

export interface PreviewBody {
  body: BodyId;
  atBirth: PreviewPlacement | null;
  retrograde: boolean | null;
  /** Placement spans across the birth-time window (one entry when unchanged). */
  spans: PreviewSpan[];
}

export interface PreviewDarakaraka {
  body: BodyId;
  nakshatraName: string;
  pada: 1 | 2 | 3 | 4;
  tie: boolean;
  boundarySensitive: boolean;
}

export type NodeOption = "mean" | "true";
export type KarakaOption = "seven_planet" | "eight_planet";

export interface ChartPreview {
  basis: TimeBasis;
  birthUtc: string | null;
  localTime: string | null;
  timeZone: string | null;
  utcOffset: string | null;
  julianDayUT: number | null;
  ayanamshaDeg: number;
  /** Bodies computed with the mean node (Rahu/Ketu rows), all planets. */
  bodies: PreviewBody[];
  lagna: { atBirth: PreviewPlacement | null; reason: string | null; signStable: boolean };
  seventhHouse: { signIndex: number; lord: PlanetId; lordAtBirth: PreviewPlacement } | null;
  /** Rahu at the stated instant under each node convention (null without a stated instant). */
  rahu: Record<NodeOption, PreviewPlacement | null>;
  /**
   * Darakaraka at the stated instant for every scheme × node combination
   * (the node only matters for the eight-planet scheme). Null without a stated instant.
   */
  darakaraka: Record<KarakaOption, Record<NodeOption, PreviewDarakaraka | null>>;
  coverage: CoverageLevel;
  warnings: CalculationWarning[];
}
