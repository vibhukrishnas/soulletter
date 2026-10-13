import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export interface VisuallyHiddenProps extends HTMLAttributes<HTMLElement> {
  as?: "span" | "div" | "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  /** Reveal the content when it (or a descendant) receives keyboard focus. */
  focusable?: boolean;
}

/** Content available to assistive technology but not shown visually. */
export function VisuallyHidden({ as: Tag = "span", focusable = false, className, ...rest }: VisuallyHiddenProps) {
  return <Tag {...rest} className={cn("sr-only", focusable && "focus-within:not-sr-only focus:not-sr-only", className)} />;
}
