import { normalizeDegrees } from "./angles";
import { DAYS_PER_JULIAN_CENTURY, J2000_JD } from "./ayanamsha";

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

/**
 * Tropical ecliptic longitude of the Ascendant (degrees, same equinox as the inputs).
 *
 *   λ_asc = atan2( cos θ, −(sin θ · cos ε + tan φ · sin ε) )
 *
 * θ = right ascension of the meridian (local sidereal time in degrees),
 * ε = obliquity of the ecliptic, φ = geographic latitude.
 * With apparent sidereal time and true obliquity the result is referred to the
 * true equinox of date. (Meeus, Astronomical Algorithms; Swiss Ephemeris `Asc1`.)
 */
export function ascendantLongitudeDeg(
  ramcDeg: number,
  obliquityDeg: number,
  latitudeDeg: number,
): number {
  const th = ramcDeg * D2R;
  const eps = obliquityDeg * D2R;
  const phi = latitudeDeg * D2R;
  const y = Math.cos(th);
  const x = -(Math.sin(th) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps));
  return normalizeDegrees(Math.atan2(y, x) * R2D);
}

/**
 * Mean longitude of the Moon's ascending node, referred to the mean equinox of date
 * (Meeus, Astronomical Algorithms, 2nd ed., eq. 47.7; T in Julian centuries TT).
 */
export function meanLunarNodeLongitudeDeg(julianDayTT: number): number {
  const t = (julianDayTT - J2000_JD) / DAYS_PER_JULIAN_CENTURY;
  const omega =
    125.0445479 -
    1934.1362891 * t +
    0.0020754 * t * t +
    (t * t * t) / 467441 -
    (t * t * t * t) / 60616000;
  return normalizeDegrees(omega);
}

/**
 * Longitude of the ascending node of the instantaneous (osculating) orbit defined by a
 * geocentric position/velocity pair expressed in an ecliptic frame: n = ẑ × (r × v).
 */
export function osculatingNodeLongitudeDeg(
  r: readonly [number, number, number],
  v: readonly [number, number, number],
): number {
  const hx = r[1] * v[2] - r[2] * v[1];
  const hy = r[2] * v[0] - r[0] * v[2];
  return normalizeDegrees(Math.atan2(hx, -hy) * R2D);
}
