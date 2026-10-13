"use client";

import { useEffect, useState } from "react";
import { Button, Callout, CheckIcon, Spinner, cn } from "@/components/ui";
import type { ApiError } from "@/lib/contracts/api";
import { READING_STAGES } from "@/lib/contracts/reading";
import { utcLabel } from "@/components/reading/format";
import { ambiguousOptions, fieldPathLabel, gapOffsets, utcOffsetLabel } from "./calc-errors";
import { PHASE_HEADING_ID } from "./field-ids";
import { stageDisplayStates, type RunState, type StageDisplayState } from "./flow-state";
import type { StepId } from "@/lib/client/onboarding";

const STATE_TEXT: Record<StageDisplayState, string> = {
  pending: "Waiting",
  active: "In progress",
  done: "Done",
  skipped: "Skipped — not needed for the selected methods",
};

function StageIcon({ state }: { state: StageDisplayState }) {
  if (state === "done") {
    return (
      <span className="grid size-7 shrink-0 place-items-center rounded-full border border-gold-300/60 bg-gold-300/15 text-gold-200">
        <CheckIcon strokeWidth={2.4} className="size-3.5" />
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="grid size-7 shrink-0 place-items-center rounded-full border border-gold-300/50 text-gold-200">
        <Spinner size="sm" />
      </span>
    );
  }
  if (state === "skipped") {
    return (
      <span className="grid size-7 shrink-0 place-items-center rounded-full border border-white/20 text-mist-300">
        <span className="block h-px w-3 bg-current" />
      </span>
    );
  }
  return <span className="block size-7 shrink-0 rounded-full border border-white/20 bg-night-900/60" />;
}

function RetryAfter({ seconds, onRetry }: { seconds: number; onRetry: () => void }) {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    if (remaining <= 0) return;
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={onRetry} disabled={remaining > 0}>
        {remaining > 0 ? `Try again in ${remaining} s` : "Try again"}
      </Button>
    </div>
  );
}

export interface CalculationProgressProps {
  run: RunState;
  onCancel: () => void;
  onRetry: () => void;
  onEdit: (step: StepId) => void;
  onChooseOccurrence: (choice: "earlier" | "later") => void;
}

function ErrorActions({
  error,
  runId,
  onRetry,
  onEdit,
  onChooseOccurrence,
}: {
  error: ApiError;
  runId: number;
} & Pick<CalculationProgressProps, "onRetry" | "onEdit" | "onChooseOccurrence">) {
  if (error.code === "AMBIGUOUS_LOCAL_TIME") {
    const options = ambiguousOptions(error.details);
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[0.9375rem] text-ivory-100">
          That local time happened twice that night because the clocks went back. Which occurrence was the birth? The
          birth record or hospital notes may say.
        </p>
        {options ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            {options.map((o) => (
              <Button key={o.choice} variant="secondary" onClick={() => onChooseOccurrence(o.choice)}>
                {o.choice === "earlier" ? "The earlier one" : "The later one"} ({utcOffsetLabel(o.offset)} · {utcLabel(o.utc)})
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-mist-300">The service did not include the two offsets. Please edit the birth time.</p>
        )}
        <div>
          <Button variant="ghost" onClick={() => onEdit("birth")}>
            Edit birth time
          </Button>
        </div>
      </div>
    );
  }
  if (error.code === "NONEXISTENT_LOCAL_TIME") {
    const gap = gapOffsets(error.details);
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[0.9375rem] text-ivory-100">
          On that date the clocks jumped forward
          {gap ? ` from ${utcOffsetLabel(gap.before)} to ${utcOffsetLabel(gap.after)}` : ""}, so this local time never
          happened in the selected time zone. Please check the birth time, the date and the time zone.
        </p>
        <div>
          <Button onClick={() => onEdit("birth")}>Edit birth time</Button>
        </div>
      </div>
    );
  }
  if (error.code === "VALIDATION_ERROR") {
    const entries = Object.entries(error.fieldErrors ?? {});
    return (
      <div className="flex flex-col gap-3">
        {entries.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-[0.9375rem] text-ivory-100">
            {entries.map(([path, messages]) => (
              <li key={path}>
                <span className="font-medium">{fieldPathLabel(path)}:</span> {messages.join(" ")}
              </li>
            ))}
          </ul>
        ) : null}
        <div>
          <Button onClick={() => onEdit("review")}>Edit details</Button>
        </div>
      </div>
    );
  }
  if (error.code === "RATE_LIMITED") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[0.9375rem] text-ivory-100">
          {error.retryAfterSeconds
            ? `Please wait about ${error.retryAfterSeconds} seconds before trying again.`
            : "Please wait a minute before trying again."}
        </p>
        <div className="flex flex-wrap gap-3">
          <RetryAfter key={runId} seconds={error.retryAfterSeconds ?? 0} onRetry={onRetry} />
          <Button variant="ghost" onClick={() => onEdit("review")}>
            Edit details
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-3">
      <Button onClick={onRetry}>Try again</Button>
      <Button variant="secondary" onClick={() => onEdit("review")}>
        Edit details
      </Button>
    </div>
  );
}

