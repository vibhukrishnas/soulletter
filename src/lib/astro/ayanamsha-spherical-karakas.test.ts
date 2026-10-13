import { describe, expect, it } from "vitest";
import {
  LAHIRI_MEAN_AYANAMSHA_AT_J2000_DEG,
  LAHIRI_MEAN_AYANAMSHA_AT_T0_DEG,
  LAHIRI_T0_JD_TT,
  lahiriMeanAyanamshaDeg,
  precessionIau1976Arcsec,
  precessionIau2006Arcsec,
} from "./ayanamsha";
import { rankCharaKarakas, rankingDegree } from "./karakas";
import { ascendantLongitudeDeg, meanLunarNodeLongitudeDeg, osculatingNodeLongitudeDeg } from "./spherical";
import fixtures from "../../../tests/reference/fixtures/swiss-reference.json";

describe("Lahiri ayanamsha", () => {
  it("uses the Swiss Ephemeris SE_SIDM_LAHIRI constants", () => {
    expect(LAHIRI_T0_JD_TT).toBe(2435553.5);
    expect(LAHIRI_MEAN_AYANAMSHA_AT_T0_DEG).toBeCloseTo(23.250182778 - 0.004658035, 12);
  });

  it("anchors J2000 with IAU 1976 precession from 1956", () => {
    const t0 = (LAHIRI_T0_JD_TT - 2451545) / 36525;
    expect(LAHIRI_MEAN_AYANAMSHA_AT_J2000_DEG).toBeCloseTo(
      LAHIRI_MEAN_AYANAMSHA_AT_T0_DEG - precessionIau1976Arcsec(t0) / 3600,
      12,
    );
    expect(lahiriMeanAyanamshaDeg(2451545)).toBeCloseTo(LAHIRI_MEAN_AYANAMSHA_AT_J2000_DEG, 12);
  });

  it("matches Swiss Ephemeris SE_SIDM_LAHIRI (mean) to < 0.01″ for every fixture case", () => {
    for (const c of fixtures.cases) {
      const diffArcsec = (lahiriMeanAyanamshaDeg(c.jdTt) - c.ayanamshaMeanDeg) * 3600;
      expect(Math.abs(diffArcsec), c.id).toBeLessThan(0.01);
    }
  });

  it("grows by about 50.29″ per year", () => {
    const perYear = (lahiriMeanAyanamshaDeg(2451545 + 365.25) - lahiriMeanAyanamshaDeg(2451545)) * 3600;
    expect(perYear).toBeGreaterThan(50.2);
    expect(perYear).toBeLessThan(50.4);
  });

  it("IAU 2006 and IAU 1976 precession agree to ~0.3″ per century", () => {
    expect(Math.abs(precessionIau2006Arcsec(1) - precessionIau1976Arcsec(1))).toBeLessThan(0.31);
  });
});

describe("Ascendant formula", () => {
  it("puts 0° Cancer rising when 0° Aries culminates at the equator", () => {
    expect(ascendantLongitudeDeg(0, 23.44, 0)).toBeCloseTo(90, 9);
  });

  it("puts 0° Libra rising when 0° Cancer culminates at the equator", () => {
    expect(ascendantLongitudeDeg(90, 23.44, 0)).toBeCloseTo(180, 9);
  });

  it("is always within 180° east of the meridian's ecliptic point", () => {
    for (let ramc = 0; ramc < 360; ramc += 7.5) {
      for (const lat of [-60, -30, 0, 28.6, 51.5, 64]) {
        const asc = ascendantLongitudeDeg(ramc, 23.44, lat);
        expect(asc).toBeGreaterThanOrEqual(0);
        expect(asc).toBeLessThan(360);
      }
    }
  });
});

