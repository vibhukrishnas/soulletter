/**
 * Measures agreement between the production engine (astronomy-engine + the Lahiri
 * implementation in src/lib/astro/ayanamsha.ts) and the independent reference engine
 * (Swiss Ephemeris 2.10.03 via `sweph`, using the official SWIEPH data files), and
 * writes the boundary-sensitivity tolerances used at runtime.
 *
 * Usage:
 *   node tools/reference/download-ephe.mjs           # once; fetches sepl_18.se1 / semo_18.se1
 *   npm run reference:tolerances                     # writes the two JSON files below
 *
 * Outputs:
 *   tools/reference/agreement.json                    full statistics (provenance)
 *   src/server/ephemeris/engine-tolerances.json       per-band tolerances = ceil(max × 1.5), floor 1″
 *
 * Swiss Ephemeris is AGPL-3.0; it is used here only as a local measurement tool.
 */
import fs from "node:fs";
import path from "node:path";
import { signedDeltaDegrees } from "../../src/lib/astro/angles";
import { lahiriMeanAyanamshaDeg } from "../../src/lib/astro/ayanamsha";
import type { BodyId } from "../../src/lib/astro/zodiac";
import { AstronomyEngineProvider } from "../../src/server/ephemeris/astronomy-engine-provider";
import { createSwissProvider } from "../../src/server/ephemeris/swiss-provider";

const args = process.argv.slice(2);
const argValue = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const SAMPLES_PER_BAND = Number(argValue("samples", "3000"));
const MARGIN = 1.5;
const EPHE = path.resolve("tools/reference/ephe");

export const BANDS = [
  { id: "1800-1899", startYear: 1800, endYearExclusive: 1900 },
  { id: "1900-2029", startYear: 1900, endYearExclusive: 2030 },
  { id: "2030-2100", startYear: 2030, endYearExclusive: 2101 },
] as const;

const KEYS = [
  "Sun",
  "Moon",
  "Mercury",
  "Venus",
  "Mars",
  "Jupiter",
  "Saturn",
  "MeanNode",
  "TrueNode",
  "Ascendant",
] as const;

let seed = 0x5eed1e77;
function rand(): number {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 2 ** 32;
}

interface Acc {
  values: number[];
  worst: { utc: string; diffArcsec: number } | null;
}

async function main() {
  for (const f of ["sepl_18.se1", "semo_18.se1"]) {
    if (!fs.existsSync(path.join(EPHE, f))) {
      throw new Error(`Missing ${f}; run: node tools/reference/download-ephe.mjs`);
    }
  }
  const swiss = await createSwissProvider({ licenseMode: "agpl", ephemerisPath: EPHE });
  const ae = new AstronomyEngineProvider();
  const planets: BodyId[] = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"];
  let fallbackSamples = 0;

  const bandReports: Record<string, unknown> = {};
  const tolerances: Record<string, Record<string, number>> = {};

  for (const band of BANDS) {
    const start = Date.UTC(band.startYear, 0, 1);
    const end = Date.UTC(band.endYearExclusive, 0, 1) - 1;
    const acc = new Map<string, Acc>();
    const push = (key: string, diffArcsec: number, t: number) => {
      let a = acc.get(key);
      if (!a) acc.set(key, (a = { values: [], worst: null }));
      const abs = Math.abs(diffArcsec);
      a.values.push(abs);
      if (!a.worst || abs > Math.abs(a.worst.diffArcsec)) {
        a.worst = { utc: new Date(t).toISOString(), diffArcsec };
      }
    };

    for (let i = 0; i < SAMPLES_PER_BAND; i++) {
      const t = Math.round(start + rand() * (end - start));
      const aMean = ae.positionsAt(t, { nodeType: "mean", withSpeed: false });
      const sMean = swiss.positionsAt(t, { nodeType: "mean", withSpeed: false });
      const aTrue = ae.positionsAt(t, { nodeType: "true", withSpeed: false });
      const sTrue = swiss.positionsAt(t, { nodeType: "true", withSpeed: false });
      if ([...sMean.engineFlags, ...sTrue.engineFlags].some((f) => f.ephemerisUsed !== "SWIEPH")) {
        fallbackSamples++;
      }
      for (const b of planets) {
        push(b, signedDeltaDegrees(sMean.bodies[b].siderealLongitudeDeg, aMean.bodies[b].siderealLongitudeDeg) * 3600, t);
      }
      push("MeanNode", signedDeltaDegrees(sMean.bodies.Rahu.siderealLongitudeDeg, aMean.bodies.Rahu.siderealLongitudeDeg) * 3600, t);
      push("TrueNode", signedDeltaDegrees(sTrue.bodies.Rahu.siderealLongitudeDeg, aTrue.bodies.Rahu.siderealLongitudeDeg) * 3600, t);
      push("Ayanamsha", (lahiriMeanAyanamshaDeg(sMean.julianDayTT) - sMean.ayanamshaDeg) * 3600, t);
      push("DeltaTSeconds", aMean.deltaTSeconds - sMean.deltaTSeconds, t);
      const lat = -66 + rand() * 132;
      const lon = -180 + rand() * 360;
      push(
        "Ascendant",
        signedDeltaDegrees(swiss.ascendantAt(t, lat, lon).siderealLongitudeDeg, ae.ascendantAt(t, lat, lon).siderealLongitudeDeg) * 3600,
        t,
      );
    }

    const stats: Record<string, unknown> = {};
    const tol: Record<string, number> = {};
    for (const [key, a] of acc) {
      const sorted = [...a.values].sort((x, y) => x - y);
      const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
      const max = sorted[sorted.length - 1];
      stats[key] = {
        unit: key === "DeltaTSeconds" ? "seconds" : "arcseconds",
        max: Number(max.toFixed(4)),
        p99: Number(pct(0.99).toFixed(4)),
        p50: Number(pct(0.5).toFixed(4)),
        worst: a.worst,
      };
      if ((KEYS as readonly string[]).includes(key)) {
        tol[key] = Math.max(1, Math.ceil(max * MARGIN));
      }
    }
    bandReports[band.id] = { samples: SAMPLES_PER_BAND, stats };
    tolerances[band.id] = tol;
  }

  const meta = {
    generatedAt: new Date().toISOString(),
    method:
      "Signed difference (astronomy-engine provider − Swiss Ephemeris SWIEPH) of sidereal Lahiri longitudes at " +
      "deterministic pseudo-random instants (LCG seed 0x5eed1e77); Ascendant at random latitudes |φ| ≤ 66°. " +
      `Tolerance = ceil(max |Δ| × ${MARGIN}), minimum 1″.`,
    productionEngine: `astronomy-engine ${ae.info.libraryVersion}`,
    referenceEngine: swiss.info.libraryVersion,
    referenceEphemerisFiles: ["sepl_18.se1", "semo_18.se1"],
    referenceFallbackSamples: fallbackSamples,
    samplesPerBand: SAMPLES_PER_BAND,
  };
  fs.writeFileSync(
    "tools/reference/agreement.json",
    JSON.stringify({ ...meta, bands: bandReports }, null, 2) + "\n",
  );
  fs.writeFileSync(
    "src/server/ephemeris/engine-tolerances.json",
    JSON.stringify(
      {
        ...meta,
        bands: BANDS.map((b) => ({ ...b, toleranceArcsec: tolerances[b.id] })),
      },
      null,
      2,
    ) + "\n",
  );
  for (const b of BANDS) console.log(b.id, JSON.stringify(tolerances[b.id]));
  console.log("reference fallback samples:", fallbackSamples);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
