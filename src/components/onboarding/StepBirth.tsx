"use client";

import { Button, Callout, Field, Input, RadioCard, RadioGroup } from "@/components/ui";
import type { PlaceMode } from "@/lib/client/onboarding";
import type { BirthTimeAccuracy } from "@/lib/contracts/chart";
import { FIELD_IDS, hasPlaceSelection } from "./field-ids";
import { PlaceSearch } from "./PlaceSearch";
import { StepHeading } from "./StepHeading";
import type { StepProps } from "./step-props";
import type { PreviewState } from "@/lib/client/preview";
import { LiveChartSummary } from "./LiveChart";
import { TimeZoneField } from "./TimeZoneField";

export const ACCURACY_OPTIONS: readonly { value: BirthTimeAccuracy; label: string; description: string }[] = [
  { value: "to_the_minute", label: "To the minute", description: "From a birth certificate or hospital record." },
  { value: "within_15_minutes", label: "Within about 15 minutes", description: "±15 minutes are checked." },
  { value: "within_1_hour", label: "Within about an hour", description: "±60 minutes are checked." },
];

export const PLACE_MODE_OPTIONS: readonly { value: PlaceMode; label: string; description: string }[] = [
  { value: "search", label: "Search for my birthplace", description: "Find the town or city; coordinates and time zone are filled in for you." },
  { value: "manual", label: "Enter coordinates", description: "Type the latitude, longitude and time zone yourself." },
  { value: "time_zone_only", label: "I only know the time zone", description: "Planet positions can be calculated; the Ascendant and houses cannot." },
  { value: "skip", label: "Skip location", description: "Every possible UTC offset is considered, so fewer results are available." },
];

