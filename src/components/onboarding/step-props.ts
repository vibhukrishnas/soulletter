import type { FieldErrors, MethodToggles, OnboardingValues, StepId } from "@/lib/client/onboarding";
import type { NumerologyPreview, PreviewState } from "@/lib/client/preview";

export interface StepProps {
  values: OnboardingValues;
  errors: FieldErrors;
  onChange: (patch: Partial<OnboardingValues>) => void;
}

/** Live, calculated values for the details entered so far (never illustrative). */
export interface LivePreviewProps {
  preview: PreviewState;
  numerology: NumerologyPreview | null;
}

export interface PreferencesStepProps extends StepProps, LivePreviewProps {
  onChangeMethods: (patch: Partial<MethodToggles>) => void;
  onGoToStep: (step: StepId) => void;
}
