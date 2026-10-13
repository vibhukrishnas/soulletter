"use client";

import { useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useReducer, useRef, useSyncExternalStore } from "react";
import { Button, Callout, Spinner } from "@/components/ui";
import { ChartCheckpoint } from "@/components/reading/ChartCheckpoint";
import { ResultsView } from "@/components/reading/ResultsView";
import { ApiClientError, streamReading } from "@/lib/client/api";
import {
  STEPS,
  loadProgress,
  saveProgress,
  toReadingRequest,
  validateRequest,
  validateStep,
  type FieldErrors,
  type MethodToggles,
  type OnboardingValues,
  type StepId,
} from "@/lib/client/onboarding";
import { clearReading, clearStoredDetails, loadReading, saveReading } from "@/lib/client/reading-storage";
import type { ApiError } from "@/lib/contracts/api";
import { CalculationProgress } from "./CalculationProgress";
import {
  NOTICE_ID,
  PHASE_HEADING_ID,
  RESULTS_HEADING_ID,
  REVEAL_SKIP_ID,
  STEP_HEADING_ID,
  controlIdForError,
} from "./field-ids";
import { flowReducer, initialFlowState, stepIndex, type FlowState } from "./flow-state";
import { OnboardingForm } from "./OnboardingForm";

/** Minimum time each newly completed stage stays on screen before the next is shown. */
const STAGE_MIN_MS = 320;
/** Pause after the last stage before the chart summary opens. */
const COMPLETE_HOLD_MS = 650;

const UNKNOWN_ERROR: ApiError = {
  code: "INTERNAL_ERROR",
  message: "Something went wrong while calculating. Please try again.",
};

/** Restores progress and the last reading from sessionStorage (client only). */
function restoreState(): FlowState {
  const state = initialFlowState();
  const progress = loadProgress();
  if (progress) {
    state.values = progress.values;
    state.step = progress.step;
    state.dirty = true;
  }
  const stored = loadReading();
  if (stored) {
    state.result = stored.result;
    state.revealed = stored.revealed;
    state.phase = stored.revealed ? "results" : "checkpoint";
  }
  return state;
}

const STEP_VALIDATION_ORDER: readonly StepId[] = ["profile", "birth", "preferences"];

function hasErrors(e: FieldErrors): boolean {
  return Object.values(e).some(Boolean);
}