/** Live stage list for the running calculation, and the typed error panel when it fails. */
export function CalculationProgress({ run, onCancel, onRetry, onEdit, onChooseOccurrence }: CalculationProgressProps) {
  const states = stageDisplayStates(run);
  const allDone = READING_STAGES.every(({ stage }) => states[stage] === "done" || states[stage] === "skipped");
  const lastShown = [...READING_STAGES].reverse().find(({ stage }) => run.shown[stage] !== undefined);
  const announcement = run.error
    ? ""
    : allDone && run.result
      ? "All stages complete. Opening your chart summary."
      : lastShown
        ? `${lastShown.label}: ${run.shown[lastShown.stage] === "skipped" ? "skipped" : "done"}.`
        : "Calculation started.";

  return (
    <section aria-labelledby={PHASE_HEADING_ID} className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1
          id={PHASE_HEADING_ID}
          tabIndex={-1}
          className="font-display text-4xl leading-tight text-ivory-50 focus:outline-none sm:text-5xl"
        >
          {run.error ? "The calculation could not finish" : "Calculating your reading"}
        </h1>
        {!run.error ? (
          <p className="text-base text-mist-300">
            Each step is marked done only when the calculation service reports that it has finished.
          </p>
        ) : null}
      </div>

      <ol className="flex flex-col gap-3" aria-busy={!run.error && !allDone}>
        {READING_STAGES.map(({ stage, label }) => {
          const state = states[stage];
          return (
            <li
              key={stage}
              data-testid={`stage-${stage}`}
              data-state={state}
              className={cn(
                "flex items-center gap-3 rounded-card border p-4 transition-colors duration-300",
                state === "active" ? "border-gold-300/40 bg-gold-300/[0.05]" : "border-line bg-night-800/50",
              )}
            >
              <StageIcon state={state} />
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-[0.9375rem] leading-snug",
                    state === "pending" ? "text-mist-300" : "text-ivory-50",
                  )}
                >
                  {label}
                </span>
                <span className="block text-sm text-mist-300">{STATE_TEXT[state]}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {run.error ? (
        <div className="flex flex-col gap-4">
          <Callout tone="important" title="We couldn't complete your reading" alert>
            <p>{run.error.message}</p>
            <p className="mt-1 text-sm text-mist-300">No partial or estimated results are shown.</p>
          </Callout>
          <ErrorActions
            error={run.error}
            runId={run.id}
            onRetry={onRetry}
            onEdit={onEdit}
            onChooseOccurrence={onChooseOccurrence}
          />
        </div>
      ) : (
        <div>
          <Button variant="ghost" onClick={onCancel} disabled={allDone && run.result !== null}>
            Cancel
          </Button>
        </div>
      )}
    </section>
  );
}
