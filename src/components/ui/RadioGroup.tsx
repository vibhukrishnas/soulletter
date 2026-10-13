"use client";

import { createContext, use, useId, type ComponentPropsWithRef, type FieldsetHTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";
import { joinIds } from "./field-a11y";
import { FieldError, FieldHint } from "./Field";

interface RadioGroupContextValue {
  invalid: boolean;
}

const RadioGroupContext = createContext<RadioGroupContextValue>({ invalid: false });

export interface RadioGroupProps extends Omit<FieldsetHTMLAttributes<HTMLFieldSetElement>, "children"> {
  /** Question or group label, rendered as the fieldset <legend>. */
  legend: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  legendVisuallyHidden?: boolean;
  /** Layout of the options. "grid" uses two columns from the sm breakpoint. */
  layout?: "stack" | "grid" | "inline";
  children: ReactNode;
}

const LAYOUTS: Record<NonNullable<RadioGroupProps["layout"]>, string> = {
  stack: "flex flex-col gap-3",
  grid: "grid gap-3 sm:grid-cols-2",
  inline: "flex flex-wrap gap-3",
};

/**
 * Fieldset + legend wrapper for native radio inputs (arrow-key navigation comes for free).
 * The hint and error are associated with the group via aria-describedby on the fieldset.
 * Give every <RadioCard> in the group the same `name`.
 */
export function RadioGroup({
  legend,
  hint,
  error,
  required = false,
  legendVisuallyHidden = false,
  layout = "stack",
  className,
  children,
  id,
  "aria-describedby": ariaDescribedBy,
  ...rest
}: RadioGroupProps) {
  const generated = useId();
  const baseId = id ?? `radio-group-${generated}`;
  const hintId = `${baseId}-hint`;
  const errorId = `${baseId}-error`;
  const hasHint = hint !== undefined && hint !== null && hint !== false && hint !== "";
  const invalid = error !== undefined && error !== null && error !== false && error !== "";

  return (
    <fieldset
      {...rest}
      id={baseId}
      aria-describedby={joinIds(invalid && errorId, hasHint && hintId, ariaDescribedBy)}
      className={cn("min-w-0 border-0 p-0", className)}
    >
      <legend
        className={cn(
          "mb-1.5 p-0 text-sm leading-snug font-medium text-ivory-50",
          legendVisuallyHidden && "sr-only",
        )}
      >
        {legend}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-gold-300">
            *
          </span>
        ) : null}
      </legend>
      {hasHint ? (
        <FieldHint id={hintId} className="mb-3">
          {hint}
        </FieldHint>
      ) : null}
      <RadioGroupContext value={{ invalid }}>
        <div className={LAYOUTS[layout]}>{children}</div>
      </RadioGroupContext>
      {invalid ? (
        <FieldError id={errorId} className="mt-2">
          {error}
        </FieldError>
      ) : null}
    </fieldset>
  );
}

export interface RadioCardProps extends Omit<ComponentPropsWithRef<"input">, "type"> {
  /** Option title; used as the radio's accessible name. */
  label: ReactNode;
  /** Supporting text, linked via aria-describedby. */
  description?: ReactNode;
  /** Optional trailing badge (e.g. <StatusBadge>), shown next to the title. */
  badge?: ReactNode;
}

/**
 * A native radio presented as a selectable card. The whole card is clickable; focus and
 * checked states are drawn on the card. Works with react-hook-form's `register()`.
 */
export function RadioCard({
  label,
  description,
  badge,
  id,
  className,
  "aria-describedby": ariaDescribedBy,
  ...rest
}: RadioCardProps) {
  const { invalid } = use(RadioGroupContext);
  const generated = useId();
  const inputId = id ?? `radio-${generated}`;
  const labelId = `${inputId}-label`;
  const descriptionId = description ? `${inputId}-description` : undefined;

  return (
    <label
      htmlFor={inputId}
      className={cn(
        "relative flex cursor-pointer items-start gap-3 rounded-card border bg-night-800/50 p-4 transition-[border-color,background-color,box-shadow] duration-200",
        invalid ? "border-important-300/50" : "border-white/12 hover:border-gold-300/40",
        "has-[:checked]:border-gold-300/70 has-[:checked]:bg-gold-300/[0.06] has-[:checked]:shadow-glow-gold-soft",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold-200",
        "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55",
        className,
      )}
    >
      <input
        {...rest}
        id={inputId}
        type="radio"
        aria-labelledby={labelId}
        aria-describedby={joinIds(descriptionId, ariaDescribedBy)}
        className={cn(
          "mt-0.5 size-5 shrink-0 cursor-pointer appearance-none rounded-full border border-white/35 bg-night-900",
          "transition-[border-color,border-width] duration-150",
          "checked:border-[6px] checked:border-gold-300 focus-visible:outline-none",
          "disabled:cursor-not-allowed forced-colors:appearance-auto",
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span id={labelId} className="text-[0.9375rem] leading-snug font-medium text-ivory-50">
            {label}
          </span>
          {badge}
        </span>
        {description ? (
          <span id={descriptionId} className="mt-1 block text-sm leading-relaxed text-mist-300">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}
