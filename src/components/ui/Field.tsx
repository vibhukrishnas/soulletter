"use client";

import { useId, type ComponentPropsWithRef, type ReactNode } from "react";
import { cn } from "./cn";
import { fieldA11yProps, joinIds, type FieldA11yProps } from "./field-a11y";
import { CheckIcon, ChevronDownIcon, ImportantIcon } from "./icons";

/* ────────────────────────────────────────────────────────────────────
 * Ids
 * ──────────────────────────────────────────────────────────────────── */

export interface FieldIds {
  controlId: string;
  labelId: string;
  hintId: string;
  errorId: string;
}

/** Stable ids for a control and its label/hint/error. Pass `id` to use a known control id. */
export function useFieldIds(id?: string): FieldIds {
  const generated = useId();
  const controlId = id ?? `field-${generated}`;
  return {
    controlId,
    labelId: `${controlId}-label`,
    hintId: `${controlId}-hint`,
    errorId: `${controlId}-error`,
  };
}

/* ────────────────────────────────────────────────────────────────────
 * Text primitives
 * ──────────────────────────────────────────────────────────────────── */

export interface LabelProps extends ComponentPropsWithRef<"label"> {
  /** Adds a decorative asterisk. Also set `aria-required` on the control (Field does this). */
  required?: boolean;
  /** Adds a visible "(optional)" marker — the preferred convention in SoulLetter forms. */
  optional?: boolean;
}

export function Label({ required = false, optional = false, className, children, ...rest }: LabelProps) {
  return (
    <label {...rest} className={cn("text-sm leading-snug font-medium text-ivory-50", className)}>
      {children}
      {required ? (
        <span aria-hidden="true" className="ml-0.5 text-gold-300">
          *
        </span>
      ) : null}
      {optional ? <span className="ml-1.5 font-normal text-mist-400">(optional)</span> : null}
    </label>
  );
}

export type FieldHintProps = ComponentPropsWithRef<"p">;

/** Helper text. Give it an id and reference it from the control's aria-describedby. */
export function FieldHint({ className, ...rest }: FieldHintProps) {
  return <p {...rest} className={cn("text-sm leading-relaxed text-mist-300", className)} />;
}

export type FieldErrorProps = ComponentPropsWithRef<"p">;

/**
 * Validation message. Renders nothing when empty. Prefixed with a visually hidden "Error:"
 * so the message is unambiguous when read out via aria-describedby.
 */
export function FieldError({ className, children, ...rest }: FieldErrorProps) {
  if (children === null || children === undefined || children === false || children === "") return null;
  return (
    <p
      {...rest}
      className={cn("flex items-start gap-1.5 text-sm leading-snug font-medium text-important-200", className)}
    >
      <ImportantIcon className="mt-px size-4 shrink-0 text-important-300" />
      <span>
        <span className="sr-only">Error: </span>
        {children}
      </span>
    </p>
  );
}

/* ────────────────────────────────────────────────────────────────────
 * Controls
 * ──────────────────────────────────────────────────────────────────── */

/**
 * Shared control styling. Text is 16px so iOS Safari does not zoom on focus.
 * aria-invalid="true" switches to the error border.
 */
const CONTROL =
  "block w-full rounded-control border border-white/15 bg-night-900/70 text-base text-ivory-50 " +
  "shadow-[inset_0_1px_2px_rgb(0_0_0/0.35)] transition-[border-color,background-color] duration-150 " +
  "placeholder:text-mist-400 hover:border-white/25 " +
  "focus-visible:border-gold-300/70 focus-visible:bg-night-900 focus-visible:outline-2 focus-visible:outline-offset-1 " +
  "focus-visible:outline-gold-200/80 disabled:cursor-not-allowed disabled:opacity-55 " +
  "aria-invalid:border-important-300/70 aria-invalid:focus-visible:outline-important-300";

export interface InputProps extends ComponentPropsWithRef<"input"> {
  /** Sets aria-invalid and the error style. An explicit `aria-invalid` prop takes precedence. */
  invalid?: boolean;
}

export function Input({ invalid, className, "aria-invalid": ariaInvalid, ...rest }: InputProps) {
  return (
    <input
      {...rest}
      aria-invalid={ariaInvalid ?? (invalid ? true : undefined)}
      className={cn(CONTROL, "min-h-11 px-3.5 py-2", className)}
    />
  );
}

export interface TextareaProps extends ComponentPropsWithRef<"textarea"> {
  invalid?: boolean;
}

export function Textarea({ invalid, className, "aria-invalid": ariaInvalid, rows = 4, ...rest }: TextareaProps) {
  return (
    <textarea
      {...rest}
      rows={rows}
      aria-invalid={ariaInvalid ?? (invalid ? true : undefined)}
      className={cn(CONTROL, "min-h-28 resize-y px-3.5 py-3 leading-relaxed", className)}
    />
  );
}

