"use client";

import type { ReactNode } from "react";
import { Button, Callout, LockIcon } from "@/components/ui";
import {
  STEPS,
  enabledRuleIds,
  nameMethodsEnabled,
  partnerRulesEnabled,
  type FieldErrors,
  type OnboardingValues,
  type StepId,
} from "@/lib/client/onboarding";
import { getRule } from "@/lib/rules/registry";
import { ACCURACY_OPTIONS, PLACE_MODE_OPTIONS } from "./StepBirth";
import { StepHeading } from "./StepHeading";
import { KARAKA_OPTIONS, LIFE_PATH_OPTIONS, MASTER_OPTIONS, NODE_OPTIONS } from "./StepPreferences";
import { KarakaOptionResult, LiveChartSummary, NodeOptionResult } from "./LiveChart";
import type { LivePreviewProps } from "./step-props";

interface StepReviewProps extends LivePreviewProps {
  values: OnboardingValues;
  errors: FieldErrors;
  onEdit: (step: StepId) => void;
}

function labelOf<T extends string>(options: readonly { value: T; label: string }[], value: T | null): string {
  return options.find((o) => o.value === value)?.label ?? "Not answered";
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 py-2.5 sm:grid-cols-[12rem_1fr] sm:gap-4">
      <dt className="text-sm text-mist-300">{term}</dt>
      <dd className="min-w-0 text-[0.9375rem] break-words text-ivory-50">{children}</dd>
    </div>
  );
}

function ReviewSection({
  step,
  title,
  onEdit,
  children,
}: {
  step: StepId;
  title: string;
  onEdit: (step: StepId) => void;
  children: ReactNode;
}) {
  const headingId = `review-${step}-heading`;
  const stepNumber = STEPS.findIndex((s) => s.id === step) + 1;
  return (
    <section aria-labelledby={headingId} className="rounded-card border border-line bg-night-800/50 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 id={headingId} className="font-display text-2xl text-ivory-50">
          {title}
        </h3>
        <Button variant="secondary" size="sm" onClick={() => onEdit(step)}>
          Edit<span className="sr-only"> {title.toLowerCase()} (step {stepNumber})</span>
        </Button>
      </div>
      <dl className="mt-2 divide-y divide-line">{children}</dl>
    </section>
  );
}

export function StepReview({ values, errors, onEdit, preview, numerology }: StepReviewProps) {
  const withPlace = values.placeMode === "search" || values.placeMode === "manual";
  const withZone = withPlace || values.placeMode === "time_zone_only";
  const methods = enabledRuleIds(values.methods);
  const nameSent = nameMethodsEnabled(values.methods) && values.name.trim() !== "";

  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        title="Review your details"
        description="Check everything before calculating. Use Edit to change an answer."
      />

      {errors._form ? (
        <Callout tone="important" title="Something needs attention" alert>
          {errors._form}
        </Callout>
      ) : null}

      <LiveChartSummary state={preview} title="Your calculated chart" />

      <ReviewSection step="profile" title="About you" onEdit={onEdit}>
        <Row term="Date of birth">{values.birthDate || "Not answered"}</Row>
        <Row term="Name">
          {values.name.trim() === ""
            ? "Not given"
            : nameSent
              ? `${values.name.trim()} — sent only for name numerology`
              : "Given, but not sent: no name-based method is selected"}
        </Row>
      </ReviewSection>

      <ReviewSection step="birth" title="Birth time and place" onEdit={onEdit}>
        <Row term="Birth time">
          {values.birthTimeKnown === null
            ? "Not answered"
            : values.birthTimeKnown
              ? `${values.birthTime || "—"} (24-hour), ${labelOf(ACCURACY_OPTIONS, values.birthTimeAccuracy).toLowerCase()}`
              : "Not known — the whole birth date will be considered"}
        </Row>
        {values.dstChoice ? (
          <Row term="Repeated hour">
            {values.dstChoice === "earlier" ? "The earlier occurrence" : "The later occurrence"} (clocks went back that
            night)
          </Row>
        ) : null}
        <Row term="Birthplace">{labelOf(PLACE_MODE_OPTIONS, values.placeMode)}</Row>
        {withPlace ? (
          <>
            {values.placeLabel ? <Row term="Place name">{values.placeLabel}</Row> : null}
            <Row term="Latitude, longitude">
              <span className="font-mono">
                {values.latitude || "—"}, {values.longitude || "—"}
              </span>
            </Row>
          </>
        ) : null}
        {withZone ? <Row term="Time zone">{values.timeZone || "Not answered"}</Row> : null}
      </ReviewSection>

      <ReviewSection step="preferences" title="Calculation" onEdit={onEdit}>
        <Row term="Chart conventions">Sidereal zodiac · Lahiri ayanamsha · D1 (Rashi) chart · whole-sign houses</Row>
        <Row term="Lunar node">
          {labelOf(NODE_OPTIONS, values.nodeType)}
          <NodeOptionResult state={preview} node={values.nodeType} />
        </Row>
        <Row term="Chara Karaka scheme">
          {labelOf(KARAKA_OPTIONS, values.charaKarakaScheme)}
          <KarakaOptionResult state={preview} scheme={values.charaKarakaScheme} node={values.nodeType} />
        </Row>
        <Row term="Life Path method">
          {labelOf(LIFE_PATH_OPTIONS, values.lifePathMethod)}, {labelOf(MASTER_OPTIONS, values.masterNumbers).toLowerCase()}
          {numerology ? (
            <span className="mt-1 block">
              Life Path {numerology.lifePath[values.lifePathMethod][values.masterNumbers]} · Mulank {numerology.psychicNumber} ·
              Bhagyank {numerology.destinyNumber}
            </span>
          ) : null}
        </Row>
        <Row term="Methods">
          {methods.length === 0 ? (
            "None selected"
          ) : (
            <ul className="flex flex-col gap-1">
              {methods.map((id) => (
                <li key={id}>{getRule(id)?.name ?? id}</li>
              ))}
            </ul>
          )}
        </Row>
        {partnerRulesEnabled(values.methods) ? (
          <Row term="Experimental rules">
            {values.acknowledgeExperimental ? "Acknowledged as experimental and symbolic" : "Not yet acknowledged"}
          </Row>
        ) : null}
      </ReviewSection>

      <Callout tone="info" title="What happens next" icon={<LockIcon />}>
        Your answers are sent once to calculate the chart and are not stored on our servers. The result stays in this
        browser tab until you clear it or close the tab.
      </Callout>
    </div>
  );
}
