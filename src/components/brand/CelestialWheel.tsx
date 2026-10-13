import { cn } from "@/components/ui/cn";

/**
 * Abstract sky-wheel ornament: 12 sign divisions, 27 lunar-mansion ticks and 108 quarter
 * ticks. Purely decorative — it shows no planets or positions. Angles are produced by
 * exact arithmetic and fixed-precision strings (no trigonometry) so server and client
 * markup always match.
 */

const NAKSHATRA_ANGLES = Array.from({ length: 27 }, (_, i) => ((i * 360) / 27).toFixed(3));
const PADA_ANGLES = Array.from({ length: 108 }, (_, i) => i)
  .filter((i) => i % 4 !== 0)
  .map((i) => ((i * 360) / 108).toFixed(3));
const SIGN_ANGLES = Array.from({ length: 12 }, (_, i) => String(i * 30));

export interface CelestialWheelProps {
  /** Very slow rotation; disabled under prefers-reduced-motion. */
  rotate?: boolean;
  className?: string;
}

export function CelestialWheel({ rotate = true, className }: CelestialWheelProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="-200 -200 400 400"
      fill="none"
      className={cn("pointer-events-none text-gold-300", rotate && "motion-safe:animate-spin-slow", className)}
    >
      <circle r="193" stroke="currentColor" strokeOpacity="0.38" strokeWidth="0.6" />
      <circle r="171" stroke="currentColor" strokeOpacity="0.22" strokeWidth="0.5" />
      <g stroke="currentColor" strokeLinecap="round">
        {NAKSHATRA_ANGLES.map((angle) => (
          <line key={`n${angle}`} x1="0" y1="-193" x2="0" y2="-171" strokeOpacity="0.32" strokeWidth="0.6" transform={`rotate(${angle})`} />
        ))}
        {PADA_ANGLES.map((angle) => (
          <line key={`p${angle}`} x1="0" y1="-193" x2="0" y2="-187" strokeOpacity="0.2" strokeWidth="0.4" transform={`rotate(${angle})`} />
        ))}
        {SIGN_ANGLES.map((angle) => (
          <line key={`s${angle}`} x1="0" y1="-171" x2="0" y2="-118" strokeOpacity="0.12" strokeWidth="0.5" transform={`rotate(${angle})`} />
        ))}
      </g>
      <circle r="118" stroke="currentColor" strokeOpacity="0.24" strokeWidth="0.6" strokeDasharray="1 6" />
      <circle r="58" stroke="currentColor" strokeOpacity="0.14" strokeWidth="0.5" />
    </svg>
  );
}
