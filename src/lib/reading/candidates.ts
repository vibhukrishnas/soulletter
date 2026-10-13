/**
 * Symbolic candidate engine. Pure functions over a calculated ChartResult.
 *
 * Guarantees:
 *  - Syllables come ONLY from the Avakahada table cell of a calculated Pada, via a rule
 *    that is enabled and passes assertCanEmitSyllable(). No randomness, no fallback,
 *    no substitution, no frequency filtering.
 *  - Sensitivity is disclosed, not hidden: a placement within engine tolerance of a
 *    Pada boundary also lists the neighbouring cell; a value that changes inside the
 *    birth-time window lists each time-conditional alternative.
 *  - No score or probability is produced. Ordering is a documented presentation
 *    preference (rule display order, then stated-time outcome, then alternatives).
 */
import { formatDms } from "@/lib/astro/angles";
import { grahaLabel, rashiLabel } from "@/lib/astro/names";
import { PADA_COUNT, SIGNS, boundaryDistances, padaIndexOf, type BodyId } from "@/lib/astro/zodiac";
import { syllableForPadaIndex } from "@/lib/avakahada/table";
import type { ChartResult, WindowSegment } from "@/lib/contracts/chart";
import type {
  CandidateEvidence,
  CandidateQualifier,
  NativeNamingResult,
  PartnerReading,
  PointRole,
  RuleEvaluation,
  SymbolicCandidate,
  SyllableEntry,
  TimeCondition,
} from "@/lib/contracts/reading";
import { assertCanEmitSyllable, type MappingPoint, type RuleDefinition } from "@/lib/rules/registry";

export const ORDERING_POLICY =
  "Partner syllables are listed in a fixed presentation order: the seventh-house-lord rule first, then the Darakaraka rule; " +
  "within each rule the result at your stated birth time comes first, followed by boundary and birth-time alternatives in time order. " +
  "This order is a presentation preference, not a measure of likelihood. No syllable has a score or probability.";

export const NATIVE_LABEL = "Your traditional naming syllable — about you, not a partner prediction";

export type OutcomeKind = "stated" | "whole_window" | "boundary_alternative" | "time_conditional";

export interface RuleOutcome {
  kind: OutcomeKind;
  syllable: SyllableEntry;
  evidence: CandidateEvidence;
}

function cell(padaIndex: number): SyllableEntry {
  const entry = syllableForPadaIndex(padaIndex);
  // A calculated Pada index is always 0..107; anything else is a programming error, never a fallback.
  if (!entry) throw new Error(`No Avakahada cell for Pada index ${padaIndex}`);
  return entry;
}

/** The Pada on the other side of the nearest boundary. */
export function neighbouringPadaIndex(longitudeDeg: number): number {
  const d = boundaryDistances(longitudeDeg);
  const idx = padaIndexOf(longitudeDeg);
  return d.arcsecFromPadaStart <= d.arcsecToPadaEnd ? (idx + PADA_COUNT - 1) % PADA_COUNT : (idx + 1) % PADA_COUNT;
}

interface PointState {
  point: BodyId;
  padaIndex: number;
  longitudeDeg: number;
  boundarySensitive: boolean;
  toleranceArcsec: number;
}

interface PointSegmentValue {
  point: BodyId;
  padaIndex: number;
  tie?: boolean;
  label?: string;
}

interface EvaluateArgs {
  rule: RuleDefinition;
  mappingPoint: MappingPoint;
  pointRole: PointRole;
  stated: PointState | null;
  segments: WindowSegment<PointSegmentValue>[];
  tieAtStated: boolean;
  explain: (point: BodyId, entry: SyllableEntry, segmentLabel?: string) => string;
}

function evidence(
  args: EvaluateArgs,
  entry: SyllableEntry,
  point: BodyId,
  condition: TimeCondition,
  flags: { boundary: boolean; time: boolean; tie: boolean },
  longitudeDeg: number | null,
  explanation: string,
  notes: string[],
): CandidateEvidence {
  return {
    ruleId: args.rule.id,
    ruleVersion: args.rule.version,
    ruleName: args.rule.name,
    verificationStatus: args.rule.verificationStatus,
    pointRole: args.pointRole,
    point,
    nakshatraName: entry.nakshatraName,
    pada: entry.pada,
    padaIndex: entry.padaIndex,
    longitudeDeg,
    condition,
    boundarySensitive: flags.boundary,
    timeSensitive: flags.time,
    tieSensitive: flags.tie,
    explanation,
    notes,
  };
}

