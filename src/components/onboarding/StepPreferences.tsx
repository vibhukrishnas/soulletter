"use client";

import type { ReactNode } from "react";
import {
  Button,
  Callout,
  Checkbox,
  FieldError,
  FlaskIcon,
  RadioCard,
  RadioGroup,
  StatusBadge,
  joinIds,
} from "@/components/ui";
import { partnerRulesEnabled, type MethodToggles } from "@/lib/client/onboarding";
import type { NumerologyPreview } from "@/lib/client/preview";
import type { CharaKarakaScheme, NodeType } from "@/lib/contracts/chart";
import type { NumerologySettings } from "@/lib/contracts/input";
import { FIELD_IDS } from "./field-ids";
import { ConventionsPanel, KarakaOptionResult, NodeOptionResult } from "./LiveChart";
import { StepHeading } from "./StepHeading";
import type { PreferencesStepProps } from "./step-props";

export const NODE_OPTIONS: readonly { value: NodeType; label: string; description: string }[] = [
  { value: "mean", label: "Mean node", description: "The averaged position of the Moon's node, which moves smoothly." },
  { value: "true", label: "True node", description: "The instantaneous position, which oscillates around the mean node." },
];

export const KARAKA_OPTIONS: readonly { value: CharaKarakaScheme; label: string; description: string }[] = [
  {
    value: "seven_planet",
    label: "Seven planets",
    description: "Sun to Saturn are ranked by degree within their sign; Rahu is excluded.",
  },
  {
    value: "eight_planet",
    label: "Eight planets (with Rahu)",
    description: "Rahu is included, ranked at 30° − its degree within its sign.",
  },
];

export const LIFE_PATH_OPTIONS: readonly {
  value: NumerologySettings["lifePathMethod"];
  label: string;
  description: string;
}[] = [
  {
    value: "reduce_components",
    label: "Reduce month, day and year separately",
    description: "Each part is reduced first, then the three are added and reduced.",
  },
  { value: "full_digit_sum", label: "Add every digit", description: "All digits of the date are added, then reduced." },
];

export const MASTER_OPTIONS: readonly { value: NumerologySettings["masterNumbers"]; label: string }[] = [
  { value: "keep_11_22_33", label: "Keep 11, 22 and 33" },
  { value: "keep_11_22", label: "Keep 11 and 22" },
  { value: "none", label: "Always reduce to 1–9" },
];

interface MethodOption {
  key: keyof MethodToggles;
  label: string;
  description: ReactNode;
}

const NATIVE_METHODS: readonly MethodOption[] = [
  {
    key: "nativeNaming",
    label: "My traditional naming syllable",
    description: "The syllable traditionally linked to your Moon's Nakshatra Pada. It is about you, not a partner.",
  },
];

const PARTNER_METHODS: readonly MethodOption[] = [
  {
    key: "partnerSeventhLord",
    label: "Seventh-house lord's Nakshatra Pada",
    description: "Needs an accurate birth time and birthplace.",
  },
  {
    key: "partnerDarakaraka",
    label: "Darakaraka's Nakshatra Pada",
    description: "Uses the Chara Karaka scheme chosen above; sensitive to birth time.",
  },
];

const NUMEROLOGY_METHODS: readonly MethodOption[] = [
  { key: "lifePath", label: "Life Path Number", description: "From your date of birth." },
  { key: "psychicNumber", label: "Psychic Number (Mulank)", description: "From the day of the month." },
  { key: "destinyNumber", label: "Destiny Number (Bhagyank)", description: "From every digit of the date." },
  {
    key: "namePythagorean",
    label: "Name numbers — Pythagorean",
    description: "Expression, Soul Urge and Personality. Needs a name (Latin letters).",
  },
  { key: "nameChaldean", label: "Name number — Chaldean (Cheiro)", description: "Needs a name (Latin letters)." },
];

