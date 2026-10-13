import { Card, StatusBadge } from "@/components/ui";
import type { CandidateQualifier, ReadingResult } from "@/lib/contracts/reading";
import { CandidateCard, NOT_A_PREDICTION } from "./CandidateCard";
import { QUALIFIER_INFO } from "./format";

/** Partner-syllable results: the first-shown candidate (or why there is none) and every alternative. */
export function PartnerSection({ result }: { result: ReadingResult }) {
  const { partner } = result;
  const time = result.chart.time;
  const partnerEvaluations = result.evaluations.filter((e) => e.ruleId.startsWith("partner."));
  const timeDependent = partnerEvaluations.some((e) => e.status === "time_dependent");
  const allConditional =
    partner.alternatives.length > 0 && partner.alternatives.every((a) => a.qualifiers.includes("time_conditional"));
  const altQualifiers = [...new Set(partner.alternatives.flatMap((a) => a.qualifiers))] as CandidateQualifier[];

  return (
    <section aria-labelledby="partner-heading" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="partner-heading" className="font-display text-3xl text-ivory-50">
            Symbolic partner syllables
          </h2>
          <StatusBadge status="experimental_symbolic" size="md" />
        </div>
        <p className="max-w-prose text-[0.9375rem] text-mist-300">
          Experimental symbolic interpretation. {NOT_A_PREDICTION}
        </p>
      </div>

      {partner.status === "not_enabled" ? (
        <Card as="div" variant="outline">
          <p className="text-ivory-100">Partner-syllable rules were not selected for this reading.</p>
        </Card>
      ) : partner.primary ? (
        <CandidateCard candidate={partner.primary} time={time} variant="primary" testId="primary-candidate" />
      ) : (
        <Card as="article" variant="elevated" aria-labelledby="partner-unavailable-heading" data-testid="partner-unavailable">
          <h3 id="partner-unavailable-heading" className="font-display text-2xl text-ivory-50">
            {partner.alternatives.length > 0
              ? "No single syllable can be shown first"
              : "No partner syllable could be calculated"}
          </h3>
          <div className="mt-3 flex flex-col gap-3 text-[0.9375rem] leading-relaxed text-ivory-100">
            {timeDependent || allConditional ? (
              <p>
                The result depends on your birth time, which is unknown or not precise enough. Each possibility below
                applies only to the birth-time range shown with it. We don&apos;t choose between them.
              </p>
            ) : null}
            {partner.unavailableReasons.length > 0 ? (
              <div>
                <p className="text-sm font-medium text-mist-200">Reported by the calculation service:</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-mist-300">
                  {partner.unavailableReasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {partnerEvaluations
              .filter((e) => e.reason && !partner.unavailableReasons.some((r) => r.includes(e.reason ?? "")))
              .map((e) => (
                <p key={e.ruleId} className="text-sm text-mist-300">
                  <span className="font-medium text-mist-200">{e.name}:</span> {e.reason}
                </p>
              ))}
          </div>
        </Card>
      )}

      {partner.alternatives.length > 0 ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="font-display text-2xl text-ivory-50">
              {partner.primary ? "Also shown" : "Possibilities that depend on birth time"}
            </h3>
            <p className="text-sm text-mist-300">
              {partner.primary
                ? "Boundary and birth-time alternatives, and results of the other rule. Listed in a fixed presentation order, not by likelihood."
                : "Listed in a fixed presentation order, not by likelihood. Each applies only under the condition shown."}
            </p>
          </div>
          {altQualifiers.length > 0 ? (
            <dl className="grid gap-1.5 rounded-[0.9rem] border border-line bg-night-800/40 p-3.5 text-sm">
              {altQualifiers.map((q) => (
                <div key={q} className="flex flex-col sm:flex-row sm:gap-2">
                  <dt className="shrink-0 font-medium text-mist-200">{QUALIFIER_INFO[q].label}:</dt>
                  <dd className="text-mist-300">{QUALIFIER_INFO[q].description}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <ul data-testid="alternatives" className="flex flex-col gap-4">
            {partner.alternatives.map((c) => (
              <li key={c.id}>
                <CandidateCard
                  candidate={c}
                  time={time}
                  variant="alternative"
                  headingLevel="h4"
                  alternativeLabel={partner.primary ? "Also shown · position" : "Possibility"}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
