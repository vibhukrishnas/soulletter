/**
 * Reading (prediction assembly) contract. Candidates only ever originate from enabled,
 * registered rules applied to calculated chart data and the sourced Avakahada table.
 * There is deliberately no score, probability, or accuracy field anywhere.
 */
import type { BodyId } from "@/lib/astro/zodiac";
import type { CalculationWarning, ChartResult, CoverageItem, CoverageLevel } from "./chart";
import type { NumerologyResult } from "./numerology";

export const READING_SCHEMA_VERSION = "1.0.0";

export type VerificationStatus =
  | "verified_calculation"
  | "documented_traditional_interpretation"
  | "experimental_symbolic"
  | "provisional_source"
  | "disabled_insufficient_evidence";

export type MappingEntryStatus = "provisional_secondary_source" | "verified_primary_source";

export interface SyllableEntry {
  /** "<nakshatra 1..27>-<pada 1..4>", e.g. "11-3". */
  cellId: string;
  nakshatraIndex: number;
  nakshatraName: string;
  pada: 1 | 2 | 3 | 4;
  padaIndex: number;
  /** Popular Roman spelling used by the selected table, e.g. "Ti". */
  roman: string;
  /** Devanagari syllable, e.g. "टी". */
  devanagari: string;
  /** IAST transliteration, e.g. "ṭī". Distinguishes retroflex/dental sounds. */
  iast: string;
  /**
   * First letter of the Roman spelling. A display hint only: Latin initials do not map
   * one-to-one onto Indic syllables.
   */
  latinInitial: string;
  /** Key used for de-duplication (IAST); "ṭā" and "tā" are different sounds. */
  phoneticKey: string;
  sourceIds: string[];
  status: MappingEntryStatus;
  variantNote: string | null;
}

export type PointRole = "native_moon" | "seventh_lord" | "darakaraka";

export type TimeCondition =
  | { kind: "at_stated_time" }
  | { kind: "whole_window" }
  | { kind: "time_range"; fromLocal: string; toLocal: string; fromUtc: string; toUtc: string };

export interface CandidateEvidence {
  ruleId: string;
  ruleVersion: string;
  ruleName: string;
  verificationStatus: VerificationStatus;
  pointRole: PointRole;
  point: BodyId;
  nakshatraName: string;
  pada: 1 | 2 | 3 | 4;
  padaIndex: number;
  /** Sidereal longitude at the stated instant when known (full precision). */
  longitudeDeg: number | null;
  condition: TimeCondition;
  boundarySensitive: boolean;
  timeSensitive: boolean;
  tieSensitive: boolean;
  explanation: string;
  notes: string[];
}

export type CandidateQualifier =
  | "experimental_rule"
  | "provisional_mapping"
  | "boundary_sensitive"
  | "time_sensitive"
  | "time_conditional"
  | "tie_sensitive";

export interface SymbolicCandidate {
  /** Stable id derived from the phonetic key. */
  id: string;
  syllable: SyllableEntry;
  /** 1 = shown first. Presentation order only — NOT confidence. */
  displayOrder: number;
  evidence: CandidateEvidence[];
  qualifiers: CandidateQualifier[];
  /** Always null: no validated scoring or probability exists. */
  score: null;
}

export type RuleOutcomeStatus = "produced" | "time_dependent" | "unavailable" | "not_enabled";

export interface RuleEvaluation {
  ruleId: string;
  ruleVersion: string;
  name: string;
  verificationStatus: VerificationStatus;
  status: RuleOutcomeStatus;
  reason: string | null;
  outcomes: { syllable: SyllableEntry; evidence: CandidateEvidence }[];
}

export interface NativeNamingResult {
  status: "available" | "time_dependent" | "unavailable" | "not_enabled";
  atStatedTime: { syllable: SyllableEntry; evidence: CandidateEvidence } | null;
  /** Every syllable the Moon's Pada takes within the birth-time uncertainty window. */
  windowOutcomes: { syllable: SyllableEntry; evidence: CandidateEvidence }[];
  reason: string | null;
  label: string;
}

export interface PartnerReading {
  status: "available" | "limited" | "unavailable" | "not_enabled";
  primary: SymbolicCandidate | null;
  alternatives: SymbolicCandidate[];
  orderingPolicy: string;
  unavailableReasons: string[];
}

export interface SourceReference {
  id: string;
  label: string;
  url: string | null;
  note: string;
}

export interface ReadingVersions {
  app: string;
  readingSchema: string;
  chartSchema: string;
  ruleSet: string;
  avakahadaTable: string;
  engine: string;
}

export interface ReadingResult {
  schemaVersion: string;
  status: "completed";
  versions: ReadingVersions;
  chart: ChartResult;
  native: NativeNamingResult;
  partner: PartnerReading;
  evaluations: RuleEvaluation[];
  numerology: NumerologyResult;
  coverage: { level: CoverageLevel; items: CoverageItem[] };
  warnings: CalculationWarning[];
  limitations: string[];
  disclaimer: string;
  sources: SourceReference[];
}

export type ReadingStage = "validate" | "chart" | "indicators" | "numerology" | "reading";

export const READING_STAGES: readonly { stage: ReadingStage; label: string }[] = [
  { stage: "validate", label: "Validating birth information" },
  { stage: "chart", label: "Calculating the astronomical chart" },
  { stage: "indicators", label: "Determining eligible astrological indicators" },
  { stage: "numerology", label: "Calculating numerological values" },
  { stage: "reading", label: "Preparing the symbolic reading" },
];
