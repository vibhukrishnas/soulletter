import { describe, expect, it } from "vitest";
import type { NumerologySettings } from "@/lib/contracts/input";
import {
  chaldeanValue,
  computeNumerology,
  digitSum,
  lifePath,
  masterSet,
  normalizeName,
  pythagoreanValue,
  reduceNumber,
} from "./numerology";

const masters = masterSet("keep_11_22_33");
const none = masterSet("none");
const d = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
};
const settings = (over: Partial<NumerologySettings> = {}): NumerologySettings => ({
  lifePathMethod: "reduce_components",
  masterNumbers: "keep_11_22_33",
  yHandling: "consonant",
  ...over,
});

describe("reduction primitives", () => {
  it("sums digits and reduces with or without master numbers", () => {
    expect(digitSum(1990)).toBe(19);
    expect(reduceNumber(38, masters)).toBe(11);
    expect(reduceNumber(38, none)).toBe(2);
    expect(reduceNumber(29, none)).toBe(2);
    expect(reduceNumber(33, masterSet("keep_11_22"))).toBe(6);
    expect(() => digitSum(-1)).toThrow();
  });
});

describe("Life Path — method A (reduce month, day, year separately)", () => {
  // Published worked examples (Decoz, numerology.com, numerologist.com, HumanCharts, Gale, Balliett 1908)
  it.each([
    ["1990-08-12", 3],
    ["1983-11-22", 9],
    ["1998-10-15", 7],
    ["1980-10-22", 5],
    ["1940-03-12", 11],
    ["1936-10-12", 5],
    ["1995-11-05", 22],
    ["1989-09-11", 11],
    ["1995-05-22", 33],
    ["2009-05-04", 2],
    ["1977-12-18", 9],
    ["1872-01-17", 9],
  ])("%s → %i", (date, expected) => {
    expect(lifePath(d(date), "reduce_components", masters).value).toBe(expected);
  });

  it("Gale's 11/22-only policy reduces 1985-03-29 to 1", () => {
    expect(lifePath(d("1985-03-29"), "reduce_components", masterSet("keep_11_22")).value).toBe(1);
  });

  it("AstroSage's no-master example 1993-04-28 → 9", () => {
    expect(lifePath(d("1993-04-28"), "reduce_components", none).value).toBe(9);
  });

  it("gives 8 for the reference date 1990-10-15", () => {
    const r = lifePath(d("1990-10-15"), "reduce_components", masters);
    expect(r.value).toBe(8);
    expect(r.steps.map((s) => s.label)).toContain("Sum of components");
  });
});

describe("Life Path — method B (sum all digits)", () => {
  it.each([
    ["1995-11-05", masters, 4],
    ["1968-04-28", none, 2],
    ["1993-05-12", none, 3],
    ["1985-08-15", none, 1],
    ["1992-09-19", none, 4],
    ["1995-03-23", none, 5],
    ["1990-10-15", masters, 8],
  ] as const)("%s → %i", (date, policy, expected) => {
    expect(lifePath(d(date), "full_digit_sum", policy).value).toBe(expected);
  });

  it("documents that methods A and B can disagree when master numbers are kept", () => {
    expect(lifePath(d("1940-03-12"), "reduce_components", masters).value).toBe(11);
    expect(lifePath(d("1940-03-12"), "full_digit_sum", masters).value).toBe(2);
  });

  it("never disagrees on the final digit when no master numbers are kept", () => {
    for (let t = Date.UTC(1900, 0, 1); t < Date.UTC(2030, 0, 1); t += 37 * 86_400_000) {
      const x = new Date(t);
      const date = { year: x.getUTCFullYear(), month: x.getUTCMonth() + 1, day: x.getUTCDate() };
      expect(lifePath(date, "reduce_components", none).value).toBe(lifePath(date, "full_digit_sum", none).value);
    }
  });
});

describe("letter tables", () => {
  it("uses the Pythagorean A–I/J–R/S–Z grid", () => {
    expect(["A", "J", "S"].map(pythagoreanValue)).toEqual([1, 1, 1]);
    expect(["I", "R", "Z"].map(pythagoreanValue)).toEqual([9, 9, 8]);
  });

  it("uses Cheiro's Chaldean table with no letter valued 9", () => {
    const all = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(chaldeanValue);
    expect(Math.max(...all)).toBe(8);
    expect(["W", "X", "F", "P", "O", "Z"].map(chaldeanValue)).toEqual([6, 5, 8, 8, 7, 7]);
  });
});

