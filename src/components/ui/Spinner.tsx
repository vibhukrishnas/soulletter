import { cn } from "./cn";

export type SpinnerSize = "sm" | "md" | "lg";

export interface SpinnerProps {
  size?: SpinnerSize;
  /**
   * Accessible status text, e.g. "Calculating your chart". When provided the spinner is
   * wrapped in role="status" so the text is announced. Omit it when nearby text already
   * describes the pending state (the spinner is then purely decorative).
   */
  label?: string;
  /** Show the label next to the spinner instead of only to assistive technology. */
  labelVisible?: boolean;
  className?: string;
}

const SIZES: Record<SpinnerSize, string> = {
  sm: "size-4",
  md: "size-6",
  lg: "size-9",
};

function SpinnerGlyph({ size, className }: { size: SpinnerSize; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn(SIZES[size], "shrink-0 animate-spin text-current", className)}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.22" strokeWidth="2.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Indeterminate progress indicator. Rotation stops under prefers-reduced-motion (global CSS);
 * the static arc and label still communicate the pending state.
 */
export function Spinner({ size = "md", label, labelVisible = false, className }: SpinnerProps) {
  if (!label) return <SpinnerGlyph size={size} className={className} />;
  return (
    <span role="status" className={cn("inline-flex items-center gap-2.5", className)}>
      <SpinnerGlyph size={size} />
      <span className={labelVisible ? "text-sm text-mist-300" : "sr-only"}>{label}</span>
    </span>
  );
}
