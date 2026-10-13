import { normalizeDegrees } from "@/lib/astro/angles";
import type { BodyId, PlanetId } from "@/lib/astro/zodiac";
import { SWISS_EPHEMERIS_TOLERANCES, TOLERANCE_SOURCE } from "./engine-tolerances";
import {
  EngineUnavailableError,
  MAX_ASCENDANT_LATITUDE,
  type AscendantRaw,
  type EngineFlag,
  type EphemerisProvider,
  type InstantPositions,
  type PositionOptions,
  type ProviderInfo,
  type RawBodyPosition,
  type ToleranceKey,
} from "./types";

/**
 * Swiss Ephemeris adapter (npm `sweph`, Swiss Ephemeris 2.10.03).
 *
 * LICENSING: Swiss Ephemeris is dual-licensed (AGPL-3.0 or the Swiss Ephemeris
 * Professional License). `sweph` >= 2.10.1 is AGPL-3.0, or LGPL-3.0 for holders of a
 * professional license. Running it inside a network service under AGPL obliges the
 * operator to offer the complete corresponding source of the service to its users.
 * This adapter therefore refuses to start unless the operator explicitly declares
 * which licence applies (see docs/LICENSING.md). It is used by default only in the
 * local test-suite as an independent reference implementation.
 */

export type SwissLicenseMode = "agpl" | "professional";

// Minimal structural types for the parts of `sweph` we use.
interface SwephCalc {
  flag: number;
  error: string;
  data: number[];
}
interface SwephModule {
  version(): string;
  set_ephe_path(path: string): void;
  set_sid_mode(mode: number, t0: number, ayanT0: number): void;
  calc_ut(jdUt: number, body: number, flags: number): SwephCalc;
  utc_to_jd(
    y: number,
    m: number,
    d: number,
    h: number,
    mi: number,
    s: number,
    cal: number,
  ): { flag: number; error: string; data: number[] };
  houses_ex2(
    jdUt: number,
    flags: number,
    lat: number,
    lon: number,
    hsys: string,
  ): { flag: number; error?: string; data: { houses: number[]; points: number[] } };
  get_ayanamsa_ex_ut(jdUt: number, flags: number): { flag: number; error: string; data: number };
  deltat_ex(jdUt: number, flags: number): { flag: number; error: string; data: number };
  constants: Record<string, number>;
}

const PLANET_CODES: Record<PlanetId, string> = {
  Sun: "SE_SUN",
  Moon: "SE_MOON",
  Mars: "SE_MARS",
  Mercury: "SE_MERCURY",
  Jupiter: "SE_JUPITER",
  Venus: "SE_VENUS",
  Saturn: "SE_SATURN",
};

const PLANET_IDS = Object.keys(PLANET_CODES) as PlanetId[];

let cachedModule: SwephModule | null = null;

export async function loadSweph(): Promise<SwephModule> {
  if (cachedModule) return cachedModule;
  try {
    const mod = (await import("sweph")) as unknown as { default?: SwephModule } & SwephModule;
    cachedModule = (mod.default ?? mod) as SwephModule;
    return cachedModule;
  } catch {
    throw new EngineUnavailableError(
      "The Swiss Ephemeris engine (sweph) is not installed in this environment.",
    );
  }
}

export interface SwissProviderOptions {
  licenseMode: SwissLicenseMode;
  /** Directory containing sepl_18.se1 / semo_18.se1. Without it Swiss falls back to Moshier. */
  ephemerisPath?: string | null;
}

export class SwissEphemerisProvider implements EphemerisProvider {
  readonly info: ProviderInfo;
  private readonly C: Record<string, number>;

  constructor(
    private readonly sweph: SwephModule,
    private readonly options: SwissProviderOptions,
  ) {
    if (options.licenseMode !== "agpl" && options.licenseMode !== "professional") {
      throw new EngineUnavailableError("Swiss Ephemeris licence mode must be declared explicitly.");
    }
    this.C = sweph.constants;
    if (options.ephemerisPath) sweph.set_ephe_path(options.ephemerisPath);
    sweph.set_sid_mode(this.C.SE_SIDM_LAHIRI, 0, 0);
    this.info = {
      id: "swiss-ephemeris",
      name: "Swiss Ephemeris",
      libraryVersion: `sweph ${sweph.version()}`,
      license:
        options.licenseMode === "professional"
          ? "Swiss Ephemeris Professional License (sweph under LGPL-3.0)"
          : "AGPL-3.0 (Swiss Ephemeris / sweph)",
      ephemeris: options.ephemerisPath
        ? "Swiss Ephemeris compressed JPL-based files (SWIEPH); per-call flags record any fallback"
        : "Swiss Ephemeris without data files: Moshier analytical fallback (MOSEPH)",
      ayanamsha: "Swiss Ephemeris SE_SIDM_LAHIRI via swe_set_sid_mode + SEFLG_SIDEREAL",
      nodeTypes: ["mean", "true"],
      toleranceArcsec: SWISS_EPHEMERIS_TOLERANCES,
      toleranceSource: TOLERANCE_SOURCE,
    };
  }

