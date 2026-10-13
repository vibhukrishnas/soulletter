export interface SkipLinkProps {
  /** Id of the main content element (must be focusable, e.g. tabIndex={-1}). */
  targetId?: string;
  label?: string;
}

/** First focusable element on every page; visible only when focused. */
export function SkipLink({ targetId = "main-content", label = "Skip to content" }: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className={
        "sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-full " +
        "focus:bg-gold-200 focus:px-5 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-night-950 " +
        "focus:shadow-glow-gold focus:outline-2 focus:outline-offset-2 focus:outline-ivory-50"
      }
    >
      {label}
    </a>
  );
}
