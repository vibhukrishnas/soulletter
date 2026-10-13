/**
 * Angle helpers. All functions keep full IEEE-754 precision; rounding happens
 * only in explicit display formatters.
 */

export const ARCSEC_PER_DEGREE = 3600;

/** Throws on NaN/Infinity so invalid numbers can never flow into a chart. */
export function assertFinite(value: number, label = "value"): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RangeError(`${label} must be a finite number`);
  }
}

/** Normalizes an angle to the half-open range [0, 360). */
export function normalizeDegrees(value: number): number {
  assertFinite(value, "angle");
  let r = value % 360;
  if (r < 0) r += 360;
  // `-1e-17 % 360 + 360` rounds to exactly 360 in binary floating point.
  if (r >= 360) r -= 360;
  // Normalize negative zero.
  return r === 0 ? 0 : r;
}

/** Signed shortest difference `to - from` in degrees, in the range (-180, 180]. */
export function signedDeltaDegrees(from: number, to: number): number {
  let d = normalizeDegrees(to) - normalizeDegrees(from);
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

export interface Dms {
  degrees: number;
  minutes: number;
  /** Seconds, rounded to the requested precision for display. */
  seconds: number;
}

/**
 * Splits a non-negative angle into degrees, minutes and seconds for display.
 * Rounding carries correctly (59.9996″ never displays as 60″).
 */
export function toDms(value: number, secondDecimals = 1): Dms {
  assertFinite(value, "angle");
  const sign = value < 0 ? -1 : 1;
  const factor = 10 ** secondDecimals;
  const totalUnits = Math.round(Math.abs(value) * 3600 * factor);
  const unitsPerMinute = 60 * factor;
  const unitsPerDegree = 3600 * factor;
  const degrees = Math.floor(totalUnits / unitsPerDegree);
  const minutes = Math.floor((totalUnits - degrees * unitsPerDegree) / unitsPerMinute);
  const seconds = (totalUnits - degrees * unitsPerDegree - minutes * unitsPerMinute) / factor;
  return { degrees: sign * degrees, minutes, seconds };
}

/** Formats e.g. `20°06′53.8″`. */
export function formatDms(value: number, secondDecimals = 1): string {
  const { degrees, minutes, seconds } = toDms(value, secondDecimals);
  const mm = String(minutes).padStart(2, "0");
  const [whole, frac] = seconds.toFixed(secondDecimals).split(".");
  const ss = whole.padStart(2, "0") + (frac ? `.${frac}` : "");
  return `${degrees}°${mm}′${ss}″`;
}

/** Formats an arc length in arcseconds into the most readable unit. */
export function formatArc(arcsec: number): string {
  const a = Math.abs(arcsec);
  if (a < 60) return `${a.toFixed(a < 10 ? 2 : 1)}″`;
  if (a < 3600) return `${(a / 60).toFixed(1)}′`;
  return `${(a / 3600).toFixed(2)}°`;
}
