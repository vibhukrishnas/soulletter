"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

export interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Delay in seconds before the element animates in. */
  delay?: number;
  /** Vertical offset in px at the start of the animation. */
  offset?: number;
  /** Fraction of the element that must be visible before it animates (0–1). */
  amount?: number;
}

/**
 * Fades (and gently lifts) content in the first time it scrolls into view.
 *
 * - Under prefers-reduced-motion the root <MotionConfig reducedMotion="user"> removes the
 *   movement, and the [data-reveal] CSS rule in globals.css shows content immediately.
 * - Without JavaScript the root layout's <noscript> style keeps [data-reveal] visible.
 * Use for below-the-fold sections only; above-the-fold content should use the CSS
 * `animate-fade-up` utility so it paints without waiting for hydration.
 */
export function Reveal({ children, className, delay = 0, offset = 18, amount = 0.2 }: RevealProps) {
  const variants: Variants = {
    hidden: { opacity: 0, y: offset },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] } },
  };
  return (
    <motion.div
      data-reveal=""
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount }}
      variants={variants}
    >
      {children}
    </motion.div>
  );
}
