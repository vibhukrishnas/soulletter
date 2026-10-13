import { cn } from "@/components/ui/cn";

export type LogoSize = "sm" | "md" | "lg";

export interface LogoGlyphProps {
  className?: string;
  /** Accessible name. When omitted the glyph is decorative. */
  title?: string;
}

/**
 * Celestial mark: a four-point star inside a fine orbit ring with a single orbiting body.
 * Uses currentColor (champagne gold by default via the parent).
 */
export function LogoGlyph({ className, title }: LogoGlyphProps) {
  const labelled = typeof title === "string" && title.length > 0;
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      focusable="false"
      className={className}
      {...(labelled ? { role: "img", "aria-label": title } : { "aria-hidden": true })}
    >
      {labelled ? <title>{title}</title> : null}
      <circle cx="16" cy="16" r="13" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1" />
      <path
        fill="currentColor"
        d="M16 5.5c.6 6 3.9 9.4 10.5 10.5-6.6 1.1-9.9 4.4-10.5 10.5-.6-6.1-3.9-9.4-10.5-10.5C12.1 14.9 15.4 11.5 16 5.5z"
      />
      <circle cx="25.2" cy="6.8" r="1.6" fill="currentColor" />
    </svg>
  );
}

export interface LogoProps {
  size?: LogoSize;
  /** Show the "SoulLetter" wordmark next to the glyph (default). */
  withWordmark?: boolean;
  className?: string;
}

const GLYPH_SIZES: Record<LogoSize, string> = { sm: "size-6", md: "size-7", lg: "size-10" };
const WORD_SIZES: Record<LogoSize, string> = { sm: "text-xl", md: "text-[1.625rem]", lg: "text-4xl" };

/**
 * SoulLetter logo. The wordmark text provides the accessible name; the glyph alone is
 * exposed as an image named "SoulLetter".
 */
export function Logo({ size = "md", withWordmark = true, className }: LogoProps) {
  if (!withWordmark) {
    return <LogoGlyph title="SoulLetter" className={cn(GLYPH_SIZES[size], "text-gold-300", className)} />;
  }
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoGlyph className={cn(GLYPH_SIZES[size], "shrink-0 text-gold-300")} />
      <span className={cn("font-display leading-none font-medium tracking-[0.01em] text-ivory-50", WORD_SIZES[size])}>
        Soul<span className="text-gold-200 italic">Letter</span>
      </span>
    </span>
  );
}
