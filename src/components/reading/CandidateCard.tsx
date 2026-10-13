import { Badge, Card, FlaskIcon, StatusBadge, cn } from "@/components/ui";
import type { TimeContext } from "@/lib/contracts/chart";
import type { SymbolicCandidate, SyllableEntry, VerificationStatus } from "@/lib/contracts/reading";
import { EvidenceList } from "./EvidenceList";
import { QUALIFIER_INFO } from "./format";
import { ROMANIZATION_NOTE, SyllableDisplay } from "./SyllableDisplay";

export const NOT_A_PREDICTION =
  "A candidate is not a scientifically validated prediction of a future partner's name, initial or identity.";

function uniqueStatuses(c: SymbolicCandidate): VerificationStatus[] {
  return [...new Set(c.evidence.map((e) => e.verificationStatus))];
}

/** Table provenance for a syllable (status, sources and any regional variant). */
export function SyllableProvenance({ syllable }: { syllable: SyllableEntry }) {
  return (
    <p className="text-xs leading-relaxed text-mist-400">
      Avakahada table cell {syllable.cellId} ({syllable.nakshatraName} Pada {syllable.pada}) —{" "}
      {syllable.status === "provisional_secondary_source"
        ? "provisional entry from secondary sources"
        : "entry verified against a primary source"}{" "}
      ({syllable.sourceIds.join(", ")}).
      {syllable.variantNote ? ` Variant: ${syllable.variantNote}` : ""}
    </p>
  );
}

export interface CandidateCardProps {
  candidate: SymbolicCandidate;
  time: TimeContext;
  variant: "primary" | "alternative";
  headingLevel?: "h3" | "h4";
  testId?: string;
  /** Heading for alternatives, e.g. "Also shown · position" or "Possibility" (the display order is appended). */
  alternativeLabel?: string;
}

/** A partner-syllable candidate with every piece of evidence and its qualifiers. */
export function CandidateCard({
  candidate,
  time,
  variant,
  headingLevel = "h3",
  testId,
  alternativeLabel = "Also shown · position",
}: CandidateCardProps) {
  const Heading = headingLevel;
  const headingId = `candidate-${candidate.syllable.cellId}-${variant}`;
  const statuses = uniqueStatuses(candidate);
  const primary = variant === "primary";

  return (
    <Card
      as="article"
      variant={primary ? "glow" : "default"}
      padding={primary ? "lg" : "md"}
      aria-labelledby={headingId}
      data-testid={testId}
      data-cell-id={candidate.syllable.cellId}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-2">
        <Heading id={headingId} className={cn("font-display text-ivory-50", primary ? "text-2xl" : "text-xl")}>
          {primary ? "Shown first" : `${alternativeLabel} ${candidate.displayOrder}`}
          <span className="sr-only">
            : {candidate.syllable.roman}, {candidate.syllable.iast}
          </span>
        </Heading>
        <p className="text-sm text-mist-300">Presentation order only — not a measure of likelihood.</p>
      </div>

      <div className={cn("flex flex-col gap-4", primary ? "items-center" : "sm:flex-row sm:items-center sm:gap-6")}>
        <SyllableDisplay syllable={candidate.syllable} size={primary ? "lg" : "sm"} align={primary ? "center" : "start"} />
        <div className={cn("flex flex-col gap-2", primary ? "items-center text-center" : "items-start")}>
          <div className="flex flex-wrap gap-1.5">
            {statuses.map((s) => (
              <StatusBadge key={s} status={s} size="md" />
            ))}
          </div>
          {candidate.qualifiers.length > 0 ? (
            <ul className={cn("flex flex-wrap gap-1.5", primary && "justify-center")} aria-label="Qualifiers">
              {candidate.qualifiers.map((q) => (
                <li key={q}>
                  <Badge tone={QUALIFIER_INFO[q].tone} title={QUALIFIER_INFO[q].description}>
                    {QUALIFIER_INFO[q].label}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {statuses.includes("experimental_symbolic") ? (
        <p className="flex items-start gap-2 rounded-[0.9rem] border border-status-experimental/30 bg-indigo-950/50 p-3 text-sm leading-relaxed text-ivory-100">
          <FlaskIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-status-experimental" />
          <span>
            <strong className="font-semibold">Experimental symbolic interpretation.</strong> {NOT_A_PREDICTION}
          </span>
        </p>
      ) : null}

      {primary && candidate.qualifiers.length > 0 ? (
        <dl className="grid gap-1.5 text-sm">
          {candidate.qualifiers.map((q) => (
            <div key={q} className="flex flex-col sm:flex-row sm:gap-2">
              <dt className="shrink-0 font-medium text-mist-200">{QUALIFIER_INFO[q].label}:</dt>
              <dd className="text-mist-300">{QUALIFIER_INFO[q].description}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-mist-200">Why this syllable is shown</p>
        <EvidenceList evidence={candidate.evidence} time={time} />
      </div>

      <div className="flex flex-col gap-1.5">
        <SyllableProvenance syllable={candidate.syllable} />
        <p className="text-xs leading-relaxed text-mist-400">{ROMANIZATION_NOTE}</p>
      </div>
    </Card>
  );
}
