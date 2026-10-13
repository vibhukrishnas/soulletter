import type { OnboardingValues, StepId } from "@/lib/client/onboarding";

/** Stable DOM ids of the form controls, used for labels, error focus and tests. */
export const FIELD_IDS = {
  name: "ob-name",
  birthDate: "ob-birth-date",
  birthTimeKnown: "ob-time-known-yes",
  birthTime: "ob-birth-time",
  birthTimeAccuracy: "ob-accuracy-to_the_minute",
  placeMode: "ob-place-mode-search",
  placeSearch: "ob-place-search",
  placeLabel: "ob-place-label",
  latitude: "ob-latitude",
  longitude: "ob-longitude",
  timeZone: "ob-time-zone",
  methods: "ob-method-nativeNaming",
  acknowledgeExperimental: "ob-ack",
} as const;

export const STEP_HEADING_ID = "discover-step-heading";
export const PHASE_HEADING_ID = "discover-phase-heading";
export const RESULTS_HEADING_ID = "reading-results-heading";
export const REVEAL_SKIP_ID = "reveal-skip";
export const NOTICE_ID = "discover-notice";

/** In search mode: true once a place has been picked (its fields stay editable). */
export function hasPlaceSelection(values: OnboardingValues): boolean {
  return values.placeLabel !== "" || values.latitude !== "" || values.longitude !== "";
}

/** The control to focus for an error on `field` while `step` is shown. */
export function controlIdForError(field: string, step: StepId, values: OnboardingValues): string | null {
  if (field === "name" && step === "preferences") {
    if (values.methods.namePythagorean) return "ob-method-namePythagorean";
    if (values.methods.nameChaldean) return "ob-method-nameChaldean";
    return null;
  }
  if (field === "placeLabel") {
    return values.placeMode === "search" && !hasPlaceSelection(values) ? FIELD_IDS.placeSearch : FIELD_IDS.placeLabel;
  }
  if (field in FIELD_IDS) return FIELD_IDS[field as keyof typeof FIELD_IDS];
  return null;
}
