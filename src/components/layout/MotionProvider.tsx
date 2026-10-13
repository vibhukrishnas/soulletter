"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Root Framer Motion configuration. reducedMotion="user" follows the OS
 * prefers-reduced-motion setting: transform and layout animations are skipped while
 * opacity/colour transitions remain. CSS fallbacks live in globals.css.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
