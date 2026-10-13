/**
 * Astronomical reference tests.
 *
 * Independent references:
 *  1. Swiss Ephemeris 2.10.03 with SWIEPH data files (frozen fixtures, returned flags
 *     prove the data files were used) — tests/reference/fixtures/swiss-reference.json.
 *  2. NASA/JPL Horizons apparent geocentric ecliptic longitudes (true equinox of date)
 *     — tools/reference/horizons/horizons_reference.json.
 *  3. Published panchang timings for the Moon in Purva Phalguni on 1990-10-15 (IST).
 *
 * Tolerances are the measured, documented values in engine-tolerances.json — nothing is
 * forced to match.
 */
import fs from "node:fs";
import path from "node:path";
import * as Astro from "astronomy-engine";
import { describe, expect, it } from "vitest";
import { signedDeltaDegrees } from "@/lib/astro/angles";
import { padaIndexOf, placementOf, type BodyId } from "@/lib/astro/zodiac";
import { computeChart } from "@/server/chart/compute-chart";
import { buildTimeContext, normalizeBirth } from "@/server/chart/time-context";
import { ASTRONOMY_ENGINE_VERSION, AstronomyEngineProvider } from "@/server/ephemeris/astronomy-engine-provider";
import { astronomyEngineToleranceArcsec } from "@/server/ephemeris/engine-tolerances";
import type { ToleranceKey } from "@/server/ephemeris/types";
import swiss from "./fixtures/swiss-reference.json";
import horizons from "../../tools/reference/horizons/horizons_reference.json";

const provider = new AstronomyEngineProvider();
const PLANETS = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"] as const;
const arcsec = (a: number, b: number) => Math.abs(signedDeltaDegrees(a, b) * 3600);

describe("engine provenance", () => {
  it("pins the astronomy-engine version actually installed", () => {
    const installed = JSON.parse(
      fs.readFileSync(path.resolve("node_modules/astronomy-engine/package.json"), "utf8"),
    ).version;
    const pinned = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8")).dependencies["astronomy-engine"];
    expect(installed).toBe(ASTRONOMY_ENGINE_VERSION);
    expect(pinned).toBe(ASTRONOMY_ENGINE_VERSION);
  });

  it("uses fixtures generated with Swiss Ephemeris data files, not the Moshier fallback", () => {
    expect(swiss.engine).toMatch(/2\.10\.03/);
    for (const c of swiss.cases) {
      for (const b of Object.values(c.bodies)) {
        // SEFLG_SWIEPH = 2; SEFLG_MOSEPH = 4
        expect(b.returnedFlags & 2).toBe(2);
        expect(b.returnedFlags & 4).toBe(0);
      }
    }
  });
});

describe("production engine vs Swiss Ephemeris (SE_SIDM_LAHIRI)", () => {
  it.each(swiss.cases.map((c) => [c.id, c] as const))("%s", (_id, c) => {
    const t = Date.parse(c.utc);
    const mean = provider.positionsAt(t, { nodeType: "mean", withSpeed: false });
    const tru = provider.positionsAt(t, { nodeType: "true", withSpeed: false });

    // Julian Day: engine (UTC≈UT1) vs Swiss (UT1 from leap-second tables) within 1 s.
    expect(Math.abs(mean.julianDayUT - c.jdUt) * 86400).toBeLessThan(1);
    // Ayanamsha definition reproduces SE_SIDM_LAHIRI.
    expect(Math.abs(mean.ayanamshaDeg - c.ayanamshaMeanDeg) * 3600).toBeLessThan(0.05);

    for (const body of PLANETS) {
      const tol = astronomyEngineToleranceArcsec(body as ToleranceKey, t);
      expect(arcsec(mean.bodies[body as BodyId].siderealLongitudeDeg, c.bodies[body].siderealLongitudeDeg), body).toBeLessThanOrEqual(tol);
    }
    expect(arcsec(mean.bodies.Rahu.siderealLongitudeDeg, c.bodies.MeanNode.siderealLongitudeDeg)).toBeLessThanOrEqual(
      astronomyEngineToleranceArcsec("MeanNode", t),
    );
    expect(arcsec(tru.bodies.Rahu.siderealLongitudeDeg, c.bodies.TrueNode.siderealLongitudeDeg)).toBeLessThanOrEqual(
      astronomyEngineToleranceArcsec("TrueNode", t),
    );
    const asc = provider.ascendantAt(t, c.latitude, c.longitude);
    expect(arcsec(asc.siderealLongitudeDeg, c.ascendantSiderealDeg)).toBeLessThanOrEqual(astronomyEngineToleranceArcsec("Ascendant", t));
  });

  it("agrees on sign/Nakshatra/Pada for every planet unless it is within tolerance of a boundary", () => {
    let compared = 0;
    for (const c of swiss.cases) {
      const t = Date.parse(c.utc);
      const pos = provider.positionsAt(t, { nodeType: "mean", withSpeed: false });
      for (const body of PLANETS) {
        const ours = pos.bodies[body as BodyId].siderealLongitudeDeg;
        const ref = c.bodies[body].siderealLongitudeDeg;
        const nearBoundary = placementOf(ref).boundaries.nearestPadaBoundaryArcsec <= astronomyEngineToleranceArcsec(body as ToleranceKey, t);
        if (!nearBoundary) {
          expect(padaIndexOf(ours), `${c.id} ${body}`).toBe(padaIndexOf(ref));
          compared++;
        }
      }
    }
    expect(compared).toBeGreaterThan(300);
  });
});

