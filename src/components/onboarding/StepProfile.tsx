"use client";

import { Callout, Field, Input, UserOffIcon } from "@/components/ui";
import { MIN_SUPPORTED_YEAR } from "@/lib/astro/time";
import { todayIso } from "@/lib/client/onboarding";
import { FIELD_IDS } from "./field-ids";
import { StepHeading } from "./StepHeading";
import type { StepProps } from "./step-props";

export function StepProfile({ values, errors, onChange }: StepProps) {
  return (
    <div className="flex flex-col gap-8">
      <StepHeading
        title="About you"
        description="Only your date of birth is required here. There is no account and nothing is saved on our servers."
      />

      <Field
        id={FIELD_IDS.birthDate}
        label="Date of birth"
        required
        error={errors.birthDate}
        hint={`As on your birth record. Supported years start at ${MIN_SUPPORTED_YEAR}.`}
      >
        {(control) => (
          <Input
            {...control}
            type="date"
            name="birthDate"
            min={`${MIN_SUPPORTED_YEAR}-01-01`}
            max={todayIso()}
            value={values.birthDate}
            onChange={(e) => onChange({ birthDate: e.target.value })}
            className="sm:max-w-xs"
          />
        )}
      </Field>

      <Field
        id={FIELD_IDS.name}
        label="Name"
        optional
        error={errors.name}
        hint="Only used if you choose name numerology in step 3, and only sent with that calculation. It is never stored on our servers; this browser tab keeps your answers until you clear them or close the tab."
      >
        {(control) => (
          <Input
            {...control}
            type="text"
            name="name"
            autoComplete="off"
            value={values.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        )}
      </Field>

      <Callout tone="info" title="What we don't ask" icon={<UserOffIcon />}>
        <p>
          We don&apos;t ask for your gender or a partner&apos;s gender, because none of the available methods use
          them. We only ask for what a selected method actually needs.
        </p>
      </Callout>
    </div>
  );
}