function MethodGroup({
  legend,
  options,
  methods,
  onChangeMethods,
  badge,
  describedBy,
  valueFor,
}: {
  legend: ReactNode;
  options: readonly MethodOption[];
  methods: MethodToggles;
  onChangeMethods: PreferencesStepProps["onChangeMethods"];
  badge?: ReactNode;
  /** Error ids that describe a given checkbox. */
  describedBy?: (key: keyof MethodToggles) => string | undefined;
  /** Calculated value to show under an option, when available. */
  valueFor?: (key: keyof MethodToggles) => number | null;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-4 border-0 p-0">
      <legend className="mb-3 flex flex-wrap items-center gap-2 p-0 text-sm font-medium text-ivory-50">
        {legend}
        {badge}
      </legend>
      {options.map((o) => (
        <Checkbox
          key={o.key}
          id={`ob-method-${o.key}`}
          name={o.key}
          label={o.label}
          description={
            <>
              {o.description}
              {numberNote(valueFor?.(o.key))}
            </>
          }
          checked={methods[o.key]}
          aria-describedby={describedBy?.(o.key)}
          onChange={(e) => onChangeMethods({ [o.key]: e.target.checked })}
        />
      ))}
    </fieldset>
  );
}

function numberNote(value: number | null | undefined): ReactNode {
  return value === null || value === undefined ? null : (
    <span className="mt-1 block text-ivory-100">
      Your value: <span className="font-medium text-gold-200">{value}</span>
    </span>
  );
}

function methodValue(key: keyof MethodToggles, n: NumerologyPreview | null, lifePath: number | null): number | null {
  if (!n) return null;
  switch (key) {
    case "lifePath":
      return lifePath;
    case "psychicNumber":
      return n.psychicNumber;
    case "destinyNumber":
      return n.destinyNumber;
    case "namePythagorean":
      return n.pythagorean?.expression ?? null;
    case "nameChaldean":
      return n.chaldean?.value ?? null;
    default:
      return null;
  }
}