describe("production engine vs JPL Horizons (apparent, true equinox of date)", () => {
  it("matches every Horizons longitude within the measured tolerance", () => {
    expect(horizons.positions.length).toBe(35);
    for (const row of horizons.positions) {
      const t = Date.parse(row.utc);
      const time = Astro.MakeTime(new Date(t));
      const pos = provider.positionsAt(t, { nodeType: "mean", withSpeed: false });
      const tilt = Astro.e_tilt(time);
      // Our sidereal value + mean ayanamsha + nutation in longitude = apparent true-equinox longitude.
      const tropical = pos.bodies[row.body as BodyId].siderealLongitudeDeg + pos.ayanamshaDeg + tilt.dpsi / 3600;
      const tol = astronomyEngineToleranceArcsec(row.body as ToleranceKey, t);
      expect(arcsec(tropical, row.eclipticLongitudeDeg), `${row.utc} ${row.body}`).toBeLessThanOrEqual(tol);
    }
  });

  it("confirms the reference engine itself: Swiss Ephemeris tropical longitudes agree with Horizons to < 1″", () => {
    const ref = swiss.cases.find((c) => c.id === "delhi-1990-10-15-1430-IST")!;
    for (const row of horizons.positions.filter((p) => p.utc.startsWith("1990-10-15T09:00"))) {
      const s = (ref.bodies as Record<string, { tropicalApparentLongitudeDeg: number }>)[row.body];
      expect(arcsec(s.tropicalApparentLongitudeDeg, row.eclipticLongitudeDeg), row.body).toBeLessThan(1);
    }
  });
});