describe("name normalization", () => {
  it("removes accents and punctuation and splits words", () => {
    expect(normalizeName("  José  O'Brien-Smith ")).toEqual({ ok: true, words: ["JOSE", "OBRIEN", "SMITH"] });
  });

  it.each(["राम", "Ольга", "R2D2", "Straße", "<script>"])("refuses to transliterate %s", (name) => {
    expect(normalizeName(name).ok).toBe(false);
  });
});

describe("computeNumerology", () => {
  const all = [
    "numerology.life-path",
    "numerology.psychic-number",
    "numerology.destiny-number",
    "numerology.name-pythagorean",
    "numerology.name-chaldean",
  ];

  it("reproduces the reference-date values", () => {
    const r = computeNumerology({ birthDate: "1990-10-15", settings: settings(), enabledRuleIds: all.slice(0, 3), name: null });
    expect(r.status).toBe("calculated");
    expect(r.results.map((x) => [x.name, x.value])).toEqual([
      ["Life Path Number", 8],
      ["Psychic Number (Mulank)", 6],
      ["Destiny Number (Bhagyank)", 8],
    ]);
    expect(r.candidatePolicy).toBe("numerology_never_generates_or_ranks_candidates");
  });

  it("matches published Mulank examples", () => {
    for (const [day, expected] of [[15, 6], [29, 2], [24, 6], [13, 4], [22, 4], [31, 4], [19, 1]]) {
      const r = computeNumerology({
        birthDate: `2000-01-${String(day).padStart(2, "0")}`,
        settings: settings(),
        enabledRuleIds: ["numerology.psychic-number"],
        name: null,
      });
      expect(r.results[0].value).toBe(expected);
      expect(r.results[0].isMasterNumber).toBe(false);
    }
  });

  it("matches published Pythagorean name examples", () => {
    const run = (name: string) =>
      computeNumerology({ birthDate: "1990-10-15", settings: settings(), enabledRuleIds: ["numerology.name-pythagorean"], name }).results;
    expect(run("Thomas Cruise Mapother")[0].value).toBe(4); // Decoz: 22 + 3 + 6 = 31 → 4
    expect(run("Henry Elder")[0].value).toBe(6); // Balliett: 7 + 8 = 15 → 6
    expect(run("Mary Jo Hayes")[0].value).toBe(5); // Gale
    const hancock = run("Thomas John Hancock");
    expect(hancock[1]).toMatchObject({ name: "Soul Urge Number (Pythagorean)", value: 2 }); // Decoz: 7 + 6 + 7 = 20
    expect(hancock[2]).toMatchObject({ name: "Personality Number (Pythagorean)", value: 5 }); // 6 + 5 + 3 = 14
  });

  it("matches Cheiro's Chaldean examples", () => {
    const run = (name: string) =>
      computeNumerology({ birthDate: "1990-10-15", settings: settings(), enabledRuleIds: ["numerology.name-chaldean"], name }).results[0];
    expect(run("Lloyd George")).toMatchObject({ compound: 16, value: 7 });
    expect(run("David Lloyd George")).toMatchObject({ compound: 23, value: 5 });
    expect(run("John Smith")).toMatchObject({ compound: 17, value: 8 });
    expect(run("Simon")).toMatchObject({ compound: 2, value: 2 });
  });

  it("reports name methods as unavailable for unsupported scripts instead of guessing", () => {
    const r = computeNumerology({ birthDate: "1990-10-15", settings: settings(), enabledRuleIds: all, name: "अनन्या" });
    expect(r.results.map((x) => x.ruleId)).not.toContain("numerology.name-pythagorean");
    expect(r.unavailable.map((u) => u.ruleId)).toEqual(["numerology.name-pythagorean", "numerology.name-chaldean"]);
  });

  it("returns not_requested when no numerology method is enabled", () => {
    const r = computeNumerology({ birthDate: "1990-10-15", settings: settings(), enabledRuleIds: ["naming.moon-pada-avakahada"], name: null });
    expect(r.status).toBe("not_requested");
    expect(r.results).toEqual([]);
  });

  it("is deterministic", () => {
    const input = { birthDate: "1979-12-22", settings: settings(), enabledRuleIds: all, name: "Ada Lovelace" };
    expect(computeNumerology(input)).toEqual(computeNumerology(input));
    expect(computeNumerology(input).results[0].value).toBe(33);
  });
});