function Flow() {
  const [state, dispatch] = useReducer(flowReducer, undefined, restoreState);
  const reducedMotion = useReducedMotion();
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(state.run.id);

  const { values, step, phase, run, result, revealed, dirty } = state;

  // ── Persistence ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (dirty) saveProgress(values, step);
  }, [values, step, dirty]);

  useEffect(() => {
    if (result) saveReading(result, revealed);
  }, [result, revealed]);

  // ── Abort any in-flight calculation when leaving the page ────────────────
  useEffect(() => () => abortRef.current?.abort(), []);

  // ── Stage display queue: shows received stage events one at a time ───────
  useEffect(() => {
    if (phase !== "calculating" || run.error) return;
    if (run.queue.length > 0) {
      const t = setTimeout(() => dispatch({ type: "stageShown", runId: run.id }), STAGE_MIN_MS);
      return () => clearTimeout(t);
    }
    if (run.result) {
      const t = setTimeout(() => dispatch({ type: "runCompleted", runId: run.id }), COMPLETE_HOLD_MS);
      return () => clearTimeout(t);
    }
  }, [phase, run]);

  // ── Focus management ─────────────────────────────────────────────────────
  const focusRequest = state.focus;
  const errors = state.errors;
  const handledFocus = useRef(focusRequest?.nonce ?? 0);
  useEffect(() => {
    // Act once per focus request (the nonce changes with every request).
    if (!focusRequest || focusRequest.nonce === handledFocus.current) return;
    handledFocus.current = focusRequest.nonce;
    const target = focusRequest.target;
    let el: HTMLElement | null = null;
    if (typeof target === "object") {
      for (const field of Object.keys(errors)) {
        const id = controlIdForError(field, step, values);
        el = id ? document.getElementById(id) : null;
        if (el) break;
      }
      el ??= document.getElementById(STEP_HEADING_ID);
    } else if (target === "step-heading") el = document.getElementById(STEP_HEADING_ID);
    else if (target === "phase-heading") el = document.getElementById(PHASE_HEADING_ID);
    else if (target === "results-heading") el = document.getElementById(RESULTS_HEADING_ID);
    else if (target === "notice") el = document.getElementById(NOTICE_ID) ?? document.getElementById(STEP_HEADING_ID);
    else if (target === "reveal-skip") {
      el = document.getElementById(REVEAL_SKIP_ID) ?? document.getElementById(RESULTS_HEADING_ID);
    }
    if (el) {
      el.focus({ preventScroll: true });
      el.scrollIntoView({
        block: typeof target === "object" ? "center" : "start",
        behavior: reducedMotion ? "auto" : "smooth",
      });
    }
  }, [focusRequest, errors, step, values, reducedMotion]);

  // ── Calculation ──────────────────────────────────────────────────────────
  const runCalculation = useCallback((formValues: OnboardingValues) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    runIdRef.current += 1;
    const runId = runIdRef.current;
    clearReading();
    dispatch({ type: "startRun", runId });
    streamReading(
      toReadingRequest(formValues),
      (stage, status) => dispatch({ type: "stageReceived", runId, stage, status }),
      controller.signal,
    )
      .then((reading) => dispatch({ type: "runSucceeded", runId, result: reading }))
      .catch((e: unknown) => {
        if (controller.signal.aborted || (e instanceof Error && e.name === "AbortError")) return;
        dispatch({ type: "runFailed", runId, error: e instanceof ApiClientError ? e.error : UNKNOWN_ERROR });
      });
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const onChange = (patch: Partial<OnboardingValues>) => dispatch({ type: "change", patch });
  const onChangeMethods = (patch: Partial<MethodToggles>) => dispatch({ type: "changeMethods", patch });
  const onGoToStep = (target: StepId) => dispatch({ type: "goToStep", step: target });

  function onContinue() {
    const e = validateStep(step, values);
    if (hasErrors(e)) {
      dispatch({ type: "showErrors", errors: e });
      return;
    }
    const next = STEPS[stepIndex(step) + 1];
    if (next) dispatch({ type: "goToStep", step: next.id });
  }

  function onBack() {
    const prev = STEPS[stepIndex(step) - 1];
    if (prev) dispatch({ type: "goToStep", step: prev.id });
  }

  function onSubmit() {
    for (const s of STEP_VALIDATION_ORDER) {
      const e = validateStep(s, values);
      if (hasErrors(e)) {
        dispatch({ type: "showErrors", errors: e, step: s });
        return;
      }
    }
    const requestErrors = validateRequest(toReadingRequest(values));
    if (hasErrors(requestErrors)) {
      const { _form, ...fieldErrors } = requestErrors;
      if (Object.keys(fieldErrors).length > 0) {
        const target: StepId =
          "birthDate" in fieldErrors || "name" in fieldErrors
            ? "profile"
            : "acknowledgeExperimental" in fieldErrors
              ? "preferences"
              : "birth";
        dispatch({ type: "showErrors", errors: requestErrors, step: target });
      } else {
        dispatch({ type: "showErrors", errors: { _form }, step: "review" });
      }
      return;
    }
    runCalculation(values);
  }

  function onCancel() {
    abortRef.current?.abort();
    abortRef.current = null;
    dispatch({ type: "cancelRun" });
  }

  function onChooseOccurrence(choice: "earlier" | "later") {
    dispatch({ type: "setDstChoice", choice });
    runCalculation({ ...values, dstChoice: choice });
  }

  function onReveal() {
    dispatch({ type: reducedMotion ? "revealDone" : "reveal" });
  }

  function onEditDetails(target: StepId = "review") {
    abortRef.current?.abort();
    clearReading();
    dispatch({ type: "editDetails", step: target });
  }

  function resetAll(notice: string | null) {
    abortRef.current?.abort();
    clearStoredDetails();
    dispatch({ type: "reset", notice });
  }

  const onClearDetails = () =>
    resetAll("Your details and any reading were cleared from this browser tab. Nothing was stored on our servers.");
  const onStartOver = () => resetAll(null);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <p className="text-sm text-mist-300">
          Your answers stay in this browser tab only and are removed when you close it.
        </p>
        <Button variant="ghost" size="sm" onClick={onClearDetails} data-testid="clear-details">
          Clear my details
        </Button>
      </div>

      <div aria-live="polite">
        {state.notice ? (
          <Callout id={NOTICE_ID} tabIndex={-1} tone="info" title="Details cleared" className="focus:outline-none">
            <p>{state.notice}</p>
          </Callout>
        ) : null}
      </div>

      {phase === "form" ? (
        <div className="flex flex-col gap-6">
          {step === "profile" ? (
            <div className="flex flex-col gap-3">
              <h1 className="font-display text-4xl leading-tight text-ivory-50 sm:text-5xl">
                Discover your symbolic syllable
              </h1>
              <p className="max-w-prose text-base text-mist-300">
                Four short steps. We calculate your sidereal birth chart, then show which name syllables the selected
                traditional and experimental methods associate with it — with every qualification.
              </p>
            </div>
          ) : (
            <h1 className="sr-only">Discover your symbolic syllable</h1>
          )}
          <OnboardingForm
            values={values}
            step={step}
            errors={state.errors}
            onChange={onChange}
            onChangeMethods={onChangeMethods}
            onGoToStep={onGoToStep}
            onContinue={onContinue}
            onBack={onBack}
            onSubmit={onSubmit}
          />
        </div>
      ) : null}

      {phase === "calculating" ? (
        <CalculationProgress
          run={run}
          onCancel={onCancel}
          onRetry={() => runCalculation(values)}
          onEdit={(target) => onEditDetails(target)}
          onChooseOccurrence={onChooseOccurrence}
        />
      ) : null}

      {phase === "checkpoint" && result ? (
        <ChartCheckpoint result={result} onReveal={onReveal} onEdit={() => onEditDetails("review")} />
      ) : null}

      {phase === "results" && result ? (
        <ResultsView
          result={result}
          revealed={revealed}
          onRevealDone={() => dispatch({ type: "revealDone" })}
          onEditDetails={() => onEditDetails("review")}
          onStartOver={onStartOver}
          onClearDetails={onClearDetails}
        />
      ) : null}
    </div>
  );
}

const noopSubscribe = () => () => {};

/**
 * The /discover flow. Renders only in the browser (state lives in sessionStorage), so the
 * server sends a lightweight placeholder and there is no hydration mismatch on restore.
 */
export function DiscoverFlow() {
  const isClient = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  if (!isClient) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner size="lg" label="Loading the form" labelVisible />
        <noscript>
          <p className="mt-4 text-mist-300">SoulLetter needs JavaScript to calculate a reading.</p>
        </noscript>
      </div>
    );
  }
  return <Flow />;
}