/** Turns a point's stated value and window timeline into outcomes for one rule. */
export function evaluatePoint(args: EvaluateArgs): RuleOutcome[] {
  assertCanEmitSyllable(args.rule, args.mappingPoint);
  const outcomes: RuleOutcome[] = [];
  const timeSensitive = args.segments.length > 1;

  if (args.stated) {
    const s = args.stated;
    const entry = cell(s.padaIndex);
    const notes: string[] = [];
    if (s.boundarySensitive) {
      notes.push(
        `${grahaLabel(s.point)} is within the engine tolerance (${s.toleranceArcsec}″) of a Pada boundary, so an independent ephemeris could place it in the neighbouring Pada.`,
      );
    }
    if (timeSensitive) notes.push("The result changes within your birth-time accuracy window; alternatives are listed.");
    if (args.tieAtStated) notes.push("Two Chara Karaka degrees are within engine tolerance of each other.");
    outcomes.push({
      kind: "stated",
      syllable: entry,
      evidence: evidence(
        args,
        entry,
        s.point,
        { kind: "at_stated_time" },
        { boundary: s.boundarySensitive, time: timeSensitive, tie: args.tieAtStated },
        s.longitudeDeg,
        args.explain(s.point, entry),
        notes,
      ),
    });
    if (s.boundarySensitive) {
      const alt = cell(neighbouringPadaIndex(s.longitudeDeg));
      outcomes.push({
        kind: "boundary_alternative",
        syllable: alt,
        evidence: evidence(
          args,
          alt,
          s.point,
          { kind: "at_stated_time" },
          { boundary: true, time: timeSensitive, tie: args.tieAtStated },
          s.longitudeDeg,
          `${grahaLabel(s.point)} lies at ${formatDms(s.longitudeDeg % 30, 2)} in its sign, within engine tolerance of the boundary with ${alt.nakshatraName} Pada ${alt.pada}, whose syllable is ${alt.roman}.`,
          ["Boundary alternative: the calculated placement is the main result; this neighbouring cell is shown because the difference is inside the measured engine tolerance."],
        ),
      });
    }
    if (timeSensitive) {
      for (const seg of args.segments) {
        if (seg.value.padaIndex === s.padaIndex && seg.value.point === s.point) continue;
        const e = cell(seg.value.padaIndex);
        outcomes.push({
          kind: "time_conditional",
          syllable: e,
          evidence: evidence(
            args,
            e,
            seg.value.point,
            { kind: "time_range", fromLocal: seg.fromLocal, toLocal: seg.toLocal, fromUtc: seg.fromUtc, toUtc: seg.toUtc },
            { boundary: false, time: true, tie: seg.value.tie ?? false },
            null,
            `If the birth time were between ${seg.fromLocal} and ${seg.toLocal}: ${args.explain(seg.value.point, e, seg.value.label)}`,
            [],
          ),
        });
      }
    }
    return outcomes;
  }

  if (args.segments.length === 1) {
    const seg = args.segments[0];
    const e = cell(seg.value.padaIndex);
    outcomes.push({
      kind: "whole_window",
      syllable: e,
      evidence: evidence(
        args,
        e,
        seg.value.point,
        { kind: "whole_window" },
        { boundary: false, time: false, tie: seg.value.tie ?? false },
        null,
        `${args.explain(seg.value.point, e, seg.value.label)} This holds for every possible birth time in the window considered.`,
        [],
      ),
    });
    return outcomes;
  }

  for (const seg of args.segments) {
    const e = cell(seg.value.padaIndex);
    outcomes.push({
      kind: "time_conditional",
      syllable: e,
      evidence: evidence(
        args,
        e,
        seg.value.point,
        { kind: "time_range", fromLocal: seg.fromLocal, toLocal: seg.toLocal, fromUtc: seg.fromUtc, toUtc: seg.toUtc },
        { boundary: false, time: true, tie: seg.value.tie ?? false },
        null,
        `If the birth time were between ${seg.fromLocal} and ${seg.toLocal}: ${args.explain(seg.value.point, e, seg.value.label)}`,
        [],
      ),
    });
  }
  return outcomes;
}

