import { describe, expect, it } from "vitest";
import { ENABLEABLE_RULE_IDS, EXCLUDED_RULE_IDS } from "./ids";
import { RULES, RuleNotEligibleError, assertCanEmitSyllable, getRule, validateRegistry, type RuleDefinition } from "./registry";

describe("interpretation registry", () => {
  it("is valid", () => {
    expect(validateRegistry()).toEqual([]);
  });

  it("registers every enableable and excluded rule exactly once", () => {
    const ids = RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of [...ENABLEABLE_RULE_IDS, ...EXCLUDED_RULE_IDS]) expect(ids).toContain(id);
  });

  it("defines every required field for each rule", () => {
    for (const r of RULES) {
      for (const key of [
        "id",
        "name",
        "tradition",
        "category",
        "source",
        "sourceUrl",
        "version",
        "inputRequirements",
        "calculationProcedure",
        "outputType",
        "candidateMapping",
        "verificationStatus",
        "limitations",
        "enabled",
      ] as const) {
        expect(r, `${r.id}.${key}`).toHaveProperty(key);
      }
    }
  });

  it("labels partner rules experimental and never verified", () => {
    for (const r of RULES.filter((x) => x.id.startsWith("partner.") && x.enabled)) {
      expect(r.verificationStatus).toBe("experimental_symbolic");
      expect(r.limitations.join(" ")).toMatch(/not an established classical rule/);
    }
  });

  it("disables every excluded method for insufficient evidence", () => {
    for (const id of EXCLUDED_RULE_IDS) {
      const r = getRule(id) as RuleDefinition;
      expect(r.enabled).toBe(false);
      expect(r.verificationStatus).toBe("disabled_insufficient_evidence");
      expect(r.candidateMapping).toBeNull();
    }
  });

  it("never lets numerology carry a candidate mapping", () => {
    for (const r of RULES.filter((x) => x.category === "numerology")) {
      expect(r.outputType).toBe("number");
      expect(r.candidateMapping).toBeNull();
    }
  });

  it("detects unsupported mappings, missing limitations and mislabelled rules", () => {
    const base = getRule("partner.darakaraka-pada-avakahada") as RuleDefinition;
    const broken: RuleDefinition[] = [
      { ...base, id: "partner.darakaraka-pada-avakahada", candidateMapping: { ...base.candidateMapping!, point: "upapada" as never } },
    ];
    expect(validateRegistry([...RULES.filter((r) => r.id !== base.id), ...broken]).join(" ")).toMatch(/unsupported mapping point/);
    expect(
      validateRegistry([...RULES.filter((r) => r.id !== base.id), { ...base, verificationStatus: "documented_traditional_interpretation" }]).join(" "),
    ).toMatch(/experimental_symbolic/);
    expect(validateRegistry([...RULES.filter((r) => r.id !== base.id), { ...base, limitations: [] }]).join(" ")).toMatch(/limitations/);
    const lp = getRule("numerology.life-path") as RuleDefinition;
    expect(
      validateRegistry([...RULES.filter((r) => r.id !== lp.id), { ...lp, candidateMapping: base.candidateMapping }]).join(" "),
    ).toMatch(/must not have a candidate mapping/);
  });

  it("rejects syllable emission from disabled, non-syllable or mismatched rules", () => {
    const dk = getRule("partner.darakaraka-pada-avakahada") as RuleDefinition;
    expect(() => assertCanEmitSyllable(dk, "darakaraka")).not.toThrow();
    expect(() => assertCanEmitSyllable({ ...dk, enabled: false }, "darakaraka")).toThrow(RuleNotEligibleError);
    expect(() => assertCanEmitSyllable(dk, "moon")).toThrow(RuleNotEligibleError);
    expect(() => assertCanEmitSyllable(getRule("numerology.life-path") as RuleDefinition, "moon")).toThrow(RuleNotEligibleError);
    expect(() => assertCanEmitSyllable(getRule("partner.upapada-lagna") as RuleDefinition, "moon")).toThrow(RuleNotEligibleError);
    expect(() =>
      assertCanEmitSyllable({ ...dk, candidateMapping: { ...dk.candidateMapping!, tableVersion: "other" } }, "darakaraka"),
    ).toThrow(RuleNotEligibleError);
  });
});
