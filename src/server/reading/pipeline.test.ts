import { describe, expect, it } from "vitest";
import type { ReadingRequest } from "@/lib/contracts/input";
import { buildPartnerReading, neighbouringPadaIndex, type RuleOutcome } from "@/lib/reading/candidates";
import { getRule, type RuleDefinition } from "@/lib/rules/registry";
import { AstronomyEngineProvider } from "@/server/ephemeris/astronomy-engine-provider";
import type { EphemerisProvider } from "@/server/ephemeris/types";
import { runReading } from "./pipeline";

const provider = new AstronomyEngineProvider();
const ALL = [
  "naming.moon-pada-avakahada",
  "partner.seventh-lord-pada-avakahada",
  "partner.darakaraka-pada-avakahada",
  "numerology.life-path",
  "numerology.psychic-number",
  "numerology.destiny-number",
];

function request(over: Omit<Partial<ReadingRequest>, "birth"> & { birth?: Partial<ReadingRequest["birth"]> } = {}): ReadingRequest {
  const { birth, ...rest } = over;
  return {
    birth: {
      birthDate: "1990-10-15",
      birthTimeKnown: true,
      birthTime: "14:30",
      birthTimeAccuracy: "to_the_minute",
      dstChoice: null,
      place: { label: "New Delhi", latitude: 28.6139, longitude: 77.209, timeZone: "Asia/Kolkata" },
      ...birth,
    },
    settings: { zodiac: "sidereal", ayanamsha: "lahiri", chart: "D1", houseSystem: "whole_sign", nodeType: "mean", charaKarakaScheme: "seven_planet" },
    numerology: { lifePathMethod: "reduce_components", masterNumbers: "keep_11_22_33", yHandling: "consonant" },
    enabledRuleIds: ALL,
    acknowledgeExperimental: true,
    name: null,
    ...rest,
  };
}

async function reading(over: Parameters<typeof request>[0] = {}, p: EphemerisProvider = provider) {
  const r = await runReading(request(over), p);
  if (!r.ok) throw new Error(`${r.code}: ${r.message}`);
  return r.result;
}

describe("reference case 1990-10-15 14:30 Asia/Kolkata, New Delhi", () => {
  it("reports every stage in order", async () => {
    const stages: string[] = [];
    const r = await runReading(request(), provider, (s, st) => {
      stages.push(`${s}:${st}`);
    });
    expect(r.ok).toBe(true);
    expect(stages).toEqual(["validate:completed", "chart:completed", "indicators:completed", "numerology:completed", "reading:completed"]);
  });

  it("gives the native naming syllable Ti (Moon in Purva Phalguni 3) labelled as about the user", async () => {
    const r = await reading();
    expect(r.native.status).toBe("available");
    expect(r.native.atStatedTime?.syllable).toMatchObject({ roman: "Ti", devanagari: "टी", iast: "ṭī", cellId: "11-3" });
    expect(r.native.label).toMatch(/not a partner prediction/);
  });

  it("derives the primary experimental syllable from the seventh lord (Moon) and labels it", async () => {
    const r = await reading();
    expect(r.chart.seventhHouse?.atBirth).toMatchObject({ seventhSignName: "Cancer", lord: "Moon" });
    expect(r.partner.primary?.syllable.roman).toBe("Ti");
    expect(r.partner.primary?.qualifiers).toEqual(expect.arrayContaining(["experimental_rule", "provisional_mapping"]));
    expect(r.partner.primary?.evidence[0].verificationStatus).toBe("experimental_symbolic");
    expect(r.partner.primary?.score).toBeNull();
  });

  it("flags the boundary-sensitive Darakaraka (Jupiter) and discloses both neighbouring syllables", async () => {
    const r = await reading();
    expect(r.chart.charaKarakas.atBirth?.darakaraka.body).toBe("Jupiter");
    const dk = r.evaluations.find((e) => e.ruleId === "partner.darakaraka-pada-avakahada");
    expect(dk?.outcomes.map((o) => o.syllable.roman).sort()).toEqual(["Da", "Di"]);
    expect(dk?.outcomes.every((o) => o.evidence.boundarySensitive)).toBe(true);
    expect(r.warnings.some((w) => w.code === "BOUNDARY_SENSITIVE" && w.subject === "Jupiter")).toBe(true);
  });

  it("calculates numerology separately without touching candidates", async () => {
    const withN = await reading();
    const withoutN = await reading({ enabledRuleIds: ALL.filter((id) => !id.startsWith("numerology.")) });
    expect(withN.numerology.results.map((n) => n.value)).toEqual([8, 6, 8]);
    expect(withoutN.numerology.status).toBe("not_requested");
    expect(withN.partner).toEqual(withoutN.partner);
    expect(withN.native).toEqual(withoutN.native);
  });

  it("is deterministic and JSON-serializable", async () => {
    const a = await reading();
    const b = await reading();
    expect(a).toEqual(b);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });

  it("contains no score, probability or percentage anywhere", async () => {
    const json = JSON.stringify(await reading());
    expect(json).not.toMatch(/"(probability|confidence|accuracy|weight)"/i);
    expect(json).not.toMatch(/\d+(\.\d+)?\s?%/);
  });
});

