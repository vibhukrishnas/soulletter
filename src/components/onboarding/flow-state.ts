/**
 * State machine for the /discover flow: form → calculating → checkpoint → results.
 * Pure (no I/O) so it can be unit tested; persistence and network calls live in
 * DiscoverFlow.
 *
 * Stage display rule: a stage is only ever shown as done/skipped after its NDJSON
 * event has been received. Received events are queued and revealed one by one so each
 * stays readable; the queue can delay a stage's display, never advance it.
 */
import type { ApiError } from "@/lib/contracts/api";
import { READING_STAGES, type ReadingResult, type ReadingStage } from "@/lib/contracts/reading";
import {
  INITIAL_VALUES,
  STEPS,
  type FieldErrors,
  type MethodToggles,
  type OnboardingValues,
  type StepId,
} from "@/lib/client/onboarding";

export type Phase = "form" | "calculating" | "checkpoint" | "results";
export type StageEventStatus = "completed" | "skipped";

export interface RunState {
  id: number;
  /** Events received from the server but not yet displayed (in arrival order). */
  queue: { stage: ReadingStage; status: StageEventStatus }[];
  /** Events already displayed. */
  shown: Partial<Record<ReadingStage, StageEventStatus>>;
  /** Result received; shown once the stage queue has drained. */
  result: ReadingResult | null;
  error: ApiError | null;
}

export type FocusTarget =
  | "step-heading"
  | "phase-heading"
  | "results-heading"
  | "reveal-skip"
  | "notice"
  | { field: string };

export interface FlowState {
  values: OnboardingValues;
  step: StepId;
  errors: FieldErrors;
  /** False until the user changes something (avoids re-saving after "Clear my details"). */
  dirty: boolean;
  phase: Phase;
  run: RunState;
  result: ReadingResult | null;
  revealed: boolean;
  focus: { target: FocusTarget; nonce: number } | null;
  /** Short status message announced politely (e.g. after clearing details). */
  notice: string | null;
}

export const EMPTY_RUN: RunState = { id: 0, queue: [], shown: {}, result: null, error: null };

export function initialFlowState(): FlowState {
  return {
    values: INITIAL_VALUES,
    step: "profile",
    errors: {},
    dirty: false,
    phase: "form",
    run: EMPTY_RUN,
    result: null,
    revealed: false,
    focus: null,
    notice: null,
  };
}

export type FlowAction =
  | { type: "change"; patch: Partial<OnboardingValues> }
  | { type: "changeMethods"; patch: Partial<MethodToggles> }
  | { type: "goToStep"; step: StepId }
  | { type: "showErrors"; errors: FieldErrors; step?: StepId }
  | { type: "startRun"; runId: number }
  | { type: "stageReceived"; runId: number; stage: ReadingStage; status: StageEventStatus }
  | { type: "stageShown"; runId: number }
  | { type: "runSucceeded"; runId: number; result: ReadingResult }
  | { type: "runFailed"; runId: number; error: ApiError }
  | { type: "runCompleted"; runId: number }
  | { type: "cancelRun" }
  | { type: "setDstChoice"; choice: "earlier" | "later" }
  | { type: "reveal" }
  | { type: "revealDone" }
  | { type: "editDetails"; step?: StepId }
  | { type: "reset"; notice: string | null }
  | { type: "dismissNotice" };

/** Fields whose change invalidates an earlier "which occurrence of the repeated hour" answer. */
const DST_SENSITIVE: readonly (keyof OnboardingValues)[] = [
  "birthDate",
  "birthTime",
  "birthTimeKnown",
  "timeZone",
  "placeMode",
];

/** A new focus request; the nonce changes even when the target repeats. */
function focusOn(state: FlowState, target: FocusTarget): FlowState["focus"] {
  return { target, nonce: (state.focus?.nonce ?? 0) + 1 };
}

function withoutKeys(errors: FieldErrors, keys: readonly string[]): FieldErrors {
  if (!keys.some((k) => errors[k] !== undefined)) return errors;
  const next: FieldErrors = { ...errors };
  for (const k of keys) delete next[k];
  return next;
}

