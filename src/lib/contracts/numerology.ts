import type { NumerologySettings } from "./input";
import type { EnableableRuleId } from "@/lib/rules/ids";

/** One displayed step of a numerology calculation, e.g. "1 + 5 = 6". */
export interface NumerologyStep {
  label: string;
  expression: string;
  result: number;
}

export interface NumerologyNumber {
  ruleId: EnableableRuleId;
  name: string;
  /** Final value after the declared reduction convention. */
  value: number;
  isMasterNumber: boolean;
  /** Chaldean "compound" (unreduced) total, when applicable. */
  compound: number | null;
  steps: NumerologyStep[];
  formula: string;
  /** Normalization and master-number conventions applied. */
  convention: string;
  /** Short, clearly symbolic theme words associated with the number in modern practice. */
  themes: string[];
}

export interface NumerologyUnavailable {
  ruleId: EnableableRuleId;
  reason: string;
}

export interface NumerologyResult {
  status: "calculated" | "not_requested";
  settings: NumerologySettings;
  results: NumerologyNumber[];
  unavailable: NumerologyUnavailable[];
  /** Numerology never creates, removes, or reorders partner-syllable candidates. */
  candidatePolicy: "numerology_never_generates_or_ranks_candidates";
  disclaimer: string;
}
