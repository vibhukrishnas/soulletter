"use client";

import { useMemo, type FormEvent } from "react";
import { ArrowRightIcon, Button, ProgressSteps, SparkleIcon } from "@/components/ui";
import { STEPS, type FieldErrors, type MethodToggles, type OnboardingValues, type StepId } from "@/lib/client/onboarding";
import { numerologyPreview, previewBirthInput, useChartPreview } from "@/lib/client/preview";
import { STEP_HEADING_ID } from "./field-ids";
import { stepIndex } from "./flow-state";
import { StepBirth } from "./StepBirth";
import { StepPreferences } from "./StepPreferences";
import { StepProfile } from "./StepProfile";
import { StepReview } from "./StepReview";

export interface OnboardingFormProps {
  values: OnboardingValues;
  step: StepId;
  errors: FieldErrors;
  onChange: (patch: Partial<OnboardingValues>) => void;
  onChangeMethods: (patch: Partial<MethodToggles>) => void;
  onGoToStep: (step: StepId) => void;
  onContinue: () => void;
  onBack: () => void;
  onSubmit: () => void;
}

/** The four-step form. Back/Continue stay pinned to the bottom of the viewport on small screens. */
export function OnboardingForm({
  values,
  step,
  errors,
  onChange,
  onChangeMethods,
  onGoToStep,
  onContinue,
  onBack,
  onSubmit,
}: OnboardingFormProps) {
  const index = stepIndex(step);
  // Live, calculated preview of the user's own chart and numerology for every step.
  const birthForPreview = useMemo(() => previewBirthInput(values), [values]);
  const preview = useChartPreview(step === "profile" ? null : birthForPreview);
  const numerology = useMemo(() => numerologyPreview(values.birthDate, values.name), [values.birthDate, values.name]);
  const isReview = step === "review";
  const errorCount = Object.values(errors).filter(Boolean).length;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isReview) onSubmit();
    else onContinue();
  }

  return (
    <form noValidate onSubmit={handleSubmit} aria-labelledby={STEP_HEADING_ID} className="flex flex-col">
      <ProgressSteps
        steps={STEPS}
        currentIndex={index}
        ariaLabel="Form progress"
        onStepSelect={(i) => onGoToStep(STEPS[i].id)}
      />

      <div className="mt-8 pb-6">
        {step === "profile" ? <StepProfile values={values} errors={errors} onChange={onChange} /> : null}
        {step === "birth" ? <StepBirth values={values} errors={errors} onChange={onChange} preview={preview} /> : null}
        {step === "preferences" ? (
          <StepPreferences
            values={values}
            errors={errors}
            onChange={onChange}
            onChangeMethods={onChangeMethods}
            onGoToStep={onGoToStep}
            preview={preview}
            numerology={numerology}
          />
        ) : null}
        {isReview ? <StepReview values={values} errors={errors} onEdit={onGoToStep} preview={preview} numerology={numerology} /> : null}
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {errorCount > 0 ? `${errorCount} ${errorCount === 1 ? "answer needs" : "answers need"} attention.` : ""}
      </p>

      <div className="sticky bottom-0 z-20 -mx-4 border-t border-line bg-night-950/90 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-card sm:border sm:px-4">
        <div className="flex items-center justify-between gap-3">
          {index > 0 ? (
            <Button variant="secondary" onClick={onBack}>
              Back
            </Button>
          ) : (
            <span className="text-sm text-mist-400">Step 1 of {STEPS.length}</span>
          )}
          {isReview ? (
            <Button type="submit" leadingIcon={<SparkleIcon />} data-testid="calculate-reading">
              Calculate my reading
            </Button>
          ) : (
            <Button type="submit" trailingIcon={<ArrowRightIcon />}>
              Continue
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