export function StepBirth({ values, errors, onChange, preview }: StepProps & { preview?: PreviewState }) {
  const timeKnown = values.birthTimeKnown;
  const mode = values.placeMode;
  const picked = mode === "search" && hasPlaceSelection(values);
  const showCoordinates = mode === "manual" || picked;

  return (
    <div className="flex flex-col gap-10">
      <StepHeading
        title="Birth time and place"
        description="These decide which positions can be calculated precisely. Answer what you know — nothing is guessed for you."
      />

      <Callout tone="info" title="Why time and place matter">
        <ul className="list-disc space-y-1 pl-5">
          <li>The Moon moves into a new Nakshatra Pada roughly every 6 hours, so the birth time can change the syllable.</li>
          <li>The Ascendant (rising sign) changes about every 2 hours; the seventh house is counted from it.</li>
          <li>Houses need the birthplace coordinates, and the time zone converts your local time to universal time.</li>
        </ul>
      </Callout>

      <section aria-labelledby="ob-time-heading" className="flex flex-col gap-6">
        <h3 id="ob-time-heading" className="font-display text-2xl text-ivory-50">
          Birth time
        </h3>
        <RadioGroup
          legend="Do you know your birth time?"
          required
          error={errors.birthTimeKnown}
          layout="grid"
        >
          <RadioCard
            id={FIELD_IDS.birthTimeKnown}
            name="birthTimeKnown"
            value="yes"
            label="Yes"
            description="I know the time, or roughly."
            checked={timeKnown === true}
            onChange={() => onChange({ birthTimeKnown: true })}
          />
          <RadioCard
            id="ob-time-known-no"
            name="birthTimeKnown"
            value="no"
            label="I don't know my birth time"
            description="The whole birth date is considered; time-dependent results are shown as possibilities."
            checked={timeKnown === false}
            onChange={() => onChange({ birthTimeKnown: false })}
          />
        </RadioGroup>

        {timeKnown === true ? (
          <div className="flex flex-col gap-6">
            <Field
              id={FIELD_IDS.birthTime}
              label="Birth time (24-hour clock)"
              required
              error={errors.birthTime}
              hint="Local time where you were born, as HH:MM — for example 09:05 or 14:30."
            >
              {(control) => (
                <Input
                  {...control}
                  type="text"
                  name="birthTime"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="HH:MM"
                  pattern="[0-2][0-9]:[0-5][0-9]"
                  value={values.birthTime}
                  onChange={(e) => onChange({ birthTime: e.target.value })}
                  className="max-w-40 font-mono tracking-wider"
                />
              )}
            </Field>
            <RadioGroup
              legend="How accurate is this time?"
              hint="Results that change within this margin are shown as alternatives rather than hidden."
              error={errors.birthTimeAccuracy}
            >
              {ACCURACY_OPTIONS.map((o) => (
                <RadioCard
                  key={o.value}
                  id={`ob-accuracy-${o.value}`}
                  name="birthTimeAccuracy"
                  value={o.value}
                  label={o.label}
                  description={o.description}
                  checked={values.birthTimeAccuracy === o.value}
                  onChange={() => onChange({ birthTimeAccuracy: o.value })}
                />
              ))}
            </RadioGroup>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="ob-place-heading" className="flex flex-col gap-6">
        <h3 id="ob-place-heading" className="font-display text-2xl text-ivory-50">
          Birthplace
        </h3>
        <RadioGroup legend="How would you like to give your birthplace?" required error={errors.placeMode} layout="grid">
          {PLACE_MODE_OPTIONS.map((o) => (
            <RadioCard
              key={o.value}
              id={`ob-place-mode-${o.value}`}
              name="placeMode"
              value={o.value}
              label={o.label}
              description={o.description}
              checked={mode === o.value}
              onChange={() => onChange({ placeMode: o.value })}
            />
          ))}
        </RadioGroup>

        {mode === "search" && !picked ? (
          <PlaceSearch
            error={errors.placeLabel}
            onSelect={(place) =>
              onChange({
                placeLabel: place.label,
                latitude: String(place.latitude),
                longitude: String(place.longitude),
                timeZone: place.timeZone,
              })
            }
            onUseManualEntry={() => onChange({ placeMode: "manual" })}
          />
        ) : null}

        {picked ? (
          <div className="flex flex-wrap items-center gap-3 rounded-card border border-gold-300/25 bg-gold-300/[0.05] p-4">
            <p className="min-w-0 flex-1 text-[0.9375rem] text-ivory-100">
              <span className="block text-sm text-mist-300">Selected birthplace</span>
              {values.placeLabel || "No place name"}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange({ placeLabel: "", latitude: "", longitude: "", timeZone: "" })}
            >
              Search again
            </Button>
          </div>
        ) : null}

        {showCoordinates ? (
          <div className="flex flex-col gap-6">
            {mode === "search" ? (
              <p className="text-sm text-mist-300">
                Check the details below — you can correct any of them before continuing.
              </p>
            ) : null}
            <Field
              id={FIELD_IDS.placeLabel}
              label="Place name"
              optional={mode === "manual"}
              required={mode === "search"}
              error={showCoordinates ? errors.placeLabel : undefined}
              hint="For your reference only — the calculation uses the coordinates and time zone."
            >
              {(control) => (
                <Input
                  {...control}
                  type="text"
                  name="placeLabel"
                  autoComplete="off"
                  value={values.placeLabel}
                  onChange={(e) => onChange({ placeLabel: e.target.value })}
                />
              )}
            </Field>
            <div className="grid gap-6 sm:grid-cols-2">
              <Field
                id={FIELD_IDS.latitude}
                label="Latitude"
                required
                error={errors.latitude}
                hint="Decimal degrees, north positive (e.g. 28.6139)."
              >
                {(control) => (
                  <Input
                    {...control}
                    type="text"
                    name="latitude"
                    inputMode="decimal"
                    autoComplete="off"
                    value={values.latitude}
                    onChange={(e) => onChange({ latitude: e.target.value })}
                    className="font-mono"
                  />
                )}
              </Field>
              <Field
                id={FIELD_IDS.longitude}
                label="Longitude"
                required
                error={errors.longitude}
                hint="Decimal degrees, east positive (e.g. 77.2090)."
              >
                {(control) => (
                  <Input
                    {...control}
                    type="text"
                    name="longitude"
                    inputMode="decimal"
                    autoComplete="off"
                    value={values.longitude}
                    onChange={(e) => onChange({ longitude: e.target.value })}
                    className="font-mono"
                  />
                )}
              </Field>
            </div>
          </div>
        ) : null}

        {mode === "manual" || mode === "time_zone_only" || picked ? (
          <TimeZoneField
            value={values.timeZone}
            error={errors.timeZone}
            onChange={(timeZone) => onChange({ timeZone })}
          />
        ) : null}

        {mode === "time_zone_only" ? (
          <Callout tone="caution" title="Reduced coverage without coordinates">
            Your local time can be converted to universal time, so planet positions are calculated. The Ascendant,
            houses and the seventh-house method need coordinates and will be marked unavailable.
          </Callout>
        ) : null}
        {mode === "skip" ? (
          <Callout tone="caution" title="Reduced coverage without a location">
            Without a time zone your local birth time cannot be converted to universal time, so every possible UTC
            offset is considered. Positions that change in that window are shown as possibilities, and the Ascendant
            and houses are not calculated.
          </Callout>
        ) : null}
      </section>
      {preview && preview.status !== "idle" ? <LiveChartSummary state={preview} /> : null}
    </div>
  );
}