export function stepIndex(step: StepId): number {
  return STEPS.findIndex((s) => s.id === step);
}

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case "change": {
      const keys = Object.keys(action.patch) as (keyof OnboardingValues)[];
      const resetDst = keys.some((k) => DST_SENSITIVE.includes(k) && action.patch[k] !== state.values[k]);
      const values: OnboardingValues = { ...state.values, ...action.patch };
      if (resetDst && !("dstChoice" in action.patch)) values.dstChoice = null;
      return { ...state, values, dirty: true, notice: null, errors: withoutKeys(state.errors, [...keys, "_form"]) };
    }
    case "changeMethods": {
      const methods = { ...state.values.methods, ...action.patch };
      return {
        ...state,
        values: { ...state.values, methods },
        dirty: true,
        notice: null,
        errors: withoutKeys(state.errors, ["methods", "acknowledgeExperimental", "name", "_form"]),
      };
    }
    case "goToStep":
      return { ...state, phase: "form", step: action.step, errors: {}, focus: focusOn(state, "step-heading"), notice: null };
    case "showErrors": {
      const firstField = Object.keys(action.errors)[0];
      const step = action.step ?? state.step;
      return {
        ...state,
        phase: "form",
        step,
        errors: action.errors,
        focus: firstField ? focusOn(state, { field: firstField }) : focusOn(state, "step-heading"),
      };
    }
    case "startRun":
      return {
        ...state,
        phase: "calculating",
        errors: {},
        notice: null,
        run: { ...EMPTY_RUN, id: action.runId },
        focus: focusOn(state, "phase-heading"),
      };
    case "stageReceived": {
      if (action.runId !== state.run.id || state.phase !== "calculating") return state;
      return { ...state, run: { ...state.run, queue: [...state.run.queue, { stage: action.stage, status: action.status }] } };
    }
    case "stageShown": {
      if (action.runId !== state.run.id || state.run.queue.length === 0) return state;
      const [next, ...rest] = state.run.queue;
      return { ...state, run: { ...state.run, queue: rest, shown: { ...state.run.shown, [next.stage]: next.status } } };
    }
    case "runSucceeded": {
      if (action.runId !== state.run.id || state.phase !== "calculating") return state;
      return { ...state, run: { ...state.run, result: action.result } };
    }
    case "runFailed": {
      if (action.runId !== state.run.id || state.phase !== "calculating") return state;
      // Every stage that really completed is shown; nothing from the failed run is kept.
      const shown = { ...state.run.shown };
      for (const e of state.run.queue) shown[e.stage] = e.status;
      return { ...state, run: { ...state.run, queue: [], shown, result: null, error: action.error } };
    }
    case "runCompleted": {
      const result = state.run.result;
      if (action.runId !== state.run.id || state.phase !== "calculating" || !result || state.run.queue.length > 0) {
        return state;
      }
      return { ...state, phase: "checkpoint", result, revealed: false, focus: focusOn(state, "phase-heading") };
    }
    case "cancelRun":
      return {
        ...state,
        phase: "form",
        step: "review",
        run: { ...EMPTY_RUN, id: state.run.id },
        focus: focusOn(state, "step-heading"),
      };
    case "setDstChoice":
      return { ...state, values: { ...state.values, dstChoice: action.choice }, dirty: true };
    case "reveal":
      if (!state.result) return state;
      return { ...state, phase: "results", revealed: false, focus: focusOn(state, "reveal-skip") };
    case "revealDone":
      if (!state.result) return state;
      return { ...state, phase: "results", revealed: true, focus: focusOn(state, "results-heading") };
    case "editDetails":
      return {
        ...state,
        phase: "form",
        step: action.step ?? "review",
        errors: {},
        result: null,
        revealed: false,
        run: { ...EMPTY_RUN, id: state.run.id },
        focus: focusOn(state, "step-heading"),
      };
    case "reset":
      return {
        ...initialFlowState(),
        run: { ...EMPTY_RUN, id: state.run.id },
        notice: action.notice,
        focus: focusOn(state, action.notice ? "notice" : "step-heading"),
      };
    case "dismissNotice":
      return state.notice === null ? state : { ...state, notice: null };
  }
}

export type StageDisplayState = "pending" | "active" | "done" | "skipped";

/** Derives what each stage shows. Only stages whose event was displayed can be done/skipped. */
export function stageDisplayStates(run: RunState): Record<ReadingStage, StageDisplayState> {
  const out = {} as Record<ReadingStage, StageDisplayState>;
  let activeAssigned = false;
  for (const { stage } of READING_STAGES) {
    const shown = run.shown[stage];
    if (shown === "completed") out[stage] = "done";
    else if (shown === "skipped") out[stage] = "skipped";
    else if (!run.error && !activeAssigned) {
      out[stage] = "active";
      activeAssigned = true;
    } else out[stage] = "pending";
  }
  return out;
}
