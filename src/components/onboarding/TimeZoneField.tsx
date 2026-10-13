"use client";

import { useState } from "react";
import { CheckIcon, Field, Input } from "@/components/ui";
import { isValidIanaTimeZone } from "@/lib/astro/time";
import { FIELD_IDS } from "./field-ids";

/** IANA zone names known to this browser, or an empty list when the API is unavailable. */
function listTimeZones(): string[] {
  try {
    const intl = Intl as typeof Intl & { supportedValuesOf?: (key: "timeZone") => string[] };
    return typeof intl.supportedValuesOf === "function" ? intl.supportedValuesOf("timeZone") : [];
  } catch {
    return [];
  }
}

export interface TimeZoneFieldProps {
  value: string;
  error?: string;
  onChange: (value: string) => void;
  /** Optional extra hint shown under the default one. */
  hint?: string;
}

/**
 * Time-zone text input with suggestions. It is never pre-filled from the device's current
 * zone: the birth zone is usually different, and guessing it would silently change results.
 */
export function TimeZoneField({ value, error, onChange, hint }: TimeZoneFieldProps) {
  const [zones] = useState(listTimeZones);
  const listId = `${FIELD_IDS.timeZone}-list`;
  const valid = value.trim() !== "" && isValidIanaTimeZone(value);

  return (
    <Field
      id={FIELD_IDS.timeZone}
      label="Birth time zone"
      required
      error={error}
      hint={
        <>
          An IANA time-zone name such as <span className="font-mono text-ivory-100">Asia/Kolkata</span> or{" "}
          <span className="font-mono text-ivory-100">Europe/London</span> — not a UTC offset. Historical
          daylight-saving rules for the zone are applied automatically.
          {hint ? <> {hint}</> : null}
        </>
      }
    >
      {(control) => (
        <>
          <Input
            {...control}
            type="text"
            name="timeZone"
            list={zones.length > 0 ? listId : undefined}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="e.g. Asia/Kolkata"
          />
          {zones.length > 0 ? (
            <datalist id={listId}>
              {zones.map((z) => (
                <option key={z} value={z} />
              ))}
            </datalist>
          ) : null}
          {valid && !error ? (
            <p className="flex items-center gap-1.5 text-sm text-status-verified">
              <CheckIcon aria-hidden="true" className="size-4" />
              Recognised time zone
            </p>
          ) : null}
        </>
      )}
    </Field>
  );
}