  private jdUt(utcMillis: number): { jdUt: number; jdTt: number } {
    const d = new Date(utcMillis);
    const r = this.sweph.utc_to_jd(
      d.getUTCFullYear(),
      d.getUTCMonth() + 1,
      d.getUTCDate(),
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds() + d.getUTCMilliseconds() / 1000,
      this.C.SE_GREG_CAL,
    );
    if (r.flag < 0) throw new Error("Swiss Ephemeris rejected the date");
    return { jdTt: r.data[0], jdUt: r.data[1] };
  }

  private flagInfo(body: string, flag: number): EngineFlag {
    const C = this.C;
    const used: EngineFlag["ephemerisUsed"] =
      flag & C.SEFLG_JPLEPH ? "JPLEPH" : flag & C.SEFLG_SWIEPH ? "SWIEPH" : flag & C.SEFLG_MOSEPH ? "MOSEPH" : "ANALYTIC";
    return { body, returnedFlags: flag, ephemerisUsed: used };
  }

  positionsAt(utcMillis: number, options: PositionOptions): InstantPositions {
    const C = this.C;
    const { jdUt, jdTt } = this.jdUt(utcMillis);
    const flags = C.SEFLG_SWIEPH | C.SEFLG_SIDEREAL | (options.withSpeed ? C.SEFLG_SPEED : 0);
    const bodies = {} as Record<BodyId, RawBodyPosition>;
    const engineFlags: EngineFlag[] = [];

    for (const planet of PLANET_IDS) {
      const r = this.sweph.calc_ut(jdUt, C[PLANET_CODES[planet]], flags);
      if (r.flag < 0) throw new Error(`Swiss Ephemeris failed for ${planet}`);
      engineFlags.push(this.flagInfo(planet, r.flag));
      bodies[planet] = {
        body: planet,
        siderealLongitudeDeg: normalizeDegrees(r.data[0]),
        latitudeDeg: r.data[1],
        speedDegPerDay: options.withSpeed ? r.data[3] : null,
      };
    }
    const nodeCode = options.nodeType === "true" ? C.SE_TRUE_NODE : C.SE_MEAN_NODE;
    const n = this.sweph.calc_ut(jdUt, nodeCode, flags);
    if (n.flag < 0) throw new Error("Swiss Ephemeris failed for the lunar node");
    engineFlags.push(this.flagInfo(options.nodeType === "true" ? "TrueNode" : "MeanNode", n.flag));
    const rahu = normalizeDegrees(n.data[0]);
    bodies.Rahu = {
      body: "Rahu",
      siderealLongitudeDeg: rahu,
      latitudeDeg: null,
      speedDegPerDay: options.withSpeed ? n.data[3] : null,
    };
    bodies.Ketu = {
      body: "Ketu",
      siderealLongitudeDeg: normalizeDegrees(rahu + 180),
      latitudeDeg: null,
      speedDegPerDay: options.withSpeed ? n.data[3] : null,
    };

    // Mean ayanamsha (no nutation), consistent with the sidereal positions above.
    const aya = this.sweph.get_ayanamsa_ex_ut(jdUt, C.SEFLG_SWIEPH | C.SEFLG_NONUT);
    return {
      utcMillis,
      julianDayUT: jdUt,
      julianDayTT: jdTt,
      deltaTSeconds: (jdTt - jdUt) * 86_400,
      ayanamshaDeg: aya.data,
      bodies,
      engineFlags,
    };
  }

  toleranceArcsec(key: ToleranceKey): number {
    return SWISS_EPHEMERIS_TOLERANCES[key];
  }

  ascendantAt(utcMillis: number, latitudeDeg: number, longitudeDeg: number): AscendantRaw {
    if (Math.abs(latitudeDeg) > MAX_ASCENDANT_LATITUDE) {
      throw new RangeError("Ascendant is not computed beyond the polar-circle latitude limit");
    }
    const { jdUt } = this.jdUt(utcMillis);
    const h = this.sweph.houses_ex2(jdUt, this.C.SEFLG_SIDEREAL, latitudeDeg, longitudeDeg, "W");
    if (h.flag < 0) throw new Error("Swiss Ephemeris house calculation failed");
    return { siderealLongitudeDeg: normalizeDegrees(h.data.points[0]), ramcDeg: h.data.points[2] };
  }
}

export async function createSwissProvider(options: SwissProviderOptions): Promise<SwissEphemerisProvider> {
  const sweph = await loadSweph();
  return new SwissEphemerisProvider(sweph, options);
}