function toEvaluation(rule: RuleDefinition, outcomes: RuleOutcome[], reason: string | null): RuleEvaluation {
  const hasPrimary = outcomes.some((o) => o.kind === "stated" || o.kind === "whole_window");
  return {
    ruleId: rule.id,
    ruleVersion: rule.version,
    name: rule.name,
    verificationStatus: rule.verificationStatus,
    status: outcomes.length === 0 ? "unavailable" : hasPrimary ? "produced" : "time_dependent",
    reason: outcomes.length === 0 ? reason : null,
    outcomes: outcomes.map((o) => ({ syllable: o.syllable, evidence: o.evidence })),
  };
}

export function notEnabledEvaluation(rule: RuleDefinition): RuleEvaluation {
  return {
    ruleId: rule.id,
    ruleVersion: rule.version,
    name: rule.name,
    verificationStatus: rule.verificationStatus,
    status: "not_enabled",
    reason: "Not selected.",
    outcomes: [],
  };
}

const syllableText = (e: SyllableEntry) => `${e.roman} (${e.devanagari}, ${e.iast})`;

// ---------------------------------------------------------------- Moon naming syllable
export function evaluateMoonNaming(chart: ChartResult, rule: RuleDefinition): { evaluation: RuleEvaluation; outcomes: RuleOutcome[] } {
  const moon = chart.bodies.find((b) => b.body === "Moon");
  if (!moon) throw new Error("Chart has no Moon");
  const outcomes = evaluatePoint({
    rule,
    mappingPoint: "moon",
    pointRole: "native_moon",
    stated: moon.atBirth
      ? {
          point: "Moon",
          padaIndex: moon.atBirth.padaIndex,
          longitudeDeg: moon.atBirth.longitudeDeg,
          boundarySensitive: moon.boundarySensitive,
          toleranceArcsec: moon.toleranceArcsec,
        }
      : null,
    segments: moon.window.segments.map((s) => ({ ...s, value: { point: "Moon" as BodyId, padaIndex: s.value.padaIndex } })),
    tieAtStated: false,
    explain: (_p, e) => `${grahaLabel("Moon")} is in ${rashiLabel(Math.floor(e.padaIndex / 9))}, ${e.nakshatraName} Pada ${e.pada}; the Avakahada table lists ${syllableText(e)} for this Pada.`,
  });
  return { evaluation: toEvaluation(rule, outcomes, null), outcomes };
}

export function nativeNamingResult(rule: RuleDefinition | null, outcomes: RuleOutcome[]): NativeNamingResult {
  if (!rule) {
    return { status: "not_enabled", atStatedTime: null, windowOutcomes: [], reason: "Not selected.", label: NATIVE_LABEL };
  }
  const stated = outcomes.find((o) => o.kind === "stated" || o.kind === "whole_window") ?? null;
  const others = outcomes.filter((o) => o !== stated);
  return {
    status: stated ? "available" : outcomes.length > 0 ? "time_dependent" : "unavailable",
    atStatedTime: stated ? { syllable: stated.syllable, evidence: stated.evidence } : null,
    windowOutcomes: others.map((o) => ({ syllable: o.syllable, evidence: o.evidence })),
    reason: stated
      ? null
      : outcomes.length > 0
        ? "The Moon changes Pada during the possible birth times, so the naming syllable depends on the exact time."
        : "Not enough information to determine the Moon's Pada.",
    label: NATIVE_LABEL,
  };
}

