"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Input } from "@/components/ui";
import { formatTypedTime, from24h, to24h, type Meridiem } from "@/lib/client/time12";

export interface TimeInput12hProps {
  /** Props from <Field> (id, aria-describedby, aria-invalid, aria-required). */
  control?: Pick<InputHTMLAttributes<HTMLInputElement>, "id" | "aria-describedby" | "aria-invalid" | "aria-required">;
  id?: string;
  /** Stored value in 24-hour "HH:mm" form, or "" while incomplete. */
  value: string;
  onChange: (value24: string) => void;
  name?: string;
}

const MERIDIEMS: readonly Meridiem[] = ["AM", "PM"];

/**
 * 12-hour time entry: type digits and the colon is inserted automatically, then choose
 * AM or PM. Emits the 24-hour value only when the time is complete and AM/PM is chosen.
 */
export function TimeInput12h({ control, id, value, onChange, name = "birthTime" }: TimeInput12hProps) {
  const initial = from24h(value);
  const [text, setText] = useState(initial?.text ?? "");
  const [meridiem, setMeridiem] = useState<Meridiem | null>(initial?.meridiem ?? null);
  const [synced, setSynced] = useState(value);
  const inputId = control?.id ?? id;

  // Adopt values set from outside (e.g. restored progress) without fighting local typing.
  if (value !== synced) {
    setSynced(value);
    if ((to24h(text, meridiem) ?? "") !== value) {
      const ext = from24h(value);
      if (ext) {
        setText(ext.text);
        setMeridiem(ext.meridiem);
      }
    }
  }

  function update(nextText: string, nextMeridiem: Meridiem | null) {
    setText(nextText);
    setMeridiem(nextMeridiem);
    const v = to24h(nextText, nextMeridiem) ?? "";
    setSynced(v);
    onChange(v);
  }

  const complete = /^\d{2}:\d{2}$/.test(text);
  const needsMeridiem = complete && meridiem === null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          {...control}
          id={inputId}
          type="text"
          name={name}
          inputMode="numeric"
          autoComplete="off"
          placeholder="hh:mm"
          maxLength={5}
          value={text}
          onChange={(e) => {
            const next = formatTypedTime(e.target.value, text);
            update(next.text, next.meridiem ?? meridiem);
          }}
          className="max-w-32 font-mono tracking-wider"
        />
        <div role="radiogroup" aria-label="AM or PM" className="inline-flex overflow-hidden rounded-control border border-line-strong">
          {MERIDIEMS.map((m) => (
            <label
              key={m}
              className={`relative cursor-pointer px-4 py-2.5 text-sm font-medium transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold-300 ${
                meridiem === m ? "bg-gold-300 text-night-950" : "bg-night-800/60 text-mist-200 hover:bg-night-700"
              }`}
            >
              <input
                type="radio"
                name={`${inputId ?? name}-meridiem`}
                value={m}
                checked={meridiem === m}
                onChange={() => update(text, m)}
                // Transparent and covering the whole pill, so a click or tap lands on the input itself.
                className="absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none opacity-0"
              />
              {m}
            </label>
          ))}
        </div>
      </div>
      <p aria-live="polite" className="min-h-5 text-sm text-caution-200">
        {needsMeridiem ? "Choose AM or PM." : ""}
      </p>
    </div>
  );
}
