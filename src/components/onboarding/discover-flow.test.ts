import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { INITIAL_VALUES } from "@/lib/client/onboarding";
import { clearStoredDetails, loadReading, saveReading } from "@/lib/client/reading-storage";
import type { ReadingRequest } from "@/lib/contracts/input";
import type { ReadingResult } from "@/lib/contracts/reading";
import { revealSubject } from "@/components/reading/reveal-subject";
import { shareRequestFor } from "@/components/share/share-request";
import { AstronomyEngineProvider } from "@/server/ephemeris/astronomy-engine-provider";
import { runReading } from "@/server/reading/pipeline";
import { ambiguousOptions, fieldPathLabel, gapOffsets } from "./calc-errors";
import { flowReducer, initialFlowState, stageDisplayStates, type FlowState } from "./flow-state";

const provider = new AstronomyEngineProvider();

function request(known: boolean): ReadingRequest {
  return {
    birth: {
      birthDate: "1990-10-15",
      birthTimeKnown: known,
      birthTime: known ? "14:30" : null,
      birthTimeAccuracy: known ? "to_the_minute" : null,
      dstChoice: null,
      place: { label: "New Delhi", latitude: 28.6139, longitude: 77.209, timeZone: "Asia/Kolkata" },
    },
    settings: {
      zodiac: "sidereal",
      ayanamsha: "lahiri",
      chart: "D1",
      houseSystem: "whole_sign",
      nodeType: "mean",
      charaKarakaScheme: "seven_planet",
    },
    numerology: { lifePathMethod: "reduce_components", masterNumbers: "keep_11_22_33", yHandling: "consonant" },
    enabledRuleIds: [
      "naming.moon-pada-avakahada",
      "partner.seventh-lord-pada-avakahada",
      "partner.darakaraka-pada-avakahada",
      "numerology.life-path",
    ],
    acknowledgeExperimental: true,
    name: null,
  };
}

async function reading(known: boolean): Promise<ReadingResult> {
  const r = await runReading(request(known), provider);
  if (!r.ok) throw new Error(r.message);
  return r.result;
}

let exact: ReadingResult;
let unknown: ReadingResult;
beforeAll(async () => {
  [exact, unknown] = await Promise.all([reading(true), reading(false)]);
});

function running(): FlowState {
  return flowReducer(initialFlowState(), { type: "startRun", runId: 1 });
}

describe("calculation stages", () => {
  it("never shows a stage as done before its event has been received and displayed", () => {
    let s = running();
    expect(Object.values(stageDisplayStates(s.run))).toEqual(["active", "pending", "pending", "pending", "pending"]);

    s = flowReducer(s, { type: "stageReceived", runId: 1, stage: "validate", status: "completed" });
    // Received but not yet displayed: still in progress.
    expect(stageDisplayStates(s.run).validate).toBe("active");

    s = flowReducer(s, { type: "stageShown", runId: 1 });
    expect(stageDisplayStates(s.run)).toMatchObject({ validate: "done", chart: "active", indicators: "pending" });

    // With nothing queued, stageShown does nothing.
    const same = flowReducer(s, { type: "stageShown", runId: 1 });
    expect(same.run.shown).toEqual(s.run.shown);
  });

  it("only opens the checkpoint after every received stage has been displayed", () => {
    let s = running();
    s = flowReducer(s, { type: "stageReceived", runId: 1, stage: "validate", status: "completed" });
    s = flowReducer(s, { type: "runSucceeded", runId: 1, result: exact });
    expect(flowReducer(s, { type: "runCompleted", runId: 1 }).phase).toBe("calculating");
    s = flowReducer(s, { type: "stageShown", runId: 1 });
    const done = flowReducer(s, { type: "runCompleted", runId: 1 });
    expect(done.phase).toBe("checkpoint");
    expect(done.result).toBe(exact);
  });

  it("ignores events from a superseded run", () => {
    let s = running();
    s = flowReducer(s, { type: "startRun", runId: 2 });
    s = flowReducer(s, { type: "stageReceived", runId: 1, stage: "validate", status: "completed" });
    s = flowReducer(s, { type: "runSucceeded", runId: 1, result: exact });
    expect(s.run.queue).toEqual([]);
    expect(s.run.result).toBeNull();
  });

  it("keeps no result on failure but shows the stages that really completed", () => {
    let s = running();
    s = flowReducer(s, { type: "stageReceived", runId: 1, stage: "validate", status: "completed" });
    s = flowReducer(s, { type: "runFailed", runId: 1, error: { code: "CALCULATION_FAILED", message: "x" } });
    expect(s.run.result).toBeNull();
    expect(s.result).toBeNull();
    expect(stageDisplayStates(s.run)).toMatchObject({ validate: "done", chart: "pending" });
    expect(flowReducer(s, { type: "runCompleted", runId: 1 }).phase).toBe("calculating");
  });
});

