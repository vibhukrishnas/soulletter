import * as Astro from "astronomy-engine";
import { normalizeDegrees } from "@/lib/astro/angles";
import { lahiriMeanAyanamshaDeg } from "@/lib/astro/ayanamsha";
import {
  ascendantLongitudeDeg,
  meanLunarNodeLongitudeDeg,
  osculatingNodeLongitudeDeg,
} from "@/lib/astro/spherical";
import type { BodyId, PlanetId } from "@/lib/astro/zodiac";
import {
  ASTRONOMY_ENGINE_TOLERANCES,
  TOLERANCE_SOURCE,
  astronomyEngineToleranceArcsec,
} from "./engine-tolerances";
import {
  MAX_ASCENDANT_LATITUDE,
  type AscendantRaw,
  type EphemerisProvider,
  type InstantPositions,
  type PositionOptions,
  type ProviderInfo,
  type RawBodyPosition,
  type ToleranceKey,
} from "./types";

/** Must equal the version pinned in package.json (asserted by a unit test). */
export const ASTRONOMY_ENGINE_VERSION = "2.1.19";

const KM_PER_AU = 149_597_870.7;
const LIGHT_KM_PER_SEC = 299_792.458;
const SPEED_STEP_DAYS = 1 / 24; // ±1 hour central difference

const BODY: Record<PlanetId, Astro.Body> = {
  Sun: Astro.Body.Sun,
  Moon: Astro.Body.Moon,
  Mars: Astro.Body.Mars,
  Mercury: Astro.Body.Mercury,
  Jupiter: Astro.Body.Jupiter,
  Venus: Astro.Body.Venus,
  Saturn: Astro.Body.Saturn,
};

const PLANET_IDS: readonly PlanetId[] = [
  "Sun",
  "Moon",
  "Mars",
  "Mercury",
  "Jupiter",
  "Venus",
  "Saturn",
];

interface FrameAtTime {
  time: Astro.AstroTime;
  /** Nutation in longitude, degrees. */
  dpsiDeg: number;
  /** True obliquity, degrees. */
  trueObliquityDeg: number;
  /** Mean Lahiri ayanamsha, degrees. */
  ayanamshaDeg: number;
  julianDayTT: number;
}

function frameAt(time: Astro.AstroTime): FrameAtTime {
  const tilt = Astro.e_tilt(time);
  const julianDayTT = time.tt + 2451545.0;
  return {
    time,
    dpsiDeg: tilt.dpsi / 3600,
    trueObliquityDeg: tilt.tobl,
    ayanamshaDeg: lahiriMeanAyanamshaDeg(julianDayTT),
    julianDayTT,
  };
}

/** True-equinox-of-date longitude → sidereal (mean equinox minus mean ayanamsha). */
function toSidereal(trueEquinoxLongitudeDeg: number, frame: FrameAtTime): number {
  return normalizeDegrees(trueEquinoxLongitudeDeg - frame.dpsiDeg - frame.ayanamshaDeg);
}

/**
 * Apparent geocentric ecliptic coordinates (true ecliptic/equinox of date).
 * Planets and Sun: light-time and aberration corrected by astronomy-engine.
 * Moon: astronomy-engine returns a geometric position; we evaluate it at t − τ
 * (τ = light time, ≈1.3 s), which is the dominant apparent-place correction for the
 * geocentric Moon (annual aberration cancels against the light-time shift of the
 * Earth–Moon system).
 */
function apparentEcliptic(planet: PlanetId, time: Astro.AstroTime): { lon: number; lat: number } {
  let vec: Astro.Vector;
  if (planet === "Moon") {
    const geometric = Astro.GeoMoon(time);
    const tauDays = (geometric.Length() * KM_PER_AU) / LIGHT_KM_PER_SEC / 86_400;
    vec = Astro.GeoMoon(time.AddDays(-tauDays));
    vec.t = time;
  } else {
    vec = Astro.GeoVector(BODY[planet], time, true);
  }
  const ecl = Astro.Ecliptic(vec);
  return { lon: ecl.elon, lat: ecl.elat };
}

function planetSidereal(planet: PlanetId, time: Astro.AstroTime): { lon: number; lat: number } {
  const frame = frameAt(time);
  const app = apparentEcliptic(planet, time);
  return { lon: toSidereal(app.lon, frame), lat: app.lat };
}

function meanNodeSidereal(time: Astro.AstroTime): number {
  const frame = frameAt(time);
  // Meeus' mean node is referred to the mean equinox of date: subtract the mean ayanamsha only.
  return normalizeDegrees(meanLunarNodeLongitudeDeg(frame.julianDayTT) - frame.ayanamshaDeg);
}

