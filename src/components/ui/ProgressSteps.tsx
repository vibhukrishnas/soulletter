import { cn } from "./cn";
import { CheckIcon } from "./icons";

export interface ProgressStep {
  /** Stable key. */
  id: string;
  /** Short visible label, e.g. "Birth details". */
  label: string;
}

export interface ProgressStepsProps {
  steps: readonly ProgressStep[];
  /** Zero-based index of the current step. Clamped to the valid range. */
  currentIndex: number;
  /** Accessible name of the progress navigation landmark. */
  ariaLabel?: string;
  /**
   * When provided, completed steps become buttons that call this with their index, so people
   * can go back and edit earlier answers. Upcoming steps are never clickable.
   */
  onStepSelect?: (index: number) => void;
  className?: string;
}

/**
 * Multi-step indicator: a "Step n of N" summary plus an ordered list of labelled steps with
 * aria-current="step" on the current one. Status is conveyed by text, not colour alone.
 * Labels collapse to the summary on narrow screens but remain available to screen readers.
 *
 * Move focus to the new step's heading when the step changes; this component does not
 * announce changes itself.
 */
export function ProgressSteps({
  steps,
  currentIndex,
  ariaLabel = "Progress",
  onStepSelect,
  className,
}: ProgressStepsProps) {
  if (steps.length === 0) return null;
  const current = Math.min(Math.max(Math.trunc(currentIndex), 0), steps.length - 1);
  const currentStep = steps[current];

  return (
    <nav aria-label={ariaLabel} className={cn("w-full", className)}>
      <p className="mb-3 flex flex-wrap items-baseline gap-x-2 text-sm text-mist-300">
        <span className="font-medium text-ivory-50">
          Step {current + 1} of {steps.length}
        </span>
        <span aria-hidden="true" className="text-mist-500">
          ·
        </span>
        <span>{currentStep.label}</span>
      </p>

      <ol className="flex items-center gap-1.5 sm:gap-2">
        {steps.map((step, index) => {
          const state = index < current ? "complete" : index === current ? "current" : "upcoming";
          const statusText = state === "complete" ? "completed" : state === "current" ? "current step" : "not started";
          const marker = (
            <span
              aria-hidden="true"
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold transition-colors duration-300",
                state === "complete" && "border-gold-300/60 bg-gold-300/15 text-gold-200",
                state === "current" && "border-gold-300 bg-gold-300 text-night-950 shadow-glow-gold",
                state === "upcoming" && "border-white/20 bg-night-900/60 text-mist-400",
              )}
            >
              {state === "complete" ? <CheckIcon strokeWidth={2.4} className="size-3.5" /> : index + 1}
            </span>
          );
          const text = (
            <span
              className={cn(
                "sr-only text-sm leading-tight md:not-sr-only",
                state === "current" ? "font-medium text-ivory-50" : "text-mist-300",
              )}
            >
              {step.label}
              <span className="sr-only"> ({statusText})</span>
            </span>
          );

          return (
            <li
              key={step.id}
              aria-current={state === "current" ? "step" : undefined}
              className={cn("flex min-w-0 items-center gap-1.5 sm:gap-2", index < steps.length - 1 && "flex-1")}
            >
              {state === "complete" && onStepSelect ? (
                <button
                  type="button"
                  onClick={() => onStepSelect(index)}
                  className="group flex min-w-0 items-center gap-2 rounded-full pr-1 text-left hover:text-ivory-50"
                >
                  {marker}
                  {text}
                  <span className="sr-only">, edit this step</span>
                </button>
              ) : (
                <span className="flex min-w-0 items-center gap-2">
                  {marker}
                  {text}
                </span>
              )}
              {index < steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-px min-w-3 flex-1 transition-colors duration-500",
                    index < current ? "bg-gold-300/60" : "bg-white/12",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
