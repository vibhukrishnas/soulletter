import { Card, MoonIcon, StatusBadge } from "@/components/ui";
import type { ReadingResult } from "@/lib/contracts/reading";
import { SyllableProvenance } from "./CandidateCard";
import { EvidenceList } from "./EvidenceList";
import { conditionLabel } from "./format";
import { ROMANIZATION_NOTE, SyllableDisplay } from "./SyllableDisplay";

/** The user's own traditional naming syllable — clearly about them, not a partner prediction. */
export function NativeSyllableCard({ result }: { result: ReadingResult }) {
  const { native } = result;
  const time = result.chart.time;

  return (
    <section aria-labelledby="native-heading" data-testid="native-syllable" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <MoonIcon aria-hidden="true" className="size-6 text-gold-300" />
          <h2 id="native-heading" className="font-display text-3xl text-ivory-50">
            {native.label}
          </h2>
        </div>
        <p className="max-w-prose text-[0.9375rem] text-mist-300">
          In Jyotisha naming practice, a child&apos;s name often begins with the syllable of their birth Moon&apos;s
          Nakshatra Pada. This describes you; it says nothing about a partner.
        </p>
      </div>

      <Card as="div" padding="lg" className="flex flex-col gap-5">
        {native.status === "not_enabled" ? (
          <p className="text-ivory-100">The naming-syllable method was not selected for this reading.</p>
        ) : null}

        {native.status === "unavailable" ? (
          <p className="text-ivory-100">
            Not available{native.reason ? `: ${native.reason}` : "."}
          </p>
        ) : null}

        {native.atStatedTime ? (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col items-center gap-3">
              <SyllableDisplay syllable={native.atStatedTime.syllable} size="md" />
              <StatusBadge status={native.atStatedTime.evidence.verificationStatus} size="md" />
            </div>
            <EvidenceList evidence={[native.atStatedTime.evidence]} time={time} />
            <SyllableProvenance syllable={native.atStatedTime.syllable} />
          </div>
        ) : null}

        {native.status === "time_dependent" && native.reason ? (
          <p className="text-[0.9375rem] text-ivory-100">{native.reason}</p>
        ) : null}

        {native.windowOutcomes.length > 0 ? (
          <div className="flex flex-col gap-3">
            <h3 className="text-base font-semibold text-ivory-50">
              {native.atStatedTime
                ? "Within your birth-time margin it could also be"
                : "Possibilities by birth time — none is chosen for you"}
            </h3>
            <ul className="grid gap-3 sm:grid-cols-2">
              {native.windowOutcomes.map((o, i) => (
                <li
                  key={`${o.syllable.cellId}-${i}`}
                  className="flex flex-col gap-3 rounded-[0.9rem] border border-line bg-night-900/50 p-4"
                >
                  <SyllableDisplay syllable={o.syllable} size="sm" align="start" />
                  <p className="text-sm text-mist-300">{conditionLabel(o.evidence.condition, time)}</p>
                  <p className="text-sm text-ivory-100">{o.evidence.explanation}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {native.status !== "not_enabled" ? (
          <p className="text-xs leading-relaxed text-mist-400">{ROMANIZATION_NOTE}</p>
        ) : null}
      </Card>
    </section>
  );
}
