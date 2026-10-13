import { cn } from "@/components/ui/cn";

/**
 * Decorative constellation figures drawn with fine champagne lines. Shapes are hand-placed
 * (deterministic) and purely ornamental — they do not depict anyone's chart.
 * Lines draw in once with CSS; under prefers-reduced-motion they appear fully drawn.
 */

type Point = readonly [number, number];

interface Figure {
  /** Polylines (each drawn as one path). */
  paths: readonly (readonly Point[])[];
  /** Star nodes: [x, y, radius]. */
  stars: readonly (readonly [number, number, number])[];
}

const FIGURES = {
  arc: {
    paths: [
      [
        [18, 150],
        [52, 108],
        [96, 86],
        [144, 84],
        [186, 102],
        [222, 140],
      ],
    ],
    stars: [
      [18, 150, 1.5],
      [52, 108, 2.1],
      [96, 86, 1.7],
      [144, 84, 2.6],
      [186, 102, 1.7],
      [222, 140, 1.4],
    ],
  },
  lyre: {
    paths: [
      [
        [60, 38],
        [96, 92],
        [150, 84],
        [178, 140],
        [124, 150],
        [96, 92],
      ],
    ],
    stars: [
      [60, 38, 3],
      [96, 92, 1.8],
      [150, 84, 1.7],
      [178, 140, 1.9],
      [124, 150, 1.6],
    ],
  },
  cross: {
    paths: [
      [
        [120, 22],
        [118, 96],
        [122, 178],
      ],
      [
        [36, 74],
        [80, 86],
        [118, 96],
        [160, 90],
        [206, 68],
      ],
    ],
    stars: [
      [120, 22, 2.8],
      [118, 96, 2.2],
      [122, 178, 1.7],
      [36, 74, 1.6],
      [80, 86, 1.5],
      [160, 90, 1.6],
      [206, 68, 1.8],
    ],
  },
} as const satisfies Record<string, Figure>;

export type ConstellationFigure = keyof typeof FIGURES;

export interface ConstellationLinesProps {
  figure?: ConstellationFigure;
  /** Animate the lines drawing in on first paint. */
  animate?: boolean;
  className?: string;
}

function toPathData(points: readonly Point[]): string {
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ");
}

export function ConstellationLines({ figure = "arc", animate = true, className }: ConstellationLinesProps) {
  const { paths, stars } = FIGURES[figure];
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 240 200"
      fill="none"
      className={cn("pointer-events-none text-gold-300", className)}
    >
      {paths.map((points, i) => (
        <path
          key={i}
          d={toPathData(points)}
          pathLength={1}
          stroke="currentColor"
          strokeOpacity={0.42}
          strokeWidth={0.9}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={animate ? cn("stroke-draw animate-draw-line", i > 0 && "[animation-delay:0.9s]") : undefined}
        />
      ))}
      <g className={animate ? "animate-fade-in [animation-delay:0.6s]" : undefined}>
        {stars.map(([x, y, r], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={r * 3} fill="currentColor" fillOpacity={0.1} />
            <circle cx={x} cy={y} r={r} className="fill-ivory-50" fillOpacity={0.92} />
          </g>
        ))}
      </g>
    </svg>
  );
}