// ---------------------------------------------------------------- seventh-house lord
export function evaluateSeventhLord(chart: ChartResult, rule: RuleDefinition): { evaluation: RuleEvaluation; outcomes: RuleOutcome[] } {
  const sh = chart.seventhHouse;
  if (!sh || !chart.ascendant) {
    const reason =
      chart.time.basis !== "exact_instant"
        ? "Needs a known birth time and time zone: the seventh house depends on the Ascendant."
        : "Needs birthplace coordinates (and a latitude within ±66°) to calculate the Ascendant.";
    assertCanEmitSyllable(rule, "seventh_house_lord");
    return { evaluation: toEvaluation(rule, [], reason), outcomes: [] };
  }
  const lordBody = chart.bodies.find((b) => b.body === sh.atBirth.lord);
  if (!lordBody?.atBirth) throw new Error("Seventh lord placement missing");
  const ascSensitive = chart.ascendant.boundarySensitive;
  const outcomes = evaluatePoint({
    rule,
    mappingPoint: "seventh_house_lord",
    pointRole: "seventh_lord",
    stated: {
      point: sh.atBirth.lord,
      padaIndex: sh.atBirth.lordPadaIndex,
      longitudeDeg: lordBody.atBirth.longitudeDeg,
      boundarySensitive: sh.lordBoundarySensitive,
      toleranceArcsec: lordBody.toleranceArcsec,
    },
    segments: sh.window.segments.map((s) => ({
      ...s,
      value: { point: s.value.lord as BodyId, padaIndex: s.value.lordPadaIndex, label: rashiLabel(s.value.seventhSignIndex) },
    })),
    tieAtStated: false,
    explain: (point, e, seventhSign) =>
      `With whole-sign houses the seventh sign is ${seventhSign ?? rashiLabel(sh.atBirth.seventhSignIndex)}, ruled by ${grahaLabel(point)}; ${grahaLabel(point)} is in ${e.nakshatraName} Pada ${e.pada}, which the table maps to ${syllableText(e)}.`,
  });
  if (ascSensitive && outcomes[0]) {
    outcomes[0].evidence.boundarySensitive = true;
    outcomes[0].evidence.notes.push(
      "The Ascendant is within engine tolerance of a sign boundary, so the seventh sign (and its lord) could differ.",
    );
    // Disclose the seventh lord implied by the neighbouring Ascendant sign.
    const asc = chart.ascendant.atBirth;
    const neighbourAscSign = (asc.signIndex + (asc.degreeInSign < 15 ? 11 : 1)) % 12;
    const altSeventh = (neighbourAscSign + 6) % 12;
    const altLord = SIGNS[altSeventh].lord;
    const altBody = chart.bodies.find((b) => b.body === altLord);
    if (altBody?.atBirth) {
      const alt = cell(altBody.atBirth.padaIndex);
      outcomes.push({
        kind: "boundary_alternative",
        syllable: alt,
        evidence: evidence(
          {
            rule,
            mappingPoint: "seventh_house_lord",
            pointRole: "seventh_lord",
            stated: null,
            segments: [],
            tieAtStated: false,
            explain: () => "",
          },
          alt,
          altLord,
          { kind: "at_stated_time" },
          { boundary: true, time: false, tie: false },
          altBody.atBirth.longitudeDeg,
          `If the Ascendant were in ${rashiLabel(neighbourAscSign)}, the seventh sign would be ${rashiLabel(altSeventh)}, ruled by ${grahaLabel(altLord)}, which is in ${alt.nakshatraName} Pada ${alt.pada} → ${syllableText(alt)}.`,
          ["Boundary alternative: the Ascendant is within the measured engine tolerance of a sign boundary."],
        ),
      });
    }
  }
  return { evaluation: toEvaluation(rule, outcomes, null), outcomes };
}

// ---------------------------------------------------------------- Darakaraka
export function evaluateDarakaraka(chart: ChartResult, rule: RuleDefinition): { evaluation: RuleEvaluation; outcomes: RuleOutcome[] } {
  const ck = chart.charaKarakas;
  const schemeText = ck.scheme === "eight_planet" ? "eight-planet (Rahu at 30° − degree)" : "seven-planet";
  if (ck.atBirth?.tie) {
    assertCanEmitSyllable(rule, "darakaraka");
    return {
      evaluation: toEvaluation(
        rule,
        [],
        `The two lowest Chara Karaka degrees differ by only ${ck.atBirth.lowestGapArcsec.toFixed(2)}″, inside the combined engine tolerance, so the Darakaraka cannot be determined.`,
      ),
      outcomes: [],
    };
  }
  const dkBody = ck.atBirth ? chart.bodies.find((b) => b.body === ck.atBirth?.darakaraka.body) : undefined;
  const outcomes = evaluatePoint({
    rule,
    mappingPoint: "darakaraka",
    pointRole: "darakaraka",
    stated:
      ck.atBirth && dkBody?.atBirth
        ? {
            point: ck.atBirth.darakaraka.body,
            padaIndex: ck.atBirth.darakaraka.padaIndex,
            longitudeDeg: dkBody.atBirth.longitudeDeg,
            boundarySensitive: dkBody.boundarySensitive,
            toleranceArcsec: dkBody.toleranceArcsec,
          }
        : null,
    segments: ck.window.segments.map((s) => ({ ...s, value: { point: s.value.body, padaIndex: s.value.padaIndex, tie: s.value.tie } })),
    tieAtStated: false,
    explain: (point, e) =>
      `Under the ${schemeText} Chara Karaka scheme, ${grahaLabel(point)} has the lowest degree within its sign, making it the Darakaraka; it is in ${e.nakshatraName} Pada ${e.pada}, which the table maps to ${syllableText(e)}.`,
  });
  return { evaluation: toEvaluation(rule, outcomes, "Not enough information to determine the Darakaraka."), outcomes };
}