describe("reference case: 1990-10-15 14:30 Asia/Kolkata, New Delhi (28.6139 N, 77.2090 E)", () => {
  const birth = normalizeBirth({
    birthDate: "1990-10-15",
    birthTimeKnown: true,
    birthTime: "14:30",
    birthTimeAccuracy: "to_the_minute",
    dstChoice: null,
    place: { label: "New Delhi", latitude: 28.6139, longitude: 77.209, timeZone: "Asia/Kolkata" },
  });
  const ctx = buildTimeContext(birth);
  if (!ctx.ok) throw new Error("reference context failed");
  const chart = computeChart({
    birth,
    ctx: ctx.ctx,
    settings: { zodiac: "sidereal", ayanamsha: "lahiri", chart: "D1", houseSystem: "whole_sign", nodeType: "mean", charaKarakaScheme: "seven_planet" },
    provider,
  });
  const ref = swiss.cases.find((c) => c.id === "delhi-1990-10-15-1430-IST")!;
  const body = (b: BodyId) => chart.bodies.find((x) => x.body === b)!;

  it("converts to 09:00 UTC (+05:30) and Julian Day 2448179.875", () => {
    expect(chart.time.birthUtc).toBe("1990-10-15T09:00:00Z");
    expect(chart.time.utcOffset).toBe("+05:30");
    expect(chart.time.julianDayUT).toBe(2448179.875);
  });

  it("puts the Moon in Leo, Purva Phalguni Pada 3 — matching Swiss Ephemeris", () => {
    const moon = body("Moon").atBirth!;
    expect([moon.signName, moon.nakshatraName, moon.pada]).toEqual(["Leo", "Purva Phalguni", 3]);
    expect(arcsec(moon.longitudeDeg, ref.bodies.Moon.siderealLongitudeDeg)).toBeLessThan(2);
    expect(body("Moon").boundarySensitive).toBe(false);
  });

  it("matches published panchang Moon timings (IST)", () => {
    // Prokerala (Lahiri): Purva Phalguni from 15 Oct 01:52 to 16 Oct 02:46.
    // Drik Panchang (as quoted in the audit package; page not re-fetched — CAPTCHA): Pada changes ~08:05, 14:17, 20:32.
    const unknown = normalizeBirth({
      birthDate: "1990-10-15",
      birthTimeKnown: false,
      birthTime: null,
      birthTimeAccuracy: null,
      dstChoice: null,
      place: { label: null, latitude: null, longitude: null, timeZone: "Asia/Kolkata" },
    });
    const day = buildTimeContext(unknown);
    if (!day.ok) throw new Error();
    const dayChart = computeChart({ birth: unknown, ctx: day.ctx, settings: chart.settings, provider });
    const segs = dayChart.bodies.find((b) => b.body === "Moon")!.window.segments;
    const start = (n: string, p: number) => segs.find((s) => s.value.nakshatraName === n && s.value.pada === p)?.fromLocal;
    const minutes = (hhmm: string) => Number(hhmm.slice(11, 13)) * 60 + Number(hhmm.slice(14, 16));
    expect(Math.abs(minutes(start("Purva Phalguni", 1)!) - minutes("1990-10-15 01:52"))).toBeLessThanOrEqual(1);
    expect(Math.abs(minutes(start("Purva Phalguni", 2)!) - minutes("1990-10-15 08:05"))).toBeLessThanOrEqual(2);
    expect(Math.abs(minutes(start("Purva Phalguni", 3)!) - minutes("1990-10-15 14:17"))).toBeLessThanOrEqual(2);
    expect(Math.abs(minutes(start("Purva Phalguni", 4)!) - minutes("1990-10-15 20:32"))).toBeLessThanOrEqual(2);

    // End of Purva Phalguni on 16 Oct: scan the next day's window.
    const nextBirth = { ...unknown, date: { year: 1990, month: 10, day: 16 }, dateIso: "1990-10-16" };
    const nd = buildTimeContext(nextBirth);
    if (!nd.ok) throw new Error();
    const nextChart = computeChart({ birth: nextBirth, ctx: nd.ctx, settings: chart.settings, provider });
    const uttara = nextChart.bodies.find((b) => b.body === "Moon")!.window.segments.find((s) => s.value.nakshatraName === "Uttara Phalguni");
    expect(Math.abs(minutes(uttara!.fromLocal) - minutes("1990-10-16 02:46"))).toBeLessThanOrEqual(1);
  });

  it("puts the Ascendant in Capricorn (Swiss Ephemeris agrees) → 7th sign Cancer, lord Moon", () => {
    expect(chart.ascendant?.atBirth.signName).toBe("Capricorn");
    expect(arcsec(chart.ascendant!.atBirth.longitudeDeg, ref.ascendantSiderealDeg)).toBeLessThan(10);
    expect(chart.seventhHouse?.atBirth).toMatchObject({ seventhSignName: "Cancer", lord: "Moon", lordNakshatraName: "Purva Phalguni", lordPada: 3 });
  });

  it("finds Jupiter as Darakaraka (seven-planet) and marks its Pada boundary-sensitive", () => {
    expect(chart.charaKarakas.atBirth?.darakaraka.body).toBe("Jupiter");
    expect(chart.charaKarakas.atBirth?.tie).toBe(false);
    const jupiter = body("Jupiter");
    // The two engines straddle the Pushya/Ashlesha boundary (106°40′): this engine ≈0.4″ before it,
    // Swiss Ephemeris ≈1.1″ after it. Neither is asserted as the golden Pada.
    expect(jupiter.atBirth!.nearestPadaBoundaryArcsec).toBeLessThan(2);
    expect(placementOf(ref.bodies.Jupiter.siderealLongitudeDeg).boundaries.nearestPadaBoundaryArcsec).toBeLessThan(2);
    expect(jupiter.boundarySensitive).toBe(true);
  });
});

describe("optional live cross-check with Swiss Ephemeris (requires sweph + data files)", () => {
  const ephe = path.resolve("tools/reference/ephe");
  const available = fs.existsSync(path.join(ephe, "sepl_18.se1")) && fs.existsSync(path.join(ephe, "semo_18.se1"));

  it.skipIf(!available)("agrees within tolerance over 300 additional instants", async () => {
    const { createSwissProvider } = await import("@/server/ephemeris/swiss-provider");
    const sw = await createSwissProvider({ licenseMode: "agpl", ephemerisPath: ephe });
    let seed = 0xbada55;
    const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
    for (let i = 0; i < 300; i++) {
      const t = Math.round(Date.UTC(1900, 0, 1) + rand() * (Date.UTC(2030, 0, 1) - Date.UTC(1900, 0, 1)));
      const a = provider.positionsAt(t, { nodeType: "mean", withSpeed: false });
      const s = sw.positionsAt(t, { nodeType: "mean", withSpeed: false });
      expect(s.engineFlags.every((f) => f.ephemerisUsed === "SWIEPH")).toBe(true);
      for (const b of PLANETS) {
        expect(arcsec(a.bodies[b as BodyId].siderealLongitudeDeg, s.bodies[b as BodyId].siderealLongitudeDeg)).toBeLessThanOrEqual(
          astronomyEngineToleranceArcsec(b as ToleranceKey, t),
        );
      }
    }
  });
});
