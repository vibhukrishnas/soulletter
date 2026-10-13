import measured from "./engine-tolerances.json";
import type { ToleranceKey } from "./types";

/**
 * Boundary-sensitivity tolerances.
 *
 * astronomy-engine: measured against Swiss Ephemeris (SWIEPH data files) by
 * tools/reference/measure-engine-agreement.ts; values are ceil(max |Δ| × 1.5) per date
 * band, so a placement closer than this to a boundary may differ between engines.
 *
 * Swiss Ephemeris: nominal 1″ (its SWIEPH files reproduce JPL DE ephemerides to
 * ~0.001″; the 1″ figure is a conservative allowance for model differences such as
 * ΔT and nutation).
 */

export interface ToleranceBand {
  id: string;
  startYear: number;
  endYearExclusive: number;
  toleranceArcsec: Record<ToleranceKey, number>;
}

export const MEASURED_AGREEMENT = measured as unknown as {
  generatedAt: string;
  method: string;
  productionEngine: string;
  referenceEngine: string;
  referenceEphemerisFiles: string[];
  referenceFallbackSamples: number;
  samplesPerBand: number;
  bands: ToleranceBand[];
};

export const TOLERANCE_SOURCE =
  `Measured ${MEASURED_AGREEMENT.generatedAt.slice(0, 10)} against ${MEASURED_AGREEMENT.referenceEngine} ` +
  `(${MEASURED_AGREEMENT.samplesPerBand} samples per date band); see tools/reference/agreement.json`;

function bandFor(year: number): ToleranceBand {
  const bands = MEASURED_AGREEMENT.bands;
  return (
    bands.find((b) => year >= b.startYear && year < b.endYearExclusive) ??
    (year < bands[0].startYear ? bands[0] : bands[bands.length - 1])
  );
}

/** Measured astronomy-engine tolerance for a quantity at a given UTC instant. */
export function astronomyEngineToleranceArcsec(key: ToleranceKey, utcMillis: number): number {
  return bandFor(new Date(utcMillis).getUTCFullYear()).toleranceArcsec[key];
}

/** Worst-case (all bands) astronomy-engine tolerances, for metadata display. */
export const ASTRONOMY_ENGINE_TOLERANCES: Readonly<Record<ToleranceKey, number>> = (() => {
  const out = {} as Record<ToleranceKey, number>;
  for (const band of MEASURED_AGREEMENT.bands) {
    for (const [k, v] of Object.entries(band.toleranceArcsec) as [ToleranceKey, number][]) {
      out[k] = Math.max(out[k] ?? 0, v);
    }
  }
  return out;
})();

export const SWISS_EPHEMERIS_TOLERANCES: Readonly<Record<ToleranceKey, number>> = {
  Sun: 1,
  Moon: 1,
  Mercury: 1,
  Venus: 1,
  Mars: 1,
  Jupiter: 1,
  Saturn: 1,
  MeanNode: 1,
  TrueNode: 1,
  Ascendant: 1,
};
