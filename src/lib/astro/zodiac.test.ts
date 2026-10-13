import { describe, expect, it } from "vitest";
import {
  NAKSHATRAS,
  NAKSHATRA_WIDTH_DEG,
  PADA_COUNT,
  PADA_WIDTH_DEG,
  SIGNS,
  boundaryDistances,
  nakshatraBoundaryDeg,
  navamsaSignIndexOf,
  padaBoundaryDeg,
  padaCellFromIndex,
  padaIndexOf,
  placementOf,
  signIndexOf,
  signLord,
  wholeSignHouseSign,
} from "./zodiac";

const EPS = 1e-9;

describe("subdivision constants", () => {
  it("uses 13°20′ Nakshatras and 3°20′ Padas", () => {
    expect(NAKSHATRA_WIDTH_DEG).toBeCloseTo(13 + 20 / 60, 12);
    expect(PADA_WIDTH_DEG).toBeCloseTo(3 + 20 / 60, 12);
    expect(PADA_COUNT).toBe(108);
    expect(NAKSHATRAS).toHaveLength(27);
    expect(SIGNS).toHaveLength(12);
  });
});

describe("Nakshatra boundaries (half-open)", () => {
  it.each(Array.from({ length: 27 }, (_, k) => k))("boundary %i belongs to the following Nakshatra", (k) => {
    const b = nakshatraBoundaryDeg(k);
    expect(placementOf(b).nakshatraIndex).toBe(k);
    expect(placementOf(b).pada).toBe(1);
    if (k > 0) {
      const before = placementOf(b - EPS);
      expect(before.nakshatraIndex).toBe(k - 1);
      expect(before.pada).toBe(4);
    }
  });
});

describe("Pada boundaries (half-open)", () => {
  it.each(Array.from({ length: 108 }, (_, k) => k))("boundary %i maps to Pada index %i", (k) => {
    const b = padaBoundaryDeg(k);
    expect(padaIndexOf(b)).toBe(k);
    expect(padaIndexOf(b + EPS)).toBe(k);
    if (k > 0) expect(padaIndexOf(b - EPS)).toBe(k - 1);
  });

  it("maps the exact decimal boundaries used in documentation", () => {
    expect(padaCellFromIndex(padaIndexOf(40))).toEqual({ padaIndex: 12, nakshatraIndex: 3, pada: 1 }); // Rohini 1
    expect(placementOf(106 + 40 / 60).nakshatraName).toBe("Ashlesha"); // Pushya/Ashlesha boundary → Ashlesha
    expect(placementOf(106 + 40 / 60 - 1e-7).nakshatraName).toBe("Pushya");
  });
});

describe("0° / 360° wrap", () => {
  it("treats 360° as 0° Aries, Ashwini Pada 1", () => {
    const p = placementOf(360);
    expect(p.longitudeDeg).toBe(0);
    expect(p.nakshatraName).toBe("Ashwini");
    expect(p.pada).toBe(1);
    expect(p.signName).toBe("Aries");
  });

  it("puts values just below 360° in Revati Pada 4, Pisces", () => {
    for (const lon of [359.9999999, -1e-7]) {
      const p = placementOf(lon);
      expect(p.nakshatraName).toBe("Revati");
      expect(p.pada).toBe(4);
      expect(p.signName).toBe("Pisces");
    }
  });
});

describe("signs", () => {
  it("uses half-open 30° signs", () => {
    expect(signIndexOf(30)).toBe(1);
    expect(signIndexOf(29.999999999)).toBe(0);
    expect(signIndexOf(330)).toBe(11);
  });

  it("assigns traditional sign lords", () => {
    expect(SIGNS.map((s) => s.lord)).toEqual([
      "Mars",
      "Venus",
      "Mercury",
      "Moon",
      "Sun",
      "Mercury",
      "Venus",
      "Mars",
      "Jupiter",
      "Saturn",
      "Saturn",
      "Jupiter",
    ]);
    expect(signLord(3)).toBe("Moon");
  });

  it("computes whole-sign houses", () => {
    // Capricorn rising → 7th house Cancer
    expect(wholeSignHouseSign(9, 7)).toBe(3);
    expect(wholeSignHouseSign(0, 1)).toBe(0);
    expect(wholeSignHouseSign(11, 2)).toBe(0);
    expect(() => wholeSignHouseSign(0, 13)).toThrow(RangeError);
  });
});

describe("Navamsa (D9)", () => {
  it("follows movable/fixed/dual starting signs", () => {
    expect(SIGNS[navamsaSignIndexOf(0)].name).toBe("Aries"); // movable: from itself
    expect(SIGNS[navamsaSignIndexOf(30)].name).toBe("Capricorn"); // fixed: from the 9th
    expect(SIGNS[navamsaSignIndexOf(60)].name).toBe("Libra"); // dual: from the 5th
    expect(SIGNS[navamsaSignIndexOf(90)].name).toBe("Cancer");
    expect(SIGNS[navamsaSignIndexOf(359.99)].name).toBe("Pisces");
  });

  it("has exactly nine Navamsas per sign", () => {
    for (let s = 0; s < 12; s++) {
      const set = new Set<number>();
      for (let k = 0; k < 9; k++) set.add(navamsaSignIndexOf(s * 30 + k * PADA_WIDTH_DEG + 0.5));
      expect(set.size).toBe(9);
    }
  });
});

describe("boundary distances", () => {
  it("reports arcseconds to the surrounding Pada boundaries", () => {
    // Reference-case Moon (Swiss Ephemeris): 140.114753711° → Purva Phalguni Pada 3 starts at 140°.
    const d = boundaryDistances(140.114753711);
    expect(d.arcsecFromPadaStart).toBeCloseTo(0.114753711 * 3600, 6);
    expect(d.arcsecToPadaEnd).toBeCloseTo((padaBoundaryDeg(43) - 140.114753711) * 3600, 6);
    expect(d.nearestPadaBoundaryArcsec).toBeCloseTo(413.113, 2);
  });

  it("measures the tiny Jupiter offset without rounding", () => {
    const d = boundaryDistances(106.666967083);
    expect(d.nearestPadaBoundaryArcsec).toBeCloseTo(1.0815, 3);
    expect(d.nearestNakshatraBoundaryArcsec).toBeCloseTo(1.0815, 3);
  });
});