export function StepPreferences({
  values,
  errors,
  onChange,
  onChangeMethods,
  onGoToStep,
  preview,
  numerology,
}: PreferencesStepProps) {
  const lifePath = numerology ? numerology.lifePath[values.lifePathMethod][values.masterNumbers] : null;
  const partnerOn = partnerRulesEnabled(values.methods);
  const methodsError = errors.methods ? "ob-methods-error" : undefined;
  const describeNumerology = (key: keyof MethodToggles) =>
    joinIds(methodsError, errors.name && (key === "namePythagorean" || key === "nameChaldean") && "ob-name-methods-error");

  return (
    <div className="flex flex-col gap-10">
      <StepHeading
        title="Calculation preferences"
        description="The defaults suit most people. Every setting you choose is listed with your results."
      />

      <ConventionsPanel state={preview} />

      <section aria-labelledby="ob-astro-heading" className="flex flex-col gap-6">
        <h3 id="ob-astro-heading" className="font-display text-2xl text-ivory-50">
          Astrology settings
        </h3>
        <RadioGroup legend="Lunar node (Rahu and Ketu)" layout="grid">
          {NODE_OPTIONS.map((o) => (
            <RadioCard
              key={o.value}
              id={`ob-node-${o.value}`}
              name="nodeType"
              value={o.value}
              label={o.label}
              description={
                <>
                  {o.description}
                  <NodeOptionResult state={preview} node={o.value} />
                </>
              }
              checked={values.nodeType === o.value}
              onChange={() => onChange({ nodeType: o.value })}
            />
          ))}
        </RadioGroup>
        <RadioGroup
          legend="Chara Karaka scheme"
          hint="Competing traditions; they can name a different Darakaraka."
          layout="grid"
        >
          {KARAKA_OPTIONS.map((o) => (
            <RadioCard
              key={o.value}
              id={`ob-karaka-${o.value}`}
              name="charaKarakaScheme"
              value={o.value}
              label={o.label}
              description={
                <>
                  {o.description}
                  <KarakaOptionResult state={preview} scheme={o.value} node={values.nodeType} />
                </>
              }
              checked={values.charaKarakaScheme === o.value}
              onChange={() => onChange({ charaKarakaScheme: o.value })}
            />
          ))}
        </RadioGroup>
      </section>

      <section aria-labelledby="ob-num-heading" className="flex flex-col gap-6">
        <h3 id="ob-num-heading" className="font-display text-2xl text-ivory-50">
          Numerology settings
        </h3>
        <RadioGroup legend="Life Path method">
          {LIFE_PATH_OPTIONS.map((o) => (
            <RadioCard
              key={o.value}
              id={`ob-lifepath-${o.value}`}
              name="lifePathMethod"
              value={o.value}
              label={o.label}
              description={
                <>
                  {o.description}
                  {numberNote(numerology?.lifePath[o.value][values.masterNumbers])}
                </>
              }
              checked={values.lifePathMethod === o.value}
              onChange={() => onChange({ lifePathMethod: o.value })}
            />
          ))}
        </RadioGroup>
        <RadioGroup legend="Master numbers" hint="Whether 11, 22 and 33 are kept instead of being reduced." layout="inline">
          {MASTER_OPTIONS.map((o) => (
            <RadioCard
              key={o.value}
              id={`ob-master-${o.value}`}
              name="masterNumbers"
              value={o.value}
              label={o.label}
              description={numerology ? `Life Path: ${numerology.lifePath[values.lifePathMethod][o.value]}` : undefined}
              checked={values.masterNumbers === o.value}
              onChange={() => onChange({ masterNumbers: o.value })}
            />
          ))}
        </RadioGroup>
      </section>

      <section aria-labelledby="ob-methods-heading" className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h3 id="ob-methods-heading" className="font-display text-2xl text-ivory-50">
            Methods to include
          </h3>
          <p className="text-sm text-mist-300">Choose at least one.</p>
          {errors.methods ? <FieldError id="ob-methods-error">{errors.methods}</FieldError> : null}
        </div>

        <MethodGroup
          legend="About you"
          options={NATIVE_METHODS}
          methods={values.methods}
          onChangeMethods={onChangeMethods}
          badge={<StatusBadge status="documented_traditional_interpretation" />}
          describedBy={() => methodsError}
        />

        <div className="flex flex-col gap-5 rounded-card border border-status-experimental/30 bg-indigo-950/40 p-4 sm:p-5">
          <MethodGroup
            legend="Partner-syllable rules"
            options={PARTNER_METHODS}
            methods={values.methods}
            onChangeMethods={onChangeMethods}
            badge={<StatusBadge status="experimental_symbolic" />}
            describedBy={() => methodsError}
          />
          <Callout tone="important" title="Please read: these rules are experimental" icon={<FlaskIcon />}>
            <p>
              Mapping the seventh-house lord or the Darakaraka to a name syllable is a modern, experimental symbolic
              interpretation. It is not a classical rule, and it has never been shown to predict a partner&apos;s name. A syllable
              it produces is not a scientifically validated prediction of a future partner&apos;s name or initial.
            </p>
          </Callout>
          {partnerOn ? (
            <div className="flex flex-col gap-2">
              <Checkbox
                id={FIELD_IDS.acknowledgeExperimental}
                name="acknowledgeExperimental"
                label="I understand that partner syllables are experimental symbolic interpretations, not predictions."
                checked={values.acknowledgeExperimental}
                invalid={Boolean(errors.acknowledgeExperimental)}
                aria-describedby={errors.acknowledgeExperimental ? "ob-ack-error" : undefined}
                aria-required
                onChange={(e) => onChange({ acknowledgeExperimental: e.target.checked })}
              />
              {errors.acknowledgeExperimental ? (
                <FieldError id="ob-ack-error">{errors.acknowledgeExperimental}</FieldError>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3">
          <MethodGroup
            legend="Numerology"
            options={NUMEROLOGY_METHODS}
            methods={values.methods}
            onChangeMethods={onChangeMethods}
            badge={<StatusBadge status="documented_traditional_interpretation" />}
            describedBy={describeNumerology}
            valueFor={(key) => methodValue(key, numerology, lifePath)}
          />
          <p className="text-sm text-mist-300">
            Numerology is shown for symbolic context only. It never creates, removes or reorders syllables.
          </p>
          {errors.name ? (
            <div className="flex flex-col items-start gap-2">
              <FieldError id="ob-name-methods-error">{errors.name}</FieldError>
              <Button variant="secondary" size="sm" onClick={() => onGoToStep("profile")}>
                Add a name in step 1
              </Button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