function trueNodeSidereal(time: Astro.AstroTime): number {
  const frame = frameAt(time);
  const state = Astro.GeoMoonState(time);
  const rot = Astro.Rotation_EQJ_ECT(time);
  const r = Astro.RotateVector(rot, new Astro.Vector(state.x, state.y, state.z, time));
  const v = Astro.RotateVector(rot, new Astro.Vector(state.vx, state.vy, state.vz, time));
  const lonTrueEquinox = osculatingNodeLongitudeDeg([r.x, r.y, r.z], [v.x, v.y, v.z]);
  return toSidereal(lonTrueEquinox, frame);
}

function centralSpeed(f: (t: Astro.AstroTime) => number, time: Astro.AstroTime): number {
  const before = f(time.AddDays(-SPEED_STEP_DAYS));
  const after = f(time.AddDays(SPEED_STEP_DAYS));
  let d = after - before;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d / (2 * SPEED_STEP_DAYS);
}

export class AstronomyEngineProvider implements EphemerisProvider {
  readonly info: ProviderInfo = {
    id: "astronomy-engine",
    name: "Astronomy Engine",
    libraryVersion: ASTRONOMY_ENGINE_VERSION,
    license: "MIT",
    ephemeris:
      "astronomy-engine: truncated VSOP87 planetary theory and the Improved Lunar Ephemeris (Brown) for the Moon; " +
      "apparent geocentric positions (light-time and aberration) on the true ecliptic of date; IAU2000B nutation.",
    ayanamsha:
      "Lahiri (Chitrapaksha): SE_SIDM_LAHIRI constants (23°15′00.658″ true at JD 2435553.5 TT) " +
      "propagated with IAU 1976 general precession; implemented in src/lib/astro/ayanamsha.ts",
    nodeTypes: ["mean", "true"],
    toleranceArcsec: ASTRONOMY_ENGINE_TOLERANCES,
    toleranceSource: TOLERANCE_SOURCE,
  };

  positionsAt(utcMillis: number, options: PositionOptions): InstantPositions {
    if (!Number.isFinite(utcMillis)) throw new RangeError("utcMillis must be finite");
    const time = Astro.MakeTime(new Date(utcMillis));
    const frame = frameAt(time);
    const bodies = {} as Record<BodyId, RawBodyPosition>;

    for (const planet of PLANET_IDS) {
      const { lon, lat } = planetSidereal(planet, time);
      bodies[planet] = {
        body: planet,
        siderealLongitudeDeg: lon,
        latitudeDeg: lat,
        speedDegPerDay: options.withSpeed
          ? centralSpeed((t) => planetSidereal(planet, t).lon, time)
          : null,
      };
    }

    const nodeFn = options.nodeType === "true" ? trueNodeSidereal : meanNodeSidereal;
    const rahu = nodeFn(time);
    const rahuSpeed = options.withSpeed ? centralSpeed(nodeFn, time) : null;
    bodies.Rahu = {
      body: "Rahu",
      siderealLongitudeDeg: rahu,
      latitudeDeg: null,
      speedDegPerDay: rahuSpeed,
    };
    bodies.Ketu = {
      body: "Ketu",
      siderealLongitudeDeg: normalizeDegrees(rahu + 180),
      latitudeDeg: null,
      speedDegPerDay: rahuSpeed,
    };

    return {
      utcMillis,
      julianDayUT: time.ut + 2451545.0,
      julianDayTT: frame.julianDayTT,
      deltaTSeconds: (time.tt - time.ut) * 86_400,
      ayanamshaDeg: frame.ayanamshaDeg,
      bodies,
      engineFlags: [],
    };
  }

  toleranceArcsec(key: ToleranceKey, utcMillis: number): number {
    return astronomyEngineToleranceArcsec(key, utcMillis);
  }

  ascendantAt(utcMillis: number, latitudeDeg: number, longitudeDeg: number): AscendantRaw {
    if (Math.abs(latitudeDeg) > MAX_ASCENDANT_LATITUDE) {
      throw new RangeError("Ascendant is not computed beyond the polar-circle latitude limit");
    }
    const time = Astro.MakeTime(new Date(utcMillis));
    const frame = frameAt(time);
    const gastDeg = Astro.SiderealTime(time) * 15;
    const ramcDeg = normalizeDegrees(gastDeg + longitudeDeg);
    const tropical = ascendantLongitudeDeg(ramcDeg, frame.trueObliquityDeg, latitudeDeg);
    return { siderealLongitudeDeg: toSidereal(tropical, frame), ramcDeg };
  }
}
