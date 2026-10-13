/**
 * Reading pipeline (prediction assembly). Runs real stages in order and reports each
 * stage only after it has actually completed:
 *   validate → chart → indicators → numerology → reading
 * Failures become typed errors; a failed calculation is never returned as success.
 */
import { AVAKAHADA_SOURCES, AVAKAHADA_TABLE_VERSION } from "@/lib/avakahada/table";
import { CHART_SCHEMA_VERSION, type CalculationWarning, type ChartResult, type ChartSettings } from "@/lib/contracts/chart";
import type { ApiErrorCode } from "@/lib/contracts/api";
import type { ChartRequest, ReadingRequest } from "@/lib/contracts/input";
import { READING_SCHEMA_VERSION, type ReadingResult, type ReadingStage, type SourceReference } from "@/lib/contracts/reading";
import { computeNumerology } from "@/lib/numerology/numerology";
import {
  buildPartnerReading,
  evaluateDarakaraka,
  evaluateMoonNaming,
  evaluateSeventhLord,
  nativeNamingResult,
  notEnabledEvaluation,
  type RuleOutcome,
} from "@/lib/reading/candidates";
import { PARTNER_RULE_IDS } from "@/lib/rules/ids";
import { RULE_SET_VERSION, getRule, validateRegistry, type RuleDefinition } from "@/lib/rules/registry";
import { APP_VERSION } from "@/lib/version";
import { computeChart } from "@/server/chart/compute-chart";
import { buildTimeContext, normalizeBirth } from "@/server/chart/time-context";
import { EngineUnavailableError, type EphemerisProvider } from "@/server/ephemeris/types";

export const READING_DISCLAIMER =
  "SoulLetter offers symbolic interpretations for reflection and entertainment. A syllable shown here is not a " +
  "scientifically validated prediction of a future partner's name, initial or identity, and no accuracy or probability is implied.";

export const READING_LIMITATIONS: readonly string[] = [
  "No scientific method is known to identify a future partner's name or initial from astrology, numerology or palmistry.",
  "Partner syllables come from experimental symbolic rules that are not established classical techniques.",
  "The Avakahada syllable table is provisional: it is compiled from modern secondary sources and regional tables differ.",
  "Display order is a presentation preference. Agreement between methods is not evidence of correctness.",
  "Astronomical positions are calculated with documented conventions and measured tolerances; values close to a boundary are flagged rather than rounded.",
];

export const READING_SOURCES: readonly SourceReference[] = [
  ...AVAKAHADA_SOURCES.map((s) => ({ id: `avakahada-${s.id}`, label: s.label, url: s.url, note: s.supports })),
  {
    id: "astronomy-engine",
    label: "Astronomy Engine (Don Cross), MIT licence",
    url: "https://github.com/cosinekitty/astronomy",
    note: "Production ephemeris; README states accuracy within ±1 arcminute. Measured agreement with Swiss Ephemeris is published in tools/reference/agreement.json.",
  },
  {
    id: "swiss-ephemeris",
    label: "Swiss Ephemeris (Astrodienst) — programmer documentation and licensing",
    url: "https://www.astro.com/swisseph/swephinfo_h.htm",
    note: "Independent reference engine (SE_SIDM_LAHIRI) used for verification; AGPL-3.0 or Professional Licence.",
  },
  {
    id: "jpl-horizons",
    label: "NASA/JPL Horizons API",
    url: "https://ssd-api.jpl.nasa.gov/doc/horizons.html",
    note: "Independent apparent geocentric ecliptic longitudes used in reference tests.",
  },
  {
    id: "helgertz-scott-2020",
    label: "Helgertz & Scott (2020), Genus 76:34",
    url: "https://doi.org/10.1186/s41118-020-00103-5",
    note: "Found no consistent support for tested Sun-sign compatibility hypotheses in Swedish register data. It did not test name initials.",
  },
];

export type PipelineFailure = {
  ok: false;
  code: ApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
};
export type ChartOutcome = { ok: true; chart: ChartResult } | PipelineFailure;
export type ReadingOutcome = { ok: true; result: ReadingResult } | PipelineFailure;
export type StageListener = (stage: ReadingStage, status: "completed" | "skipped", detail?: string) => void | Promise<void>;

const yieldToEventLoop = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function calculationFailure(error: unknown): PipelineFailure {
  if (error instanceof EngineUnavailableError) {
    return { ok: false, code: "ENGINE_UNAVAILABLE", message: "The calculation engine is not available right now." };
  }
  return {
    ok: false,
    code: "CALCULATION_FAILED",
    message: "The chart could not be calculated for these details. Please check them and try again.",
  };
}

