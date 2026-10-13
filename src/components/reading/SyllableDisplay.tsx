import { cn } from "@/components/ui";

export interface SyllableLike {
  devanagari: string;
  roman: string;
  iast: string;
}

const SIZES = {
  sm: { deva: "text-5xl", roman: "text-2xl", iast: "text-sm" },
  md: { deva: "text-6xl sm:text-7xl", roman: "text-3xl", iast: "text-base" },
  lg: { deva: "text-8xl sm:text-9xl", roman: "text-4xl sm:text-5xl", iast: "text-lg" },
} as const;

export interface SyllableDisplayProps {
  syllable: SyllableLike;
  size?: keyof typeof SIZES;
  align?: "center" | "start";
  /** data-testid for the Devanagari element. */
  devanagariTestId?: string;
  className?: string;
}

/**
 * Devanagari syllable (primary form) with its popular Roman spelling and IAST. Always
 * rendered together: the Roman letters alone are only a romanization hint.
 */
export function SyllableDisplay({ syllable, size = "md", align = "center", devanagariTestId, className }: SyllableDisplayProps) {
  const s = SIZES[size];
  return (
    <div className={cn("flex flex-col gap-1", align === "center" ? "items-center text-center" : "items-start", className)}>
      <span
        lang="sa"
        data-testid={devanagariTestId}
        className={cn("font-devanagari leading-[1.25] text-ivory-50", s.deva)}
      >
        {syllable.devanagari}
      </span>
      <span className={cn("font-display leading-none font-medium text-gold-200", s.roman)}>
        <span className="sr-only">Roman spelling: </span>
        {syllable.roman}
      </span>
      <span className={cn("text-mist-300", s.iast)}>
        IAST{" "}
        <span lang="sa-Latn" className="font-display text-ivory-100 italic">
          {syllable.iast}
        </span>
      </span>
    </div>
  );
}

/** Note shown with syllables: Latin initials are not a one-to-one mapping. */
export const ROMANIZATION_NOTE =
  "The Roman spelling is a popular romanization. Latin initials are only a hint: they do not map one-to-one onto Indic sounds (for example ṭ and t, or ḍ and d, are different syllables).";
