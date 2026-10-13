"use client";

import { Badge, Button, Callout } from "@/components/ui";
import { RESULTS_HEADING_ID } from "@/components/onboarding/field-ids";
import { SharePanel } from "@/components/share/SharePanel";
import type { ReadingResult } from "@/lib/contracts/reading";
import { CalculationBreakdown } from "./CalculationBreakdown";
import { COVERAGE_LABEL, COVERAGE_TONE } from "./format";
import { NativeSyllableCard } from "./NativeSyllableCard";
import { NumerologySection } from "./NumerologySection";
import { PartnerSection } from "./PartnerSection";
import { RevealHero } from "./RevealHero";
import { TechnicalExplanation } from "./TechnicalExplanation";
import { WarningsSection } from "./WarningsSection";

export interface ResultsViewProps {
  result: ReadingResult;
  /** False while the reveal animation is playing. */
  revealed: boolean;
  onRevealDone: () => void;
  onEditDetails: () => void;
  onStartOver: () => void;
  onClearDetails: () => void;
}

export function ResultsView({
  result,
  revealed,
  onRevealDone,
  onEditDetails,
  onStartOver,
  onClearDetails,
}: ResultsViewProps) {
  return (
    <div className="flex flex-col gap-14">
      <div className="flex flex-col gap-6">
        <h1
          id={RESULTS_HEADING_ID}
          tabIndex={-1}
          className="font-display text-4xl leading-tight text-ivory-50 focus:outline-none sm:text-5xl"
        >
          Your symbolic reading
        </h1>
        <RevealHero result={result} animate={!revealed} onDone={onRevealDone} />
      </div>

      {revealed ? (
        <>
          <Callout tone="important" title="Please read first" titleAs="h2" data-testid="reading-disclaimer">
            <p>{result.disclaimer}</p>
            <p className="mt-3">
              <Badge tone={COVERAGE_TONE[result.coverage.level]} size="md">
                {COVERAGE_LABEL[result.coverage.level]}
              </Badge>
            </p>
          </Callout>

          <PartnerSection result={result} />
          <NativeSyllableCard result={result} />
          <WarningsSection warnings={result.warnings} />
          <SharePanel result={result} />
          <NumerologySection numerology={result.numerology} />
          <CalculationBreakdown chart={result.chart} />
          <TechnicalExplanation result={result} />

          <section aria-labelledby="next-heading" className="flex flex-col gap-4 border-t border-line pt-8">
            <h2 id="next-heading" className="font-display text-3xl text-ivory-50">
              What next
            </h2>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button onClick={onEditDetails}>Edit details</Button>
              <Button variant="secondary" onClick={onStartOver}>
                Start over
              </Button>
              <Button variant="secondary" onClick={onClearDetails} data-testid="clear-details-results">
                Clear my details
              </Button>
            </div>
            <p className="text-sm text-mist-300">
              Clearing removes your answers and this reading from this browser tab. Nothing is kept on our servers.
            </p>
          </section>
        </>
      ) : (
        <p className="sr-only" role="status" aria-live="polite">
          Revealing your reading. Use the Skip animation button to see it straight away.
        </p>
      )}
    </div>
  );
}