/** Validation stage + chart stage shared by /chart and /readings. */
export async function runChart(
  request: ChartRequest,
  provider: EphemerisProvider,
  onStage?: StageListener,
): Promise<ChartOutcome> {
  const problems = validateRegistry();
  if (problems.length > 0) {
    return { ok: false, code: "INTERNAL_ERROR", message: "The interpretation registry failed validation." };
  }
  const birth = normalizeBirth(request.birth);
  const time = buildTimeContext(birth);
  if (!time.ok) return { ok: false, code: time.code, message: time.message, details: time.details };
  await onStage?.("validate", "completed");
  await yieldToEventLoop();

  try {
    const chart = computeChart({ birth, ctx: time.ctx, settings: request.settings as ChartSettings, provider });
    await onStage?.("chart", "completed");
    return { ok: true, chart };
  } catch (error) {
    return calculationFailure(error);
  }
}

export async function runReading(
  request: ReadingRequest,
  provider: EphemerisProvider,
  onStage?: StageListener,
): Promise<ReadingOutcome> {
  const chartOutcome = await runChart({ birth: request.birth, settings: request.settings }, provider, onStage);
  if (!chartOutcome.ok) return chartOutcome;
  const chart = chartOutcome.chart;
  await yieldToEventLoop();

  // ---- indicators: evaluate only enabled, registered rules
  const enabled = new Set(request.enabledRuleIds);
  const rule = (id: string): RuleDefinition => {
    const r = getRule(id);
    if (!r) throw new Error(`Unregistered rule ${id}`);
    return r;
  };
  let evaluations;
  let native;
  let partner;
  try {
    const nativeRule = rule("naming.moon-pada-avakahada");
    const nativeEval = enabled.has(nativeRule.id) ? evaluateMoonNaming(chart, nativeRule) : null;
    native = nativeNamingResult(nativeEval ? nativeRule : null, nativeEval?.outcomes ?? []);

    const partnerEvals: { rule: RuleDefinition; outcomes: RuleOutcome[]; unavailableReason: string | null }[] = [];
    evaluations = [nativeEval ? nativeEval.evaluation : notEnabledEvaluation(nativeRule)];
    for (const id of PARTNER_RULE_IDS) {
      const r = rule(id);
      if (!enabled.has(id)) {
        evaluations.push(notEnabledEvaluation(r));
        continue;
      }
      const result = id === "partner.seventh-lord-pada-avakahada" ? evaluateSeventhLord(chart, r) : evaluateDarakaraka(chart, r);
      evaluations.push(result.evaluation);
      partnerEvals.push({ rule: r, outcomes: result.outcomes, unavailableReason: result.evaluation.reason });
    }
    partner = buildPartnerReading(partnerEvals, PARTNER_RULE_IDS.some((id) => enabled.has(id)));
  } catch (error) {
    return calculationFailure(error);
  }
  await onStage?.("indicators", "completed");
  await yieldToEventLoop();

  // ---- numerology (independent; never touches candidates)
  const numerology = computeNumerology({
    birthDate: request.birth.birthDate,
    settings: request.numerology,
    enabledRuleIds: request.enabledRuleIds,
    name: request.name,
  });
  await onStage?.("numerology", numerology.status === "calculated" ? "completed" : "skipped");
  await yieldToEventLoop();

  // ---- assemble
  const warnings: CalculationWarning[] = [...chart.warnings];
  if (PARTNER_RULE_IDS.some((id) => enabled.has(id))) {
    warnings.push({
      code: "EXPERIMENTAL_RULE",
      severity: "important",
      message:
        "Partner syllables come from experimental symbolic rules. They are not established classical techniques and have never been shown to predict a partner's name.",
    });
  }
  if (enabled.has("naming.moon-pada-avakahada") || PARTNER_RULE_IDS.some((id) => enabled.has(id))) {
    warnings.push({
      code: "PROVISIONAL_MAPPING",
      severity: "info",
      message: `Syllables use the provisional Avakahada table ${AVAKAHADA_TABLE_VERSION}, compiled from modern secondary sources; regional tables differ.`,
    });
  }
  for (const u of numerology.unavailable) {
    warnings.push({ code: "NAME_NOT_SUPPORTED", severity: "info", subject: u.ruleId, message: u.reason });
  }

  const result: ReadingResult = {
    schemaVersion: READING_SCHEMA_VERSION,
    status: "completed",
    versions: {
      app: APP_VERSION,
      readingSchema: READING_SCHEMA_VERSION,
      chartSchema: CHART_SCHEMA_VERSION,
      ruleSet: RULE_SET_VERSION,
      avakahadaTable: AVAKAHADA_TABLE_VERSION,
      engine: `${chart.engine.provider} ${chart.engine.libraryVersion}`,
    },
    chart,
    native,
    partner,
    evaluations,
    numerology,
    coverage: chart.coverage,
    warnings,
    limitations: [...READING_LIMITATIONS],
    disclaimer: READING_DISCLAIMER,
    sources: [...READING_SOURCES],
  };
  await onStage?.("reading", "completed");
  return { ok: true, result };
}
