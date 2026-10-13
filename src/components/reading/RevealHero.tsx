"use client";

import { motion, type Transition } from "framer-motion";
import { useRef } from "react";
import { StarField } from "@/components/brand";
import { Button, StatusBadge } from "@/components/ui";
import { REVEAL_SKIP_ID } from "@/components/onboarding/field-ids";
import type { ReadingResult } from "@/lib/contracts/reading";
import { NOT_A_PREDICTION } from "./CandidateCard";
import { revealSubject } from "./reveal-subject";

/* Decorative constellation (hand-placed, deterministic; it does not depict the chart). */
const POINTS: readonly (readonly [number, number])[] = [
  [28, 196],
  [84, 128],
  [150, 160],
  [200, 52],
  [252, 118],
  [318, 70],
  [372, 168],
];
const PATHS = [
  "M28 196 L84 128 L150 160 L200 52",
  "M200 52 L252 118 L318 70 L372 168",
  "M150 160 L252 118",
];

const EASE: Transition["ease"] = [0.22, 1, 0.36, 1];

export interface RevealHeroProps {
  result: ReadingResult;
  /** Play the reveal; false renders the final state immediately. */
  animate: boolean;
  onDone: () => void;
}

export function RevealHero({ result, animate, onDone }: RevealHeroProps) {
  const subject = revealSubject(result);
  const doneRef = useRef(false);
  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  const fade = (delay: number, y = 10) =>
    animate
      ? {
          initial: { opacity: 0, y },
          animate: { opacity: 1, y: 0 },
          transition: { delay, duration: 0.7, ease: EASE },
        }
      : { initial: false as const };

  const syllable = subject.kind === "partner" ? subject.candidate.syllable : subject.kind === "native" ? subject.syllable : null;

  return (
    <div
      key={animate ? "animated" : "static"}
      className="relative isolate overflow-hidden rounded-panel border border-gold-300/20 bg-celestial px-4 py-12 shadow-glow-gold-soft sm:px-8 sm:py-16"
    >
      <StarField className="absolute inset-0 -z-10 size-full opacity-70" count={90} seed={0x51ab} />
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 400 240"
        fill="none"
        className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 mx-auto w-full max-w-2xl -translate-y-1/2 text-gold-300"
      >
        {PATHS.map((d, i) => (
          <motion.path
            key={d}
            d={d}
            stroke="currentColor"
            strokeOpacity={0.38}
            strokeWidth={0.9}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={animate ? { pathLength: 0, opacity: 0 } : false}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={animate ? { delay: 0.2 + i * 0.45, duration: 1.4, ease: EASE } : undefined}
          />
        ))}
        {POINTS.map(([x, y], i) => (
          <motion.circle
            key={`${x}-${y}`}
            cx={x}
            cy={y}
            r={i === 3 ? 3 : 2}
            className="fill-ivory-50"
            initial={animate ? { opacity: 0, scale: 0 } : false}
            animate={{ opacity: 0.9, scale: 1 }}
            transition={animate ? { delay: 0.15 + i * 0.18, duration: 0.5 } : undefined}
          />
        ))}
      </svg>

      {animate ? (
        <Button id={REVEAL_SKIP_ID} variant="ghost" size="sm" onClick={finish} className="absolute top-3 right-3">
          Skip animation
        </Button>
      ) : null}

      <div className="flex flex-col items-center gap-4 text-center">
        <motion.div {...fade(0.4)}>
          {subject.kind === "partner" ? (
            <StatusBadge status="experimental_symbolic" size="md" />
          ) : subject.kind === "native" ? (
            <StatusBadge status="documented_traditional_interpretation" size="md" />
          ) : null}
        </motion.div>

        {syllable ? (
          <>
            <motion.span
              lang="sa"
              data-testid="reveal-syllable"
              className="font-devanagari text-8xl leading-[1.25] text-ivory-50 drop-shadow-[0_0_24px_rgb(229_204_146/0.35)] sm:text-9xl"
              initial={animate ? { opacity: 0, scale: 0.7, filter: "blur(14px)" } : false}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={animate ? { delay: 1.3, duration: 1.2, ease: EASE } : undefined}
            >
              {syllable.devanagari}
            </motion.span>
            <motion.div className="flex flex-col items-center gap-1" {...fade(2.2)}>
              <span className="font-display text-4xl font-medium text-gold-200 sm:text-5xl">
                <span className="sr-only">Roman spelling: </span>
                {syllable.roman}
              </span>
              <span className="text-base text-mist-300">
                IAST{" "}
                <span lang="sa-Latn" className="font-display text-lg text-ivory-100 italic">
                  {syllable.iast}
                </span>
              </span>
            </motion.div>
          </>
        ) : (
          <motion.div className="flex max-w-xl flex-col items-center gap-3" {...fade(1.2)}>
            <p className="font-display text-3xl text-ivory-50 sm:text-4xl">{subject.kind === "none" ? subject.title : ""}</p>
            <p className="text-base text-mist-200">{subject.kind === "none" ? subject.detail : ""}</p>
          </motion.div>
        )}

        <motion.p
          className="max-w-xl text-[0.9375rem] leading-relaxed text-mist-200"
          {...fade(syllable ? 2.8 : 1.8)}
          onAnimationComplete={animate ? finish : undefined}
        >
          {subject.kind === "partner"
            ? `Shown first in a fixed presentation order — not a measure of likelihood. Experimental symbolic interpretation: ${NOT_A_PREDICTION}`
            : subject.kind === "native"
              ? subject.label
              : "Any possibilities are listed below with the birth-time range each one applies to. None is chosen for you."}
        </motion.p>
      </div>
    </div>
  );
}
