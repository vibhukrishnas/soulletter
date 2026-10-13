import { describe, expect, it } from "vitest";
import type { ChartSettings } from "@/lib/contracts/chart";
import type { BirthInput } from "@/lib/contracts/input";
import { AstronomyEngineProvider } from "@/server/ephemeris/astronomy-engine-provider";
import type { EphemerisProvider, InstantPositions } from "@/server/ephemeris/types";
import { computeChart } from "./compute-chart";
import { buildTimeContext, normalizeBirth } from "./time-context";

const provider = new AstronomyEngineProvider();
const SETTINGS: ChartSettings = {
  zodiac: "sidereal",
  ayanamsha: "lahiri",
  chart: "D1",
  houseSystem: "whole_sign",
  nodeType: "mean",
  charaKarakaScheme: "seven_planet",
};

function chartFor(input: Omit<Partial<BirthInput>, "place"> & { place?: Partial<BirthInput["place"]> }, settings: Partial<ChartSettings> = {}, p: EphemerisProvider = provider) {
  const { place, ...rest } = input;
  const birth = normalizeBirth({
    birthDate: "1990-10-15",
    birthTimeKnown: true,
    birthTime: "14:30",
    birthTimeAccuracy: "to_the_minute",
    dstChoice: null,
    ...rest,
    place: { label: null, latitude: 28.6139, longitude: 77.209, timeZone: "Asia/Kolkata", ...place },
  });
  const ctx = buildTimeContext(birth);
  if (!ctx.ok) throw new Error(ctx.code);
  return computeChart({ birth, ctx: ctx.ctx, settings: { ...SETTINGS, ...settings }, provider: p });
}

describe("computeChart", () => {
  it("records engine, settings, versions and time metadata", () => {
    const c = chartFor({});
    expect(c.engine).toMatchObject({ provider: "astronomy-engine", libraryVersion: "2.1.19", license: "MIT" });
    expect(c.settings).toEqual(SETTINGS);
    expect(c.time.tzdbVersion).toMatch(/^\d{4}[a-z]$/);
    expect(c.time.runtimeTimeZone).toBe("Asia/Calcutta");
    expect(c.coverage.level).toBe("full");
    expect(c.coverage.items.find((i) => i.id === "upapada_lagna")?.available).toBe(false);
  });

  it("keeps full precision (no premature rounding)", () => {
    const moon = chartFor({}).bodies.find((b) => b.body === "Moon")!.atBirth!;
    expect(moon.longitudeDeg.toString().split(".")[1]?.length ?? 0).toBeGreaterThan(8);
    expect(moon.degreeInSign).toBeCloseTo(moon.longitudeDeg - 120, 12);
  });

  it("uses the 1943 wartime offset for Delhi", () => {
    const c = chartFor({ birthDate: "1943-06-01", birthTime: "12:00" });
    expect(c.time.utcOffset).toBe("+06:30");
    expect(c.time.birthUtc).toBe("1943-06-01T05:30:00Z");
    expect(c.warnings.map((w) => w.code)).toContain("PRE_1970_TIME_ZONE_DATA");
  });

  it("flags local mean time offsets", () => {
    const c = chartFor({ birthDate: "1890-01-01", birthTime: "12:00" });
    expect(c.time.utcOffset).toBe("+05:21:10");
    expect(c.warnings.map((w) => w.code)).toContain("LOCAL_MEAN_TIME_OFFSET");
  });

  it("refuses the Ascendant beyond ±66° latitude instead of guessing", () => {
    const c = chartFor({ place: { latitude: 69.6492, longitude: 18.9553, timeZone: "Europe/Oslo" } });
    expect(c.ascendant).toBeNull();
    expect(c.seventhHouse).toBeNull();
    expect(c.warnings.map((w) => w.code)).toContain("POLAR_LATITUDE");
    expect(c.coverage.items.find((i) => i.id === "ascendant")?.reason).toMatch(/polar/);
  });

  it("supports the eight-planet scheme with Rahu at 30° − degree", () => {
    const c = chartFor({}, { charaKarakaScheme: "eight_planet" });
    expect(c.charaKarakas.rahuHandling).toBe("thirty_minus_degree_in_sign");
    expect(c.charaKarakas.atBirth?.order).toHaveLength(8);
    expect(c.charaKarakas.atBirth?.order.some((o) => o.body === "Rahu")).toBe(true);
  });

  it("supports the true node", () => {
    const mean = chartFor({}).bodies.find((b) => b.body === "Rahu")!.atBirth!.longitudeDeg;
    const tru = chartFor({}, { nodeType: "true" }).bodies.find((b) => b.body === "Rahu")!.atBirth!.longitudeDeg;
    expect(Math.abs(mean - tru)).toBeGreaterThan(0.1);
    expect(Math.abs(mean - tru)).toBeLessThan(2.5);
  });

  it("puts Ketu exactly opposite Rahu", () => {
    const c = chartFor({});
    const rahu = c.bodies.find((b) => b.body === "Rahu")!.atBirth!.longitudeDeg;
    const ketu = c.bodies.find((b) => b.body === "Ketu")!.atBirth!.longitudeDeg;
    expect((ketu - rahu + 360) % 360).toBeCloseTo(180, 9);
  });

  it("reports a Chara Karaka tie instead of picking one silently", () => {
    // Wrap the real engine and move the Moon onto Jupiter's degree-in-sign at the stated instant.
    const tieProvider: EphemerisProvider = {
      info: provider.info,
      toleranceArcsec: (k, t) => provider.toleranceArcsec(k, t),
      ascendantAt: (t, lat, lon) => provider.ascendantAt(t, lat, lon),
      positionsAt: (t, o): InstantPositions => {
        const p = provider.positionsAt(t, o);
        const jupInSign = p.bodies.Jupiter.siderealLongitudeDeg % 30;
        return {
          ...p,
          bodies: { ...p.bodies, Moon: { ...p.bodies.Moon, siderealLongitudeDeg: 120 + jupInSign + 0.5 / 3600 } },
        };
      },
    };
    const c = chartFor({}, {}, tieProvider);
    expect(c.charaKarakas.atBirth?.tie).toBe(true);
    expect(c.warnings.map((w) => w.code)).toContain("KARAKA_TIE");
    expect(c.coverage.items.find((i) => i.id === "darakaraka")?.available).toBe(false);
  });

  it("is deterministic", () => {
    expect(chartFor({})).toEqual(chartFor({}));
  });
});
