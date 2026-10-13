import { cn } from "@/components/ui/cn";

/**
 * Decorative star field. Positions come from a seeded PRNG evaluated with integer
 * arithmetic only (no Math.random, no trigonometry), so server and client render
 * byte-identical markup and hydration never mismatches.
 */

interface Star {
  x: number;
  y: number;
  r: number;
  opacity: number;
  /** Twinkle group (0–2); each group pulses on its own rhythm. */
  group: 0 | 1 | 2;
  warm: boolean;
}

/** mulberry32 — tiny deterministic PRNG returning floats in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

function createStars(seed: number, count: number): Star[] {
  const random = mulberry32(seed);
  const stars: Star[] = [];
  for (let i = 0; i < count; i += 1) {
    const size = random();
    stars.push({
      x: round1(random() * 1000),
      y: round1(random() * 1000),
      // Mostly faint pin-pricks with a few brighter stars.
      r: round2(size > 0.94 ? 1.25 + random() * 0.35 : 0.45 + size * 0.6),
      opacity: round2(size > 0.94 ? 0.9 : 0.25 + random() * 0.5),
      group: (i % 3) as 0 | 1 | 2,
      warm: random() > 0.85,
    });
  }
  return stars;
}

const DEFAULT_SEED = 0x5011e77e;
const DEFAULT_COUNT = 150;
const DEFAULT_STARS = createStars(DEFAULT_SEED, DEFAULT_COUNT);

/** Full class names (not composed) so Tailwind's scanner can find them. */
const GROUP_ANIMATION = [
  "motion-safe:animate-twinkle-a",
  "motion-safe:animate-twinkle-b",
  "motion-safe:animate-twinkle-c",
] as const;

export interface StarFieldProps {
  /** Number of stars across the 1000×1000 field (cropped to the element's aspect ratio). */
  count?: number;
  /** Change to get a different but still deterministic arrangement. */
  seed?: number;
  /** Gentle opacity pulse; automatically disabled under prefers-reduced-motion. */
  twinkle?: boolean;
  className?: string;
}

export function StarField({ count = DEFAULT_COUNT, seed = DEFAULT_SEED, twinkle = true, className }: StarFieldProps) {
  const stars = seed === DEFAULT_SEED && count === DEFAULT_COUNT ? DEFAULT_STARS : createStars(seed, count);
  const groups = [0, 1, 2] as const;

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 1000 1000"
      preserveAspectRatio="xMidYMid slice"
      className={cn("pointer-events-none text-ivory-100", className)}
    >
      {groups.map((group) => (
        <g
          key={group}
          className={twinkle ? GROUP_ANIMATION[group] : undefined}
        >
          {stars
            .filter((star) => star.group === group)
            .map((star, index) => (
              <circle
                key={index}
                cx={star.x}
                cy={star.y}
                r={star.r}
                fill="currentColor"
                fillOpacity={star.opacity}
                className={star.warm ? "text-gold-200" : undefined}
              />
            ))}
        </g>
      ))}
    </svg>
  );
}