describe("form state", () => {
  it("forgets the repeated-hour choice when the birth time changes", () => {
    let s = flowReducer(initialFlowState(), { type: "setDstChoice", choice: "later" });
    expect(s.values.dstChoice).toBe("later");
    s = flowReducer(s, { type: "change", patch: { birthTime: "01:30" } });
    expect(s.values.dstChoice).toBeNull();
  });

  it("starts with unanswered questions and no partner acknowledgement", () => {
    const s = initialFlowState();
    expect(s.values.birthTimeKnown).toBeNull();
    expect(s.values.placeMode).toBeNull();
    expect(s.values.acknowledgeExperimental).toBe(false);
    expect(s.values).toEqual(INITIAL_VALUES);
  });
});

describe("error details", () => {
  it("reads both occurrences of an ambiguous local time", () => {
    expect(
      ambiguousOptions({
        earlier: { utc: "2021-11-07T05:30:00Z", offset: "-04:00" },
        later: { utc: "2021-11-07T06:30:00Z", offset: "-05:00" },
      }),
    ).toEqual([
      { choice: "earlier", utc: "2021-11-07T05:30:00Z", offset: "-04:00" },
      { choice: "later", utc: "2021-11-07T06:30:00Z", offset: "-05:00" },
    ]);
    expect(ambiguousOptions({ earlier: "x" })).toBeNull();
    expect(gapOffsets({ offsetBefore: "-05:00", offsetAfter: "-04:00" })).toEqual({ before: "-05:00", after: "-04:00" });
    expect(fieldPathLabel("birth.place.timeZone")).toBe("Time zone");
    expect(fieldPathLabel("enabledRuleIds.2")).toBe("Methods");
  });
});

describe("reveal and share integrity", () => {
  it("reveals the service's first-shown candidate for an exact birth time", () => {
    const subject = revealSubject(exact);
    expect(subject.kind).toBe("partner");
    if (subject.kind === "partner") expect(subject.candidate).toBe(exact.partner.primary);
  });

  it("never picks a syllable when the result depends on an unknown birth time", () => {
    expect(unknown.partner.primary).toBeNull();
    expect(unknown.partner.alternatives.length).toBeGreaterThan(0);
    expect(revealSubject(unknown).kind).toBe("none");
    expect(shareRequestFor(unknown, "partner")).toBeNull();
    expect(shareRequestFor(unknown, "native")).toBeNull();
  });

  it("builds share requests from cell ids and rule ids only", () => {
    const req = shareRequestFor(exact, "partner");
    expect(req?.kind).toBe("partner");
    expect(req?.items[0].cellId).toBe(exact.partner.primary?.syllable.cellId);
    const json = JSON.stringify(req);
    for (const secret of ["1990", "14:30", "Delhi", "28.6", "77.2", "Kolkata"]) expect(json).not.toContain(secret);
  });
});

describe("reading storage", () => {
  const store = new Map<string, string>();
  beforeAll(() => {
    (globalThis as { window?: unknown }).window = {
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    };
  });
  afterEach(() => store.clear());

  it("round-trips the reading unchanged and clears it with the form progress", () => {
    saveReading(exact, true);
    store.set("soulletter.onboarding.v1", "{}");
    expect(loadReading()).toEqual({ result: exact, revealed: true });
    clearStoredDetails();
    expect(loadReading()).toBeNull();
    expect(store.size).toBe(0);
  });

  it("discards anything that is not a completed reading", () => {
    store.set("soulletter.reading.v1", JSON.stringify({ v: 1, revealed: true, result: { status: "completed" } }));
    expect(loadReading()).toBeNull();
    store.set("soulletter.reading.v1", "not json");
    expect(loadReading()).toBeNull();
  });
});
