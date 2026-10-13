/**
 * Chart calculation result contract (server → client). Every value here is produced by
 * the calculation service; the UI must never synthesize or "fill in" any of it.
 */
import type { BodyId, PlanetId } from "@/lib/astro/zodiac";

export const CHART_SCHEMA_VERSION = "1.0.0";

export type NodeType = "mean" | "true";
export type CharaKarakaScheme = "seven_planet" | "eight_planet";
export type BirthTimeAccuracy = "to_the_minute" | "within_15_minutes" | "within_1_hour";

export interface ChartSettings {
  zodiac: "sidereal";
  ayanamsha: "lahiri";
  chart: "D1";
  houseSystem: "whole_sign";
  nodeType: NodeType;
  charaKarakaScheme: CharaKarakaScheme;
}

export type WarningSeverity = "info" | "caution" | "important";

export type WarningCode =
  | "BIRTH_TIME_UNKNOWN"
  | "BIRTH_TIME_APPROXIMATE"
  | "LOCATION_UNKNOWN"
  | "TIME_ZONE_UNKNOWN"
  | "DST_AMBIGUOUS_RESOLVED"
  | "PRE_1970_TIME_ZONE_DATA"
  | "LOCAL_MEAN_TIME_OFFSET"
  | "POLAR_LATITUDE"
  | "BOUNDARY_SENSITIVE"
  | "TIME_SENSITIVE"
  | "KARAKA_TIE"
  | "ENGINE_FALLBACK"
  | "FUTURE_DELTA_T"
  | "PROVISIONAL_MAPPING"
  | "EXPERIMENTAL_RULE"
  | "NAME_NOT_SUPPORTED";

export interface CalculationWarning {
  code: WarningCode;
  severity: WarningSeverity;
  message: string;
  /** Optional subject, e.g. "Jupiter" or "Ascendant". */
  subject?: string;
}

export interface DegreeDms {
  degrees: number;
  minutes: number;
  seconds: number;
}

/** A sidereal placement with full-precision longitude and boundary distances. */
export interface Placement {
  longitudeDeg: number;
  signIndex: number;
  signName: string;
  signSanskrit: string;
  degreeInSign: number;
  degreeInSignDms: DegreeDms;
  nakshatraIndex: number;
  nakshatraName: string;
  pada: 1 | 2 | 3 | 4;
  padaIndex: number;
  navamsaSignIndex: number;
  navamsaSignName: string;
  /** Arcseconds to the nearest Pada boundary (Pada boundaries include Nakshatra/sign boundaries). */
  nearestPadaBoundaryArcsec: number;
  nearestSignBoundaryArcsec: number;
}

/** One stretch of the uncertainty window during which a value does not change. */
export interface WindowSegment<T> {
  fromUtc: string;
  toUtc: string;
  /** Local wall-clock labels in the birth time zone (UTC when the zone is unknown). */
  fromLocal: string;
  toLocal: string;
  value: T;
}

export interface PadaValue {
  padaIndex: number;
  nakshatraIndex: number;
  nakshatraName: string;
  pada: 1 | 2 | 3 | 4;
  signIndex: number;
  signName: string;
}

/** When the current value began and when it ends, searched around the stated instant. */
export interface CurrentSpan {
  enteredUtc: string | null;
  enteredLocal: string | null;
  leavesUtc: string | null;
  leavesLocal: string | null;
  /** Hours searched on each side of the stated instant (null = not found within it). */
  searchedHours: number;
}

export interface BodyResult {
  body: BodyId;
  /** Placement at the stated birth instant; null when the birth time is unknown. */
  atBirth: (Placement & { speedDegPerDay: number | null; retrograde: boolean | null }) | null;
  /** Pada/sign timeline over the uncertainty window. */
  window: {
    segments: WindowSegment<PadaValue>[];
    padaStable: boolean;
    signStable: boolean;
    longitudeAtStartDeg: number;
    longitudeAtEndDeg: number;
  };
  /** Within the engine tolerance of a Pada boundary at the stated instant. */
  boundarySensitive: boolean;
  toleranceArcsec: number;
  /**
   * Engine tolerance expressed as time: listed transition instants for this body are
   * uncertain by about ± this many minutes.
   */
  transitionUncertaintyMinutes: number | null;
  /** Moon only: when its current Pada began and ends (stated instant required). */
  currentPadaSpan: CurrentSpan | null;
}

