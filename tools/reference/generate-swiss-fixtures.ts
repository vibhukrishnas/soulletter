/**
 * Generates frozen Swiss Ephemeris reference fixtures for the test-suite.
 *
 *   node tools/reference/download-ephe.mjs
 *   npm run reference:fixtures
 *
 * Output: tests/reference/fixtures/swiss-reference.json
 *
 * Each case records the engine version, the RETURNED flags (proving SWIEPH data files
 * were used, not the Moshier fallback), sidereal (SE_SIDM_LAHIRI) and tropical apparent
 * longitudes, mean/true nodes, the whole-sign Ascendant and the mean ayanamsha.
 * Swiss Ephemeris is AGPL-3.0; it is used only to produce these numbers locally.
 */
import fs from "node:fs";
import path from "node:path";
import { loadSweph } from "../../src/server/ephemeris/swiss-provider";

const EPHE = path.resolve("tools/reference/ephe");
const OUT = path.resolve("tests/reference/fixtures/swiss-reference.json");

interface CaseInput {
  id: string;
  utc: string;
  latitude: number;
  longitude: number;
  note: string;
}

const CASES: CaseInput[] = [
  {
    id: "delhi-1990-10-15-1430-IST",
    utc: "1990-10-15T09:00:00Z",
    latitude: 28.6139,
    longitude: 77.209,
    note: "Audit reference case: 1990-10-15 14:30 Asia/Kolkata (UTC+05:30), New Delhi.",
  },
  {
    id: "delhi-1943-06-01-1200-war-time",
    utc: "1943-06-01T05:30:00Z",
    latitude: 28.6139,
    longitude: 77.209,
    note: "Historical offset: 12:00 local in Asia/Kolkata during WWII used UTC+06:30.",
  },
  {
    id: "new-york-2021-11-07-0130-edt",
    utc: "2021-11-07T05:30:00Z",
    latitude: 40.7128,
    longitude: -74.006,
    note: "Ambiguous local time: first occurrence of 01:30 (EDT, UTC−04:00).",
  },
  {
    id: "southern-hemisphere-sydney",
    utc: "2005-01-20T02:15:00Z",
    latitude: -33.8688,
    longitude: 151.2093,
    note: "Southern-hemisphere Ascendant.",
  },
  {
    id: "high-latitude-reykjavik",
    utc: "1985-06-21T12:00:00Z",
    latitude: 64.1466,
    longitude: -21.9426,
    note: "High latitude (below the 66° Ascendant limit).",
  },
];

// Deterministic sample instants across 1900–2029 for broad comparison.
let seed = 0xc0ffee;
const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
for (let i = 0; i < 40; i++) {
  const t = Date.UTC(1900, 0, 1) + rand() * (Date.UTC(2030, 0, 1) - Date.UTC(1900, 0, 1));
  CASES.push({
    id: `sample-${String(i + 1).padStart(2, "0")}`,
    utc: new Date(Math.round(t / 1000) * 1000).toISOString().replace(".000Z", "Z"),
    latitude: Number((-60 + rand() * 120).toFixed(4)),
    longitude: Number((-180 + rand() * 360).toFixed(4)),
    note: "Deterministic pseudo-random sample (LCG seed 0xc0ffee).",
  });
}

const BODY_CODES: [string, string][] = [
  ["Sun", "SE_SUN"],
  ["Moon", "SE_MOON"],
  ["Mercury", "SE_MERCURY"],
  ["Venus", "SE_VENUS"],
  ["Mars", "SE_MARS"],
  ["Jupiter", "SE_JUPITER"],
  ["Saturn", "SE_SATURN"],
  ["MeanNode", "SE_MEAN_NODE"],
  ["TrueNode", "SE_TRUE_NODE"],
];

async function main() {
  const sweph = await loadSweph();
  const C = sweph.constants;
  sweph.set_ephe_path(EPHE);
  sweph.set_sid_mode(C.SE_SIDM_LAHIRI, 0, 0);

  const cases = CASES.map((c) => {
    const d = new Date(c.utc);
    const jd = sweph.utc_to_jd(
      d.getUTCFullYear(),
      d.getUTCMonth() + 1,
      d.getUTCDate(),
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds(),
      C.SE_GREG_CAL,
    );
    const [jdTt, jdUt] = jd.data;
    const bodies: Record<string, unknown> = {};
    for (const [name, code] of BODY_CODES) {
      const sid = sweph.calc_ut(jdUt, C[code], C.SEFLG_SWIEPH | C.SEFLG_SIDEREAL | C.SEFLG_SPEED);
      const trop = sweph.calc_ut(jdUt, C[code], C.SEFLG_SWIEPH | C.SEFLG_SPEED);
      if ((sid.flag & C.SEFLG_SWIEPH) === 0 || (trop.flag & C.SEFLG_SWIEPH) === 0) {
        throw new Error(`${c.id} ${name}: SWIEPH not used (flags ${sid.flag}/${trop.flag})`);
      }
      bodies[name] = {
        siderealLongitudeDeg: sid.data[0],
        tropicalApparentLongitudeDeg: trop.data[0],
        latitudeDeg: sid.data[1],
        speedDegPerDay: sid.data[3],
        returnedFlags: sid.flag,
      };
    }
    const houses = sweph.houses_ex2(jdUt, C.SEFLG_SIDEREAL, c.latitude, c.longitude, "W");
    return {
      ...c,
      jdUt,
      jdTt,
      ayanamshaMeanDeg: sweph.get_ayanamsa_ex_ut(jdUt, C.SEFLG_SWIEPH | C.SEFLG_NONUT).data,
      ayanamshaTrueDeg: sweph.get_ayanamsa_ex_ut(jdUt, C.SEFLG_SWIEPH).data,
      ascendantSiderealDeg: houses.data.points[0],
      ramcDeg: houses.data.points[2],
      bodies,
    };
  });

  const out = {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    engine: `Swiss Ephemeris ${sweph.version()} via npm sweph`,
    ephemerisFiles: ["sepl_18.se1", "semo_18.se1"],
    settings: {
      siderealMode: "SE_SIDM_LAHIRI (traditional sidereal method, no SE_SIDBIT options)",
      flags: "SEFLG_SWIEPH | SEFLG_SIDEREAL | SEFLG_SPEED (sidereal); SEFLG_SWIEPH | SEFLG_SPEED (tropical apparent, true equinox)",
      houses: "houses_ex2(..., SEFLG_SIDEREAL, lat, lon, 'W') — whole sign",
      utcConversion: "swe_utc_to_jd (UTC with leap seconds → TT and UT1)",
    },
    license: "Values generated with AGPL-3.0 Swiss Ephemeris for local verification only.",
    cases,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log(`wrote ${cases.length} cases to ${path.relative(process.cwd(), OUT)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
