/**
 * Lahiri (Chitrapaksha) ayanamsha, matching Swiss Ephemeris 2.10 `SE_SIDM_LAHIRI`.
 *
 * Definition (Swiss Ephemeris sweph.h, "1: Standard Lahiri", derived from the
 * Calendar Reform Committee 1956 / Indian Astronomical Ephemeris 1989 p. 556):
 *   - Reference epoch t0 = JD 2435553.5 TT (1956-03-21 00:00 TT).
 *   - True ayanamsha at t0 = 23.250182778° (23°15′00.658″); nutation at t0 = 0.004658035°,
 *     so the MEAN ayanamsha at t0 is 23.245524743°.
 *   - The definition is tied to the IAU 1976 precession (`SEMOD_PREC_IAU_1976`). Swiss
 *     Ephemeris anchors the value at J2000 with IAU 1976 precession from t0, then
 *     propagates with its current default precession model (`get_aya_correction()` in
 *     sweph.c). Near the present this is the IAU 2006 (Capitaine et al. 2003) model.
 *
 * Therefore:
 *   A(t) = A_mean(t0) + [p76(J2000) − p76(t0)] + p06(t)
 * with p76 the IAU 1976 general precession in longitude (Lieske et al. 1977) and p06
 * the IAU 2006 general precession in longitude p_A (Capitaine et al. 2003, eq. 39),
 * both in arcseconds as polynomials of T, Julian centuries TT from J2000.0.
 *
 * Sidereal longitudes are formed as (longitude on the MEAN equinox of date) − A(t),
 * equivalently (true-equinox longitude) − (A(t) + nutation in longitude). This equals
 * Swiss Ephemeris' traditional sidereal method (no SE_SIDBIT options).
 *
 * Agreement with Swiss Ephemeris 2.10.03 is measured in tools/reference/agreement.json
 * and asserted by the reference test-suite.
 */

export const J2000_JD = 2451545.0;
export const DAYS_PER_JULIAN_CENTURY = 36525;

export const LAHIRI_T0_JD_TT = 2435553.5;
export const LAHIRI_TRUE_AYANAMSHA_AT_T0_DEG = 23.250182778;
export const LAHIRI_NUTATION_AT_T0_DEG = 0.004658035;
export const LAHIRI_MEAN_AYANAMSHA_AT_T0_DEG =
  LAHIRI_TRUE_AYANAMSHA_AT_T0_DEG - LAHIRI_NUTATION_AT_T0_DEG;

export function julianCenturiesTT(julianDayTT: number): number {
  return (julianDayTT - J2000_JD) / DAYS_PER_JULIAN_CENTURY;
}

/** IAU 1976 general precession in longitude since J2000.0 (arcseconds). */
export function precessionIau1976Arcsec(t: number): number {
  return 5029.0966 * t + 1.11113 * t * t - 0.000006 * t * t * t;
}

/** IAU 2006 (P03) general precession in longitude p_A since J2000.0 (arcseconds). */
export function precessionIau2006Arcsec(t: number): number {
  return (
    5028.796195 * t +
    1.1054348 * t ** 2 +
    0.00007964 * t ** 3 -
    0.000023857 * t ** 4 -
    0.0000000383 * t ** 5
  );
}

/** Mean Lahiri ayanamsha at J2000.0 implied by the 1956 definition (degrees). */
export const LAHIRI_MEAN_AYANAMSHA_AT_J2000_DEG =
  LAHIRI_MEAN_AYANAMSHA_AT_T0_DEG -
  precessionIau1976Arcsec(julianCenturiesTT(LAHIRI_T0_JD_TT)) / 3600;

/** Mean Lahiri ayanamsha (degrees) at a Julian Day in Terrestrial Time. */
export function lahiriMeanAyanamshaDeg(julianDayTT: number): number {
  return (
    LAHIRI_MEAN_AYANAMSHA_AT_J2000_DEG +
    precessionIau2006Arcsec(julianCenturiesTT(julianDayTT)) / 3600
  );
}