describe("lunar nodes", () => {
  it("returns Meeus' mean node at J2000", () => {
    expect(meanLunarNodeLongitudeDeg(2451545)).toBeCloseTo(125.0445479, 7);
  });

  it("moves retrograde by about 19.34° per year", () => {
    const a = meanLunarNodeLongitudeDeg(2451545);
    const b = meanLunarNodeLongitudeDeg(2451545 + 365.25);
    expect(a - b).toBeCloseTo(19.3413, 3);
  });

  it("finds the ascending node of a simple inclined orbit", () => {
    const i = (5 * Math.PI) / 180;
    // Body at longitude 0 moving north-east: ascending node at longitude 0.
    expect(osculatingNodeLongitudeDeg([1, 0, 0], [0, Math.cos(i), Math.sin(i)])).toBeCloseTo(0, 9);
    // Body at longitude 90° moving towards 180° with positive z velocity: node at 90°.
    expect(osculatingNodeLongitudeDeg([0, 1, 0], [-Math.cos(i), 0, Math.sin(i)])).toBeCloseTo(90, 9);
  });
});

describe("Chara Karakas", () => {
  // Swiss Ephemeris reference values for 1990-10-15 09:00 UT (sidereal Lahiri).
  const ref = {
    Sun: 178.018307811,
    Moon: 140.114753711,
    Mars: 50.617418436,
    Mercury: 173.166868427,
    Jupiter: 106.666967083,
    Venus: 173.586119452,
    Saturn: 265.376571594,
    Rahu: 279.512183801,
  };

  it("ranks seven planets by degree within sign (reference case: DK = Jupiter)", () => {
    const r = rankCharaKarakas(ref, "seven_planet");
    expect(r.order.map((o) => o.body)).toEqual(["Sun", "Saturn", "Venus", "Mercury", "Mars", "Moon", "Jupiter"]);
    expect(r.order.map((o) => o.abbreviation)).toEqual(["AK", "AmK", "BK", "MK", "PK", "GK", "DK"]);
    expect(r.darakaraka).toBe("Jupiter");
    expect(r.atmakaraka).toBe("Sun");
    // Moon 20.1148° vs Jupiter 16.6670° within their signs
    expect(r.lowestGapArcsec).toBeCloseTo((20.114753711 - 16.666967083) * 3600, 3);
  });

  it("uses 30° − degree for Rahu in the eight-planet scheme", () => {
    expect(rankingDegree("Rahu", 279.512183801)).toBeCloseTo(30 - 9.512183801, 9);
    const r = rankCharaKarakas(ref, "eight_planet");
    expect(r.order).toHaveLength(8);
    expect(r.order.map((o) => o.abbreviation)).toEqual(["AK", "AmK", "BK", "MK", "PiK", "PK", "GK", "DK"]);
    // Rahu ranks at 20.4878°, between Mars (20.6174°) and Moon (20.1148°).
    expect(r.order.findIndex((o) => o.body === "Rahu")).toBe(5);
    expect(r.darakaraka).toBe("Jupiter");
  });

  it("can make Rahu the Darakaraka when it is late in its sign", () => {
    const r = rankCharaKarakas({ ...ref, Rahu: 29.9 }, "eight_planet");
    expect(r.darakaraka).toBe("Rahu");
  });

  it("exposes near-ties through the gap instead of hiding them", () => {
    const r = rankCharaKarakas({ ...ref, Moon: 120 + 16.666967083 + 1 / 3600 }, "seven_planet");
    expect(r.darakaraka).toBe("Jupiter");
    expect(r.lowestGapArcsec).toBeCloseTo(1, 6);
  });

  it("is deterministic for an exact tie", () => {
    const tie = { ...ref, Moon: 120 + 16.666967083 };
    const a = rankCharaKarakas(tie, "seven_planet");
    const b = rankCharaKarakas(tie, "seven_planet");
    expect(a).toEqual(b);
    expect(a.lowestGapArcsec).toBe(0);
  });

  it("rejects Ketu and missing longitudes", () => {
    expect(() => rankingDegree("Ketu", 10)).toThrow();
    const { Saturn: _omit, ...missing } = ref;
    void _omit;
    expect(() => rankCharaKarakas(missing, "seven_planet")).toThrow(/Saturn/);
  });
});
