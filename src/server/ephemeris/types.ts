import type { BodyId } from "@/lib/astro/zodiac";

export type NodeType = "mean" | "true";
export type EphemerisProviderId = "astronomy-engine" | "swiss-ephemeris";

/** Quantities for which an engine publishes an agreement tolerance. */
export type ToleranceKey =
  | "Sun"
  | "Moon"
  | "Mercury"
  | "Venus"
  | "Mars"
  | "Jupiter"
  | "Saturn"
  | "MeanNode"
  | "TrueNode"
  | "Ascendant";

export interface ProviderInfo {
  id: EphemerisProviderId;
  name: string;
  /** Exact library version actually loaded at runtime. */
  libraryVersion: string;
  license: string;
  /** What the positions are computed from. */
  ephemeris: string;
  /** How the Lahiri ayanamsha is applied. */
  ayanamsha: string;
  nodeTypes: readonly NodeType[];
  /**
   * Documented maximum disagreement (arcseconds) with the independent reference
   * engine over the supported date range, including a safety margin. Positions closer
   * than this to a Pada/sign boundary are reported as boundary-sensitive.
   */
  toleranceArcsec: Readonly<Record<ToleranceKey, number>>;
  /** Where the tolerance figures come from. */
  toleranceSource: string;
}

export interface RawBodyPosition {
  body: BodyId;
  /** Sidereal (Lahiri) ecliptic longitude, degrees, [0, 360). */
  siderealLongitudeDeg: number;
  /** Geocentric ecliptic latitude, degrees (null for nodes). */
  latitudeDeg: number | null;
  /** Degrees per day; negative = retrograde. Null when speeds were not requested. */
  speedDegPerDay: number | null;
}

export interface EngineFlag {
  body: string;
  /** Raw flag bits returned by the engine (Swiss Ephemeris only). */
  returnedFlags: number;
  ephemerisUsed: "SWIEPH" | "JPLEPH" | "MOSEPH" | "ANALYTIC";
  note?: string;
}

export interface InstantPositions {
  utcMillis: number;
  /** Julian Day (UT) as computed by the engine. */
  julianDayUT: number;
  /** Julian Day (TT) as computed by the engine. */
  julianDayTT: number;
  deltaTSeconds: number;
  /** Mean Lahiri ayanamsha, degrees. */
  ayanamshaDeg: number;
  bodies: Record<BodyId, RawBodyPosition>;
  engineFlags: EngineFlag[];
}

export interface AscendantRaw {
  /** Sidereal (Lahiri) ecliptic longitude of the Ascendant, degrees. */
  siderealLongitudeDeg: number;
  /** Right ascension of the meridian (local apparent sidereal time), degrees. */
  ramcDeg: number;
}

export interface PositionOptions {
  nodeType: NodeType;
  /** Compute daily motion (needed for retrograde flags). Slower for some engines. */
  withSpeed: boolean;
}

export interface EphemerisProvider {
  readonly info: ProviderInfo;
  positionsAt(utcMillis: number, options: PositionOptions): InstantPositions;
  /** Throws for latitudes where the Ascendant is not computed (see MAX_ASCENDANT_LATITUDE). */
  ascendantAt(utcMillis: number, latitudeDeg: number, longitudeDeg: number): AscendantRaw;
  /** Boundary-sensitivity tolerance (arcseconds) for a quantity at an instant. */
  toleranceArcsec(key: ToleranceKey, utcMillis: number): number;
}

/**
 * Beyond the polar circles parts of the ecliptic never rise, and Ascendant-based
 * houses become discontinuous. We do not compute the Ascendant there.
 */
export const MAX_ASCENDANT_LATITUDE = 66.0;

export class EngineUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngineUnavailableError";
  }
}
