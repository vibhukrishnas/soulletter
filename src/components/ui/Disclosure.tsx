"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "./cn";
import { ChevronDownIcon } from "./icons";

export interface DisclosureProps {
  /** Visible label of the toggle button. */
  title: ReactNode;
  /** Optional trailing content inside the toggle (e.g. a <StatusBadge>). Becomes part of its name. */
  meta?: ReactNode;
  children: ReactNode;
  /** Initial state when uncontrolled. */
  defaultOpen?: boolean;
  /** Controlled open state. Provide together with `onOpenChange`. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Wrap the toggle in a heading of this level (accordion pattern). Omit when the disclosure
   * should not appear in the document outline.
   */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  /**
   * Expose the panel as a labelled region landmark. Keep true for a handful of disclosures;
   * set false when rendering many on one page to avoid landmark clutter.
   */
  region?: boolean;
  variant?: "card" | "plain";
  /** Base id for the toggle/panel pair. Generated when omitted. */
  id?: string;
  className?: string;
  panelClassName?: string;
}

/**
 * Accessible show/hide section (WAI-ARIA disclosure pattern): a native button with
 * aria-expanded/aria-controls and a panel that animates its height via CSS grid rows.
 * Collapsed content is `inert` and `visibility: hidden`, so it is skipped by keyboard and
 * assistive technology. Transitions are removed under prefers-reduced-motion.
 */
export function Disclosure({
  title,
  meta,
  children,
  defaultOpen = false,
  open,
  onOpenChange,
  headingLevel,
  region = true,
  variant = "card",
  id,
  className,
  panelClassName,
}: DisclosureProps) {
  const generatedId = useId();
  const baseId = id ?? `disclosure-${generatedId}`;
  const buttonId = `${baseId}-button`;
  const panelId = `${baseId}-panel`;

  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : uncontrolledOpen;

  function toggle() {
    const next = !isOpen;
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  const trigger = (
    <button
      type="button"
      id={buttonId}
      aria-expanded={isOpen}
      aria-controls={panelId}
      onClick={toggle}
      className={cn(
        "group flex w-full items-center gap-3 text-left text-ivory-50 transition-colors duration-200",
        "hover:text-gold-100 focus-visible:outline-offset-2",
        variant === "card" ? "rounded-card px-4 py-4 sm:px-5" : "rounded-sm py-4",
      )}
    >
      <span className="min-w-0 flex-1 text-[0.9375rem] leading-snug font-medium sm:text-base">{title}</span>
      {meta ? <span className="hidden shrink-0 sm:inline-flex">{meta}</span> : null}
      <ChevronDownIcon
        className={cn(
          "size-5 shrink-0 text-gold-300 transition-transform duration-300 ease-celestial",
          isOpen && "rotate-180",
        )}
      />
    </button>
  );

  const HeadingTag = headingLevel ? (`h${headingLevel}` as const) : null;

  return (
    <div
      className={cn(
        variant === "card"
          ? "rounded-card border border-line bg-night-800/50 transition-colors duration-200 hover:border-white/15"
          : "border-b border-line",
        className,
      )}
    >
      {HeadingTag ? <HeadingTag className="m-0 font-sans text-base font-medium">{trigger}</HeadingTag> : trigger}
      {meta ? <div className={cn("sm:hidden", variant === "card" ? "-mt-2 px-4 pb-3" : "-mt-2 pb-3")}>{meta}</div> : null}
      <div
        id={panelId}
        role={region ? "region" : undefined}
        aria-labelledby={region ? buttonId : undefined}
        inert={!isOpen}
        className={cn(
          "grid transition-[grid-template-rows,opacity,visibility] duration-300 ease-celestial",
          isOpen ? "visible grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={cn(
              "text-[0.9375rem] leading-relaxed text-ivory-100",
              variant === "card" ? "px-4 pb-5 sm:px-5" : "pb-5",
              panelClassName,
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
