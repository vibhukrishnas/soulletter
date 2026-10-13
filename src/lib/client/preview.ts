"use client";

/**
 * Live preview helpers for the onboarding form.
 *  - useChartPreview: debounced, abortable POST /api/v1/chart/preview for the current
 *    birth details. Returns the user's calculated placements (never illustrative data).
 *  - numerologyPreview: the deterministic numerology values for every selectable option.
 */
import { useEffect, useState } from "react";
import type { ApiError, ApiResponse } from "@/lib/contracts/api";
import type { BirthInput, NumerologySettings } from "@/lib/contracts/input";
import { birthInputSchema } from "@/lib/contracts/input";
import type { ChartPreview } from "@/lib/contracts/preview";
import { computeNumerology } from "@/lib/numerology/numerology";
import type { OnboardingValues } from "./onboarding";
import { toReadingRequest } from "./onboarding";

export type PreviewState =
  | { status: "idle" } // not enough valid input yet
  | { status: "loading"; previous: ChartPreview | null }
  | { status: "ready"; preview: ChartPreview }
  | { status: "error"; error: ApiError; previous: ChartPreview | null };

/** The birth part of the request when it is complete and valid; otherwise null. */
export function previewBirthInput(values: OnboardingValues): BirthInput | null {
  // Needs a date and an answer to "Do you know your birth time?". An unanswered place
  // question is previewed as "no place" (the preview then says what is missing).
  if (!values.birthDate || values.birthTimeKnown === null) return null;
  const birth = toReadingRequest({ ...values, placeMode: values.placeMode ?? "skip" }).birth;
  return birthInputSchema.safeParse(birth).success ? birth : null;
}

export async function fetchChartPreview(birth: BirthInput, signal?: AbortSignal): Promise<ChartPreview> {
  const res = await fetch("/api/v1/chart/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ birth }),
    signal,
  });
  let body: ApiResponse<ChartPreview> | null = null;
  try {
    body = (await res.json()) as ApiResponse<ChartPreview>;
  } catch {
    throw { code: "INTERNAL_ERROR", message: "The preview could not be loaded." } satisfies ApiError;
  }
  if (!body.ok) throw body.error;
  return body.data;
}

/** Debounced live preview of the chart for the given birth input (null = idle). */
type Settled = { key: string; preview: ChartPreview } | { key: string; error: ApiError };

export function useChartPreview(birth: BirthInput | null, debounceMs = 500): PreviewState {
  const key = birth ? JSON.stringify(birth) : null;
  // Only asynchronous results are stored; the visible status is derived during render.
  const [settled, setSettled] = useState<Settled | null>(null);
  const [lastPreview, setLastPreview] = useState<ChartPreview | null>(null);

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetchChartPreview(JSON.parse(key) as BirthInput, controller.signal)
        .then((preview) => {
          setSettled({ key, preview });
          setLastPreview(preview);
        })
        .catch((e: unknown) => {
          if ((e as Error)?.name === "AbortError") return;
          const error: ApiError =
            e && typeof e === "object" && "code" in e
              ? (e as ApiError)
              : { code: "INTERNAL_ERROR", message: "The preview could not be loaded." };
          setSettled({ key, error });
        });
    }, debounceMs);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [key, debounceMs]);

  if (!key) return { status: "idle" };
  if (settled?.key === key) {
    return "preview" in settled
      ? { status: "ready", preview: settled.preview }
      : { status: "error", error: settled.error, previous: lastPreview };
  }
  return { status: "loading", previous: lastPreview };
}

export interface NumerologyPreview {
  lifePath: Record<NumerologySettings["lifePathMethod"], Record<NumerologySettings["masterNumbers"], number>>;
  psychicNumber: number;
  destinyNumber: number;
  /** Null when no usable name was entered (or it is not in the Latin alphabet). */
  pythagorean: { expression: number; soulUrge: number; personality: number } | null;
  chaldean: { value: number; compound: number | null } | null;
}

/** Values for every numerology option, computed locally with the same code as the server. */
export function numerologyPreview(birthDate: string, name: string): NumerologyPreview | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const methods = ["reduce_components", "full_digit_sum"] as const;
  const masters = ["keep_11_22_33", "keep_11_22", "none"] as const;
  const run = (settings: NumerologySettings, ids: string[], withName: boolean) =>
    computeNumerology({ birthDate, settings, enabledRuleIds: ids, name: withName && name.trim() ? name.trim() : null });
  const lifePath = {} as NumerologyPreview["lifePath"];
  for (const m of methods) {
    lifePath[m] = {} as Record<NumerologySettings["masterNumbers"], number>;
    for (const k of masters) {
      lifePath[m][k] = run({ lifePathMethod: m, masterNumbers: k, yHandling: "consonant" }, ["numerology.life-path"], false).results[0].value;
    }
  }
  const base: NumerologySettings = { lifePathMethod: "reduce_components", masterNumbers: "keep_11_22_33", yHandling: "consonant" };
  const fixed = run(base, ["numerology.psychic-number", "numerology.destiny-number"], false).results;
  const named = name.trim() ? run(base, ["numerology.name-pythagorean", "numerology.name-chaldean"], true) : null;
  const py = named?.results.filter((r) => r.ruleId === "numerology.name-pythagorean") ?? [];
  const ch = named?.results.find((r) => r.ruleId === "numerology.name-chaldean");
  return {
    lifePath,
    psychicNumber: fixed[0].value,
    destinyNumber: fixed[1].value,
    pythagorean: py.length === 3 ? { expression: py[0].value, soulUrge: py[1].value, personality: py[2].value } : null,
    chaldean: ch ? { value: ch.value, compound: ch.compound } : null,
  };
}