// ---------------------------------------------------------------- aggregation
const KIND_PASS: Record<OutcomeKind, number> = {
  stated: 0,
  whole_window: 0,
  boundary_alternative: 1,
  time_conditional: 2,
};

function qualifiersFor(evidenceList: CandidateEvidence[]): CandidateQualifier[] {
  const q = new Set<CandidateQualifier>(["experimental_rule", "provisional_mapping"]);
  for (const e of evidenceList) {
    if (e.boundarySensitive) q.add("boundary_sensitive");
    if (e.timeSensitive) q.add("time_sensitive");
    if (e.condition.kind === "time_range") q.add("time_conditional");
    if (e.tieSensitive) q.add("tie_sensitive");
  }
  return [...q];
}

/**
 * Builds the partner reading from per-rule outcomes. Candidates with the same sound
 * (IAST phonetic key) are merged and keep every supporting rule as separate evidence —
 * agreement between rules is NOT turned into extra confidence.
 */
export function buildPartnerReading(
  perRule: { rule: RuleDefinition; outcomes: RuleOutcome[]; unavailableReason: string | null }[],
  anyPartnerRuleEnabled: boolean,
): PartnerReading {
  if (!anyPartnerRuleEnabled) {
    return {
      status: "not_enabled",
      primary: null,
      alternatives: [],
      orderingPolicy: ORDERING_POLICY,
      unavailableReasons: ["Experimental partner-syllable readings were not selected."],
    };
  }
  const ordered = [...perRule].sort((a, b) => (a.rule.displayOrder ?? 99) - (b.rule.displayOrder ?? 99));
  const flat: RuleOutcome[] = [];
  for (const pass of [0, 1, 2]) {
    for (const r of ordered) {
      const list = r.outcomes.filter((o) => KIND_PASS[o.kind] === pass);
      if (pass === 2) {
        list.sort((a, b) => {
          const ta = a.evidence.condition.kind === "time_range" ? a.evidence.condition.fromUtc : "";
          const tb = b.evidence.condition.kind === "time_range" ? b.evidence.condition.fromUtc : "";
          return ta.localeCompare(tb);
        });
      }
      flat.push(...list);
    }
  }

  const byKey = new Map<string, { syllable: SyllableEntry; evidence: CandidateEvidence[]; firstPass: number }>();
  const order: string[] = [];
  for (const o of flat) {
    const key = o.syllable.phoneticKey;
    const existing = byKey.get(key);
    if (existing) existing.evidence.push(o.evidence);
    else {
      byKey.set(key, { syllable: o.syllable, evidence: [o.evidence], firstPass: KIND_PASS[o.kind] });
      order.push(key);
    }
  }
  const candidates: (SymbolicCandidate & { firstPass: number })[] = order.map((key, i) => {
    const c = byKey.get(key)!;
    return {
      id: `syllable:${key}`,
      syllable: c.syllable,
      displayOrder: i + 1,
      evidence: c.evidence,
      qualifiers: qualifiersFor(c.evidence),
      score: null,
      firstPass: c.firstPass,
    };
  });

  const strip = ({ firstPass: _f, ...rest }: SymbolicCandidate & { firstPass: number }): SymbolicCandidate => {
    void _f;
    return rest;
  };
  const primaryRaw = candidates.length > 0 && candidates[0].firstPass === 0 ? candidates[0] : null;
  const primary = primaryRaw ? strip(primaryRaw) : null;
  const alternatives = candidates.filter((c) => c !== primaryRaw).map(strip);
  const unavailableReasons = perRule
    .filter((r) => r.outcomes.length === 0 && r.unavailableReason)
    .map((r) => `${r.rule.name}: ${r.unavailableReason}`);

  const sensitive = (c: SymbolicCandidate) =>
    c.qualifiers.some((q) => q === "boundary_sensitive" || q === "time_sensitive" || q === "tie_sensitive" || q === "time_conditional");
  const status: PartnerReading["status"] =
    candidates.length === 0 ? "unavailable" : primary && !sensitive(primary) ? "available" : "limited";

  return { status, primary, alternatives, orderingPolicy: ORDERING_POLICY, unavailableReasons };
}