export interface SelectProps extends ComponentPropsWithRef<"select"> {
  invalid?: boolean;
  /** Class for the positioning wrapper (width/margins). `className` styles the <select>. */
  wrapperClassName?: string;
}

/** Native <select> (best mobile and assistive-technology support) with a custom chevron. */
export function Select({ invalid, className, wrapperClassName, "aria-invalid": ariaInvalid, ...rest }: SelectProps) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <select
        {...rest}
        aria-invalid={ariaInvalid ?? (invalid ? true : undefined)}
        className={cn(CONTROL, "min-h-11 cursor-pointer appearance-none py-2 pr-10 pl-3.5", className)}
      />
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3.5 size-5 -translate-y-1/2 text-gold-300" />
    </div>
  );
}

export interface CheckboxProps extends Omit<ComponentPropsWithRef<"input">, "type"> {
  /** Visible label (clickable). */
  label: ReactNode;
  /** Secondary text under the label, linked via aria-describedby. */
  description?: ReactNode;
  invalid?: boolean;
}

/**
 * Native checkbox with a custom box. Falls back to the system control in forced-colours mode.
 * `className` styles the outer wrapper; every other prop (incl. `ref`) goes to the <input>.
 */
export function Checkbox({
  label,
  description,
  invalid,
  id,
  className,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  ...rest
}: CheckboxProps) {
  const generated = useId();
  const inputId = id ?? `checkbox-${generated}`;
  const descriptionId = description ? `${inputId}-description` : undefined;

  return (
    <div className={cn("flex items-start gap-3", className)}>
      <span className="relative mt-0.5 grid size-5 shrink-0 place-items-center">
        <input
          {...rest}
          id={inputId}
          type="checkbox"
          aria-invalid={ariaInvalid ?? (invalid ? true : undefined)}
          aria-describedby={joinIds(descriptionId, ariaDescribedBy)}
          className={cn(
            "peer size-5 cursor-pointer appearance-none rounded-[0.375rem] border border-white/35 bg-night-900/70",
            "transition-colors duration-150 hover:border-gold-300/70",
            "checked:border-gold-300 checked:bg-gold-300",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-200",
            "disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:border-important-300",
            "forced-colors:appearance-auto",
          )}
        />
        <CheckIcon
          strokeWidth={2.75}
          className="pointer-events-none absolute size-3.5 text-night-950 opacity-0 peer-checked:opacity-100 forced-colors:hidden"
        />
      </span>
      <span className="min-w-0">
        <label htmlFor={inputId} className="cursor-pointer text-[0.9375rem] leading-snug font-medium text-ivory-50">
          {label}
        </label>
        {description ? (
          <span id={descriptionId} className="mt-1 block text-sm leading-relaxed text-mist-300">
            {description}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
 * Field (label + hint + control + error, wired automatically)
 * ──────────────────────────────────────────────────────────────────── */

export interface FieldControlProps extends FieldA11yProps {
  id: string;
}

export interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  /** Error message; when present the control is marked invalid and described by it. */
  error?: ReactNode;
  required?: boolean;
  optional?: boolean;
  /** Control id. Generated when omitted. */
  id?: string;
  /** Hide the label visually (it stays available to assistive technology). */
  labelVisuallyHidden?: boolean;
  className?: string;
  /** Render prop receiving the id and aria-* props to spread onto the control. */
  children: (control: FieldControlProps) => ReactNode;
}

/**
 * Usage:
 *   <Field label="Date of birth" hint="As on your birth certificate" error={errors.birthDate?.message}>
 *     {(control) => <Input type="date" {...control} {...register("birthDate")} />}
 *   </Field>
 */
export function Field({
  label,
  hint,
  error,
  required = false,
  optional = false,
  id,
  labelVisuallyHidden = false,
  className,
  children,
}: FieldProps) {
  const ids = useFieldIds(id);
  const hasHint = hint !== undefined && hint !== null && hint !== false && hint !== "";
  const invalid = error !== undefined && error !== null && error !== false && error !== "";

  const control: FieldControlProps = {
    id: ids.controlId,
    ...fieldA11yProps({ hintId: hasHint && ids.hintId, errorId: ids.errorId, invalid, required }),
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label
        id={ids.labelId}
        htmlFor={ids.controlId}
        required={required}
        optional={optional}
        className={labelVisuallyHidden ? "sr-only" : undefined}
      >
        {label}
      </Label>
      {hasHint ? <FieldHint id={ids.hintId}>{hint}</FieldHint> : null}
      {children(control)}
      {invalid ? <FieldError id={ids.errorId}>{error}</FieldError> : null}
    </div>
  );
}