export interface AscendantResult {
  atBirth: Placement;
  window: {
    segments: WindowSegment<{ signIndex: number; signName: string }>[];
    signStable: boolean;
  };
  /** Within engine tolerance of a SIGN boundary (which would change every house). */
  boundarySensitive: boolean;
  toleranceArcsec: number;
  ramcDeg: number;
  currentSignSpan: CurrentSpan;
}

export interface SeventhHouseValue {
  seventhSignIndex: number;
  seventhSignName: string;
  lord: PlanetId;
  lordPadaIndex: number;
  lordNakshatraName: string;
  lordPada: 1 | 2 | 3 | 4;
}

export interface SeventhHouseResult {
  houseSystem: "whole_sign";
  atBirth: SeventhHouseValue;
  window: { segments: WindowSegment<SeventhHouseValue>[]; stable: boolean };
  /** True when the lord's own placement is within engine tolerance of a Pada boundary. */
  lordBoundarySensitive: boolean;
}

export interface KarakaEntry {
  karaka: string;
  abbreviation: string;
  body: BodyId;
  /** Degree used for ranking (Rahu: 30° − degree in sign, eight-planet scheme only). */
  rankingDegree: number;
}

export interface DarakarakaValue {
  body: BodyId;
  padaIndex: number;
  nakshatraName: string;
  pada: 1 | 2 | 3 | 4;
}

export interface CharaKarakaResult {
  scheme: CharaKarakaScheme;
  nodeType: NodeType;
  rahuHandling: "excluded" | "thirty_minus_degree_in_sign";
  /** Ordering at the stated instant; null when birth time is unknown. */
  atBirth: {
    order: KarakaEntry[];
    darakaraka: DarakarakaValue;
    /** Arcseconds between the two lowest ranking degrees. */
    lowestGapArcsec: number;
    tie: boolean;
  } | null;
  window: {
    segments: WindowSegment<DarakarakaValue & { tie: boolean }>[];
    stable: boolean;
  };
  tieToleranceArcsec: number;
}

export type TimeBasis =
  | "exact_instant" // birth time + zone known
  | "local_day" // birth time unknown, zone known: whole local day
  | "utc_window"; // zone unknown: every possible UTC offset

export interface TimeContext {
  basis: TimeBasis;
  localDate: string;
  localTime: string | null;
  timeZone: string | null;
  /** ICU-canonical id actually used by the runtime (e.g. Asia/Calcutta for Asia/Kolkata). */
  runtimeTimeZone: string | null;
  utcOffset: string | null;
  utcOffsetSeconds: number | null;
  /** UTC instant of birth, ISO-8601; null unless basis is exact_instant. */
  birthUtc: string | null;
  windowStartUtc: string;
  windowEndUtc: string;
  windowReason: string;
  dst: "not_applicable" | "unique" | "ambiguous_earlier" | "ambiguous_later";
  tzdbVersion: string | null;
  julianDayUT: number | null;
  julianDayTT: number | null;
  deltaTSeconds: number | null;
}

export interface EngineMetadata {
  provider: string;
  providerName: string;
  libraryVersion: string;
  license: string;
  ephemeris: string;
  ayanamshaImplementation: string;
  ayanamshaDeg: number;
  toleranceSource: string;
  engineFlags: { body: string; returnedFlags: number; ephemerisUsed: string }[];
}

export type CoverageLevel = "full" | "partial" | "limited";

export interface CoverageItem {
  id: string;
  label: string;
  available: boolean;
  reason?: string;
}

export interface ChartResult {
  schemaVersion: string;
  status: "calculated";
  settings: ChartSettings;
  time: TimeContext;
  engine: EngineMetadata;
  bodies: BodyResult[];
  ascendant: AscendantResult | null;
  seventhHouse: SeventhHouseResult | null;
  charaKarakas: CharaKarakaResult;
  coverage: { level: CoverageLevel; items: CoverageItem[] };
  warnings: CalculationWarning[];
}
