"use client";

import type { ComponentPropsWithRef, MouseEvent, ReactNode } from "react";
import { buttonStyles, type ButtonSize, type ButtonVariant } from "./button-styles";
import { cn } from "./cn";
import { Spinner } from "./Spinner";

export interface ButtonProps extends ComponentPropsWithRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /**
   * Pending state. The button stays focusable (aria-disabled, not `disabled`) so keyboard
   * focus is not lost, shows a spinner, sets aria-busy, and ignores clicks/submits.
   */
  loading?: boolean;
  /** Optional text that replaces the label while loading, e.g. "Calculating…". */
  loadingText?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

/**
 * Accessible button. Defaults to type="button"; pass type="submit" inside forms.
 * `ref` is forwarded (React 19 ref-as-prop), so it works with react-hook-form and focus management.
 */
export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  loadingText,
  leadingIcon,
  trailingIcon,
  type = "button",
  className,
  children,
  onClick,
  "aria-disabled": ariaDisabled,
  ref,
  ...rest
}: ButtonProps) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (loading) {
      // Blocks both the click handler and implicit form submission while pending.
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      className={cn(buttonStyles({ variant, size, fullWidth }), className)}
      aria-disabled={loading ? true : ariaDisabled}
      aria-busy={loading || undefined}
      onClick={handleClick}
    >
      {loading ? <Spinner size="sm" /> : leadingIcon}
      {loading && loadingText ? loadingText : children}
      {loading ? null : trailingIcon}
    </button>
  );
}