describe("missing information", () => {
  it("unknown birth time: no Ascendant, no seventh lord, no invented placements", async () => {
    const r = await reading({ birth: { birthTimeKnown: false, birthTime: null, birthTimeAccuracy: null } });
    expect(r.chart.ascendant).toBeNull();
    expect(r.chart.seventhHouse).toBeNull();
    expect(r.chart.bodies.every((b) => b.atBirth === null)).toBe(true);
    expect(r.coverage.level).toBe("limited");
    expect(r.partner.primary).toBeNull();
    expect(r.partner.status).toBe("limited");
    expect(r.partner.alternatives.every((c) => c.qualifiers.includes("time_conditional"))).toBe(true);
    expect(r.partner.unavailableReasons.join(" ")).toMatch(/Ascendant/);
    expect(r.native.status).toBe("time_dependent");
    expect(r.warnings.map((w) => w.code)).toContain("BIRTH_TIME_UNKNOWN");
  });

  it("missing location: planetary results remain, house-based results are unavailable", async () => {
    const r = await reading({ birth: { place: { label: null, latitude: null, longitude: null, timeZone: "Asia/Kolkata" } } });
    expect(r.chart.ascendant).toBeNull();
    expect(r.native.atStatedTime?.syllable.roman).toBe("Ti");
    expect(r.evaluations.find((e) => e.ruleId === "partner.seventh-lord-pada-avakahada")?.status).toBe("unavailable");
    expect(r.warnings.map((w) => w.code)).toContain("LOCATION_UNKNOWN");
  });

  it("missing time zone: treats every UTC offset as possible", async () => {
    const r = await reading({ birth: { place: { label: null, latitude: null, longitude: null, timeZone: null } } });
    expect(r.chart.time.basis).toBe("utc_window");
    expect(r.chart.time.birthUtc).toBeNull();
    expect(r.native.atStatedTime).toBeNull();
    expect(r.warnings.map((w) => w.code)).toContain("TIME_ZONE_UNKNOWN");
  });

  it("experimental rules disabled: partner reading is not_enabled and nothing is invented", async () => {
    const r = await reading({ enabledRuleIds: ["naming.moon-pada-avakahada"], acknowledgeExperimental: false });
    expect(r.partner.status).toBe("not_enabled");
    expect(r.partner.primary).toBeNull();
    expect(r.partner.alternatives).toEqual([]);
  });

  it("returns typed errors for impossible or ambiguous local times", async () => {
    const gap = await runReading(
      request({ birth: { birthDate: "2021-03-14", birthTime: "02:30", place: { label: null, latitude: 40.71, longitude: -74.0, timeZone: "America/New_York" } } }),
      provider,
    );
    expect(gap.ok).toBe(false);
    if (!gap.ok) expect(gap.code).toBe("NONEXISTENT_LOCAL_TIME");
    const overlap = await runReading(
      request({ birth: { birthDate: "2021-11-07", birthTime: "01:30", place: { label: null, latitude: 40.71, longitude: -74.0, timeZone: "America/New_York" } } }),
      provider,
    );
    expect(overlap.ok).toBe(false);
    if (!overlap.ok) expect(overlap.code).toBe("AMBIGUOUS_LOCAL_TIME");
  });

  it("turns engine failures into CALCULATION_FAILED, never success", async () => {
    const broken: EphemerisProvider = {
      info: provider.info,
      toleranceArcsec: () => 1,
      ascendantAt: () => {
        throw new Error("boom");
      },
      positionsAt: () => {
        throw new Error("boom");
      },
    };
    const r = await runReading(request(), broken);
    expect(r).toMatchObject({ ok: false, code: "CALCULATION_FAILED" });
  });
});

describe("candidate aggregation", () => {
  const dk = getRule("partner.darakaraka-pada-avakahada") as RuleDefinition;
  const sl = getRule("partner.seventh-lord-pada-avakahada") as RuleDefinition;

  it("merges identical sounds from different rules without adding confidence", async () => {
    // A chart where the Moon is both the seventh lord and the Darakaraka would produce the same cell twice.
    const r = await reading();
    const ti = r.partner.primary;
    const fakeOutcome = (rule: RuleDefinition): RuleOutcome => ({
      kind: "stated",
      syllable: ti!.syllable,
      evidence: { ...ti!.evidence[0], ruleId: rule.id, ruleName: rule.name },
    });
    const merged = buildPartnerReading(
      [
        { rule: dk, outcomes: [fakeOutcome(dk)], unavailableReason: null },
        { rule: sl, outcomes: [fakeOutcome(sl)], unavailableReason: null },
      ],
      true,
    );
    expect(merged.alternatives).toHaveLength(0);
    expect(merged.primary?.evidence.map((e) => e.ruleId)).toEqual([sl.id, dk.id]);
    expect(merged.primary?.score).toBeNull();
  });

  it("orders by documented rule display order, not by input order", async () => {
    const r = await reading();
    expect(r.partner.primary?.evidence[0].ruleId).toBe("partner.seventh-lord-pada-avakahada");
    expect(r.partner.orderingPolicy).toMatch(/presentation preference/);
  });

  it("finds the neighbouring Pada across the nearer boundary", () => {
    expect(neighbouringPadaIndex(106.666562581)).toBe(32); // Pushya 4 → Ashlesha 1
    expect(neighbouringPadaIndex(106.666967083)).toBe(31); // Ashlesha 1 → Pushya 4
    expect(neighbouringPadaIndex(0.0001)).toBe(107); // wraps to Revati 4
  });
});
